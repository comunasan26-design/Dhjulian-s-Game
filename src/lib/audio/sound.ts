/**
 * Trilha sonora e efeitos sonoros gerados na hora com Web Audio (sem arquivos de áudio).
 * A música muda de "clima" conforme o jogo (calmo, combate, chefe, vitória, derrota) e os efeitos
 * tocam por cima em eventos (subir de nível, maldição, runa…).
 */

export type Mood = "calm" | "combat" | "boss" | "victory" | "defeat" | "off";
export type SfxName =
  | "pickup"
  | "flip"
  | "play"
  | "levelUp"
  | "levelDown"
  | "combat"
  | "win"
  | "lose"
  | "death"
  | "curse"
  | "rune"
  | "dice"
  | "treasure"
  | "gameWin"
  | "gameLose"
  | "flee";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Chord = number[]; // notas MIDI (fundamental primeiro)
const maj = (r: number): Chord => [r, r + 4, r + 7];
const min = (r: number): Chord => [r, r + 3, r + 7];

interface Song {
  bpm: number;
  chords: Chord[];
  step: (e: Engine, s: number, bar: number, chord: Chord, t: number) => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}

class Engine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  fx!: GainNode;
  verb!: GainNode;
  noiseBuf!: AudioBuffer;
  enabled = true;
  volume = 0.6;
  mood: Mood = "off";
  private timer: number | null = null;
  private nextTime = 0;
  private stepN = 0;
  private holdUntil = 0;
  private seed = 1;
  private lastMelody = 74;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      this.enabled = load("dg_som", true);
      this.volume = load("dg_volume", 0.6);
    }
  }

  rand() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Cria o contexto de áudio (precisa de um gesto do usuário). */
  unlock() {
    if (!this.enabled || typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = 0.75;
      this.fx = ctx.createGain();
      this.fx.gain.value = 1;
      // reverb simples (resposta ao impulso gerada)
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.4);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      }
      conv.buffer = ir;
      this.verb = ctx.createGain();
      this.verb.gain.value = 0.32;
      this.verb.connect(conv).connect(this.master);
      this.music.connect(this.master);
      this.music.connect(this.verb);
      this.fx.connect(this.master);
      this.fx.connect(this.verb);
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.startScheduler();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    save("dg_som", on);
    if (!on) {
      this.stopScheduler();
      if (this.ctx) void this.ctx.suspend();
    } else {
      this.unlock();
    }
    this.emit();
  }

  setVolume(v: number) {
    this.volume = v;
    save("dg_volume", v);
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    this.emit();
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0, t, 0.12);
    this.holdUntil = t + 0.6;
    this.music.gain.setTargetAtTime(0.75, t + 0.6, 0.2);
    this.stepN = 0;
    this.nextTime = t + 0.6;
  }

  private startScheduler() {
    if (this.timer !== null || !this.ctx) return;
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    this.timer = window.setInterval(() => this.tick(), 40);
  }
  private stopScheduler() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const song = SONGS[this.mood];
    if (!song) return;
    const sixteenth = 60 / song.bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05; // aba voltou do segundo plano
    while (this.nextTime < ctx.currentTime + 0.18) {
      if (this.nextTime >= this.holdUntil) {
        const s = this.stepN % 16;
        const bar = Math.floor(this.stepN / 16);
        song.step(this, s, bar, song.chords[bar % song.chords.length], this.nextTime);
      }
      this.nextTime += sixteenth;
      this.stepN++;
    }
  }

  // ------------------------------------------------------------------ instrumentos

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  pluck(midi: number, t: number, dur: number, vol: number, bus: AudioNode = this.music, bright = 2600) {
    const c = this.ctx!;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = "triangle";
    o2.type = "square";
    o1.frequency.value = hz(midi);
    o2.frequency.value = hz(midi) * 1.003;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(bright, t);
    f.frequency.exponentialRampToValueAtTime(400, t + dur);
    const g2 = c.createGain();
    g2.gain.value = 0.18;
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    o1.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g).connect(bus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  pad(notes: number[], t: number, dur: number, vol: number, cutoff = 900, type: OscillatorType = "sawtooth") {
    const c = this.ctx!;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.7, dur * 0.4));
    g.gain.setValueAtTime(vol, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g).connect(this.music);
    for (const n of notes) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = hz(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.7);
      }
    }
  }

  flute(midi: number, t: number, dur: number, vol: number, bus: AudioNode = this.music) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = hz(midi);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.4;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(hz(midi) * 0.008, t + 0.25);
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(g).connect(bus);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.2);
    lfo.stop(t + dur + 0.2);
  }

  drum(t: number, vol: number, f0 = 120, f1 = 45, decay = 0.38, bus: AudioNode = this.music) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.7);
    const g = c.createGain();
    this.env(g, t, 0.004, vol, decay);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + decay + 0.05);
    this.noise(t, 0.03, vol * 0.25, "lowpass", 1200, bus);
  }

  noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, bus: AudioNode = this.music, freqEnd?: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = type === "bandpass" ? 1.4 : 0.7;
    const g = c.createGain();
    this.env(g, t, Math.min(0.01, dur / 3), vol, dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  brass(notes: number[], t: number, dur: number, vol: number, bus: AudioNode = this.music) {
    const c = this.ctx!;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    f.connect(g).connect(bus);
    for (const n of notes) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz(n);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.25);
    }
  }

  bell(midi: number, t: number, vol: number, dur = 1.6, bus: AudioNode = this.music) {
    const c = this.ctx!;
    const g = c.createGain();
    this.env(g, t, 0.003, vol, dur);
    g.connect(bus);
    [
      [1, 1],
      [2.76, 0.45],
      [5.4, 0.22],
      [8.93, 0.1],
    ].forEach(([ratio, amp]) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = hz(midi) * ratio;
      const og = c.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  melody(chord: Chord, t: number, dur: number, vol: number, lo = 69, hi = 84) {
    const scale = [0, 2, 3, 5, 7, 8, 10];
    const tones = chord.map((n) => n % 12);
    let best = this.lastMelody;
    let bestScore = -1;
    for (let n = lo; n <= hi; n++) {
      const pc = (n - 62 + 120) % 12;
      if (!scale.includes(pc)) continue;
      const score = (tones.includes(n % 12) ? 2 : 0) + (Math.abs(n - this.lastMelody) <= 3 ? 1.5 : 0) + this.rand() * 1.6 - (n === this.lastMelody ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    this.lastMelody = best;
    this.flute(best, t, dur, vol);
  }

  // ------------------------------------------------------------------ efeitos

  sfx(name: SfxName) {
    if (!this.enabled) return;
    if (!this.ctx) return;
    if (this.ctx.state !== "running") void this.ctx.resume();
    const t = this.ctx.currentTime + 0.01;
    const B = this.fx;
    switch (name) {
      case "pickup":
        this.noise(t, 0.08, 0.12, "bandpass", 2800, B, 4200);
        this.pluck(86, t + 0.02, 0.25, 0.04, B, 4000);
        break;
      case "flip":
        this.noise(t, 0.16, 0.16, "bandpass", 1400, B, 5200);
        break;
      case "play":
        this.drum(t, 0.12, 160, 80, 0.15, B);
        this.noise(t, 0.09, 0.08, "bandpass", 2500, B);
        break;
      case "levelUp":
        [74, 78, 81, 86, 90].forEach((n, i) => this.bell(n, t + i * 0.085, 0.13, 1.4, B));
        this.noise(t + 0.3, 0.8, 0.035, "highpass", 6000, B);
        break;
      case "levelDown":
        [69, 65, 62, 57].forEach((n, i) => this.pluck(n, t + i * 0.13, 0.5, 0.12, B, 1400));
        break;
      case "combat":
        this.drum(t, 0.5, 110, 38, 0.6, B);
        this.drum(t + 0.18, 0.35, 140, 50, 0.4, B);
        this.brass([50, 57, 62, 65], t + 0.05, 0.7, 0.12, B);
        break;
      case "win":
        this.drum(t, 0.4, 100, 40, 0.5, B);
        this.brass([62, 66, 69, 74], t, 0.9, 0.13, B);
        this.noise(t, 1.3, 0.07, "highpass", 5000, B);
        break;
      case "lose":
        this.brass([57, 60, 64], t, 0.4, 0.1, B);
        this.brass([55, 58, 62], t + 0.35, 0.8, 0.1, B);
        break;
      case "death": {
        this.bell(38, t, 0.3, 3.5, B);
        this.noise(t, 1.6, 0.1, "lowpass", 300, B);
        const c = this.ctx;
        const o = c.createOscillator();
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 1.4);
        const g = c.createGain();
        this.env(g, t, 0.02, 0.12, 1.4);
        o.connect(g).connect(B);
        o.start(t);
        o.stop(t + 1.5);
        break;
      }
      case "curse":
        this.noise(t, 0.9, 0.08, "bandpass", 300, B, 2400);
        [62, 68, 71].forEach((n, i) => this.flute(n, t + 0.1 + i * 0.12, 1.1, 0.06, B));
        break;
      case "rune":
        [86, 93, 98, 91].forEach((n, i) => this.bell(n, t + i * 0.06, 0.09, 1.8, B));
        this.flute(50, t, 1.2, 0.05, B);
        break;
      case "dice":
        for (let i = 0; i < 5; i++) this.noise(t + i * 0.055 + Math.random() * 0.03, 0.02, 0.18, "bandpass", 2200 + Math.random() * 1500, B);
        break;
      case "treasure":
        [96, 100, 103, 96].forEach((n, i) => this.bell(n, t + i * 0.07, 0.07, 0.6, B));
        break;
      case "gameWin":
        this.brass([62, 66, 69], t, 0.35, 0.13, B);
        this.brass([62, 66, 69], t + 0.36, 0.2, 0.13, B);
        this.brass([74, 78, 81], t + 0.6, 1.4, 0.15, B);
        this.drum(t + 0.6, 0.45, 100, 40, 0.6, B);
        this.noise(t + 0.6, 1.8, 0.08, "highpass", 5000, B);
        break;
      case "gameLose":
        this.pad([50, 53, 57], t, 2.4, 0.07, 700);
        this.bell(38, t, 0.2, 3, B);
        break;
      case "flee":
        this.noise(t, 0.4, 0.1, "bandpass", 600, B, 3000);
        [74, 72, 69, 67].forEach((n, i) => this.pluck(n, t + 0.05 + i * 0.06, 0.18, 0.07, B, 3500));
        break;
    }
  }
}

// ------------------------------------------------------------------ músicas

const SONGS: Partial<Record<Mood, Song>> = {
  // Taverna / exploração: alaúde, flauta e bordão
  calm: {
    bpm: 76,
    chords: [min(50), maj(46), maj(48), maj(45), min(50), maj(53), maj(48), maj(45)],
    step(e, s, bar, ch, t) {
      const beat = 60 / 76;
      if (s === 0) {
        e.pad(ch.map((n) => n + 12), t, beat * 4, 0.022, 800);
        e.pluck(ch[0] - 12, t, 1.8, 0.1, e.music, 900);
        e.drum(t, 0.08, 90, 50, 0.3);
      }
      if (s === 8) {
        e.pluck(ch[0] - 5, t, 1.4, 0.07, e.music, 900);
        e.drum(t, 0.04, 140, 70, 0.2);
      }
      if (s % 2 === 0) {
        const arp = [ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[2] + 12];
        e.pluck(arp[s / 2], t, 0.9, s === 0 ? 0.075 : 0.05);
      }
      if (s % 4 === 0 && bar % 8 >= 2 && e.rand() < 0.5) e.melody(ch, t, beat * (e.rand() < 0.5 ? 1 : 1.6), 0.045);
    },
  },
  // Combate: tambores de guerra, ostinato e metais
  combat: {
    bpm: 132,
    chords: [min(50), min(50), maj(46), maj(48), min(50), min(50), maj(46), maj(45)],
    step(e, s, bar, ch, t) {
      const beat = 60 / 132;
      if ([0, 3, 6, 8, 11].includes(s)) e.drum(t, s === 0 ? 0.36 : 0.24, 110, 40, 0.35);
      if (bar % 4 === 3 && s >= 12) e.drum(t, 0.18, 220 - (s - 12) * 25, 90, 0.2);
      if (s === 4 || s === 12) e.noise(t, 0.12, 0.08, "bandpass", 1800);
      e.pluck(ch[0] - 12, t, 0.14, [0, 3, 6, 10].includes(s) ? 0.1 : 0.05, e.music, 700);
      if (s === 0) {
        e.brass(ch, t, beat * 1.2, 0.07);
        e.pad(ch.map((n) => n + 12), t, beat * 4, 0.014, 1400);
      }
      if (s === 10 && bar % 2) e.brass(ch, t, beat * 0.5, 0.05);
      if (bar % 2 === 1 && s % 4 === 0) e.melody(ch, t, beat * 0.9, 0.05, 74, 86);
    },
  },
  // Chefe (monstro lendário): lento, pesado, sino
  boss: {
    bpm: 96,
    chords: [min(50), maj(51), min(50), maj(45)],
    step(e, s, bar, ch, t) {
      const beat = 60 / 96;
      if (s === 0 || s === 8) e.drum(t, 0.45, 80, 32, 0.6);
      if (s === 6 || s === 14) e.drum(t, 0.22, 150, 60, 0.3);
      if (s === 0) {
        e.pad([ch[0] - 24, ch[0] - 12], t, beat * 4, 0.035, 300);
        e.pad(ch.map((n) => n + 12), t, beat * 4, 0.018, 1100, "triangle");
        e.brass([ch[0] - 12, ch[0]], t, beat * 1.5, 0.08);
        if (bar % 2 === 0) e.bell(ch[0] - 12, t, 0.12, 3);
      }
      if (s === 6) e.brass([ch[0] - 12, ch[2] - 12], t, beat * 0.6, 0.06);
      if (s % 2 === 0) e.pluck(ch[0] - 24, t, 0.2, 0.06, e.music, 400);
    },
  },
  // Vitória: fanfarra em ré maior
  victory: {
    bpm: 100,
    chords: [maj(50), maj(55), maj(57), maj(50)],
    step(e, s, bar, ch, t) {
      const beat = 60 / 100;
      if (s === 0) {
        e.pad(ch.map((n) => n + 12), t, beat * 4, 0.025, 1500);
        e.drum(t, 0.3, 100, 40, 0.5);
      }
      if (s === 8) e.drum(t, 0.2, 100, 40, 0.4);
      if (s % 4 === 0) e.brass([ch[(s / 4) % 3] + 12], t, beat * 0.8, 0.06);
      if (s % 2 === 0) e.bell(ch[(s / 2) % 3] + 24, t, 0.025, 0.8);
    },
  },
  // Derrota: lamento lento
  defeat: {
    bpm: 60,
    chords: [min(50), min(55), maj(46), maj(45)],
    step(e, s, bar, ch, t) {
      const beat = 60;
      if (s === 0) {
        e.pad(ch, t, (beat / 60) * 4, 0.03, 600);
        e.bell(ch[0] - 12, t, 0.07, 3);
      }
      if (s === 8 && e.rand() < 0.6) e.melody(ch, t, 1.6, 0.04, 62, 76);
    },
  },
};

export const engine = new Engine();

export function sfx(name: SfxName) {
  engine.sfx(name);
}
