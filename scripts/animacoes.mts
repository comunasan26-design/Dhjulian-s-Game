/**
 * Gera as animações Lottie (JSON) dos eventos do jogo em public/animacoes/.
 * Rode com: npm run animacoes
 *
 * Qualquer arquivo pode ser trocado por uma animação Lottie feita no After Effects / LottieFiles
 * com o mesmo nome — o jogo só carrega o JSON.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Vec = number | number[];
type Key = [t: number, v: Vec, ease?: "in" | "out" | "inOut" | "linear" | "hold"];
type Prop = Vec | Key[];

const W = 300;
const H = 300;
const FR = 60;

const isKeys = (p: Prop): p is Key[] => Array.isArray(p) && p.length > 0 && Array.isArray(p[0]);
const arr = (v: Vec) => (Array.isArray(v) ? v : [v]);
const EASE = {
  in: { o: [0.55, 0], i: [1, 1] },
  out: { o: [0, 0], i: [0.3, 1] },
  inOut: { o: [0.6, 0], i: [0.4, 1] },
  linear: { o: [0, 0], i: [1, 1] },
};

function prop(p: Prop) {
  if (!isKeys(p)) return { a: 0, k: p };
  return {
    a: 1,
    k: p.map(([t, v, ease = "inOut"], idx) => {
      const last = idx === p.length - 1;
      if (last) return { t, s: arr(v) };
      if (ease === "hold") return { t, s: arr(v), h: 1 };
      const e = EASE[ease];
      return { t, s: arr(v), o: { x: [e.o[0]], y: [e.o[1]] }, i: { x: [e.i[0]], y: [e.i[1]] } };
    }),
  };
}

const hex = (c: string): number[] => {
  const n = parseInt(c.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

// ---------------------------------------------------------------- formas
type Shape = Record<string, unknown>;
const ellipse = (w: Prop, h?: Prop, p: Prop = [0, 0]): Shape => ({ ty: "el", d: 1, p: prop(p), s: prop(h === undefined ? (isKeys(w) ? w : [w as number, w as number]) : [w as number, h as number]) });
const rect = (w: number, h: number, r = 0, p: Prop = [0, 0]): Shape => ({ ty: "rc", d: 1, p: prop(p), s: prop([w, h]), r: prop(r) });
const star = (pts: number, or: Prop, ir: Prop, rot = 0): Shape => ({
  ty: "sr",
  sy: 1,
  d: 1,
  pt: prop(pts),
  p: prop([0, 0]),
  r: prop(rot),
  or: prop(or),
  os: prop(0),
  ir: prop(ir),
  is: prop(0),
});
/** Caminho por pontos (retas). */
const path = (pts: number[][], closed = true): Shape => ({
  ty: "sh",
  ks: prop({ i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]), v: pts, c: closed } as unknown as Vec),
});
/** Caminho com curvas: cada ponto [x, y, inX, inY, outX, outY]. */
const curve = (pts: number[][], closed = true): Shape => ({
  ty: "sh",
  ks: prop({ v: pts.map((p) => [p[0], p[1]]), i: pts.map((p) => [p[2] ?? 0, p[3] ?? 0]), o: pts.map((p) => [p[4] ?? 0, p[5] ?? 0]), c: closed } as unknown as Vec),
});
const fill = (c: string, o: Prop = 100): Shape => ({ ty: "fl", c: prop(hex(c)), o: prop(o), r: 1 });
const stroke = (c: string, w: Prop, o: Prop = 100): Shape => ({ ty: "st", c: prop(hex(c)), o: prop(o), w: prop(w), lc: 2, lj: 2 });
const trim = (s: Prop, e: Prop, o: Prop = 0): Shape => ({ ty: "tm", s: prop(s), e: prop(e), o: prop(o), m: 1 });

interface Tr {
  p?: Prop;
  a?: Prop;
  s?: Prop;
  r?: Prop;
  o?: Prop;
}
const trShape = (t: Tr = {}): Shape => ({
  ty: "tr",
  p: prop(t.p ?? [0, 0]),
  a: prop(t.a ?? [0, 0]),
  s: prop(t.s ?? [100, 100]),
  r: prop(t.r ?? 0),
  o: prop(t.o ?? 100),
  sk: prop(0),
  sa: prop(0),
});
const group = (items: Shape[], t: Tr = {}): Shape => ({ ty: "gr", it: [...items, trShape(t)] });

let layerIdx = 0;
function layer(name: string, shapes: Shape[], t: Tr & { ip?: number; op?: number } = {}) {
  layerIdx++;
  const p3 = (v: Prop): Prop => (isKeys(v) ? v.map(([tt, vv, e]) => [tt, [...arr(vv), 0], e] as Key) : [...arr(v as Vec), 0]);
  const s3 = (v: Prop): Prop => (isKeys(v) ? v.map(([tt, vv, e]) => [tt, [...arr(vv), 100], e] as Key) : [...arr(v as Vec), 100]);
  return {
    ddd: 0,
    ind: layerIdx,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: prop(t.o ?? 100),
      r: prop(t.r ?? 0),
      p: prop(p3(t.p ?? [W / 2, H / 2])),
      a: prop([0, 0, 0]),
      s: prop(s3(t.s ?? [100, 100])),
    },
    ao: 0,
    // no Lottie o primeiro item fica por cima: declaramos de trás para frente e invertemos
    shapes: [...shapes].reverse(),
    ip: t.ip ?? 0,
    op: t.op ?? 999,
    st: 0,
    bm: 0,
  };
}

function anim(name: string, op: number, layers: ReturnType<typeof layer>[]) {
  // Lottie desenha a primeira camada por cima: invertemos para declarar de trás para frente
  return { v: "5.7.4", fr: FR, ip: 0, op, w: W, h: H, nm: name, ddd: 0, assets: [], layers: layers.reverse().map((l, i) => ({ ...l, ind: i + 1, op: Math.min(l.op, op) })) };
}

// ---------------------------------------------------------------- utilidades de animação
const pop = (t0: number, peak = 115, end = 100): Key[] => [
  [t0, [0, 0], "out"],
  [t0 + 12, [peak, peak], "inOut"],
  [t0 + 20, [end, end]],
];
const fadeOut = (t0: number, t1: number, from = 100): Key[] => [
  [t0, from, "linear"],
  [t1, 0],
];
const fadeInOut = (a: number, b: number, c: number, d: number): Key[] => [
  [a, 0, "linear"],
  [b, 100, "hold"],
  [c, 100, "linear"],
  [d, 0],
];
const polar = (ang: number, r: number) => [W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r];

/** Estrelinhas que se espalham do centro. */
function sparkles(n: number, t0: number, r0: number, r1: number, color: string, size = 14, dur = 40) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
    return layer(`brilho${i}`, [group([star(4, size, size * 0.35), fill(color)])], {
      p: [
        [t0, polar(a, r0), "out"],
        [t0 + dur, polar(a, r1)],
      ],
      s: [
        [t0, [0, 0], "out"],
        [t0 + dur * 0.35, [100, 100], "inOut"],
        [t0 + dur, [0, 0]],
      ],
      r: [
        [t0, 0, "linear"],
        [t0 + dur, 180],
      ],
    });
  });
}

/** Anel que se expande e some. */
function ring(t0: number, color: string, from = 20, to = 260, w = 10, dur = 36) {
  return layer("anel", [group([ellipse([[t0, [from, from], "out"], [t0 + dur, [to, to]]]), stroke(color, [[t0, w, "linear"], [t0 + dur, 1]])])], {
    o: fadeOut(t0, t0 + dur),
  });
}

// ---------------------------------------------------------------- animações

function nivel() {
  layerIdx = 0;
  const chevron = (y: number) => path([
    [-50, y + 22],
    [0, y - 26],
    [50, y + 22],
    [50, y + 46],
    [0, y - 2],
    [-50, y + 46],
  ]);
  return anim("Subiu de nível", 100, [
    layer("raios", [group([star(16, 150, 40), fill("#ffd75a", 25)])], { r: [[0, 0, "linear"], [100, 90]], s: pop(4, 110, 100), o: fadeInOut(0, 10, 70, 100) }),
    ring(6, "#ffe9a0", 30, 280, 12, 40),
    layer("seta1", [group([chevron(10), fill("#f5b82e"), stroke("#7a4b05", 5)])], {
      p: [[0, [150, 210], "out"], [26, [150, 140], "inOut"], [80, [150, 132]]],
      s: pop(0, 120, 100),
      o: fadeInOut(0, 6, 80, 100),
    }),
    layer("seta2", [group([chevron(-40), fill("#ffe08a"), stroke("#7a4b05", 5)])], {
      p: [[8, [150, 210], "out"], [34, [150, 140], "inOut"], [80, [150, 132]]],
      s: pop(8, 120, 100),
      o: fadeInOut(8, 14, 80, 100),
    }),
    ...sparkles(10, 10, 30, 135, "#fff6c8", 12, 46),
  ]);
}

function combate() {
  layerIdx = 0;
  const sword = (flip: number) =>
    group([
      group([path([[0, -110], [10, -92], [10, 30], [-10, 30], [-10, -92]]), fill("#dfe6ee"), stroke("#3a4048", 3)]),
      group([path([[0, -100], [0, 26]], false), stroke("#ffffff", 2, 70)]),
      group([rect(64, 12, 4, [0, 36]), fill("#c8902a"), stroke("#4a3008", 3)]),
      group([rect(12, 34, 3, [0, 58]), fill("#5a3415"), stroke("#2a1606", 2)]),
      group([ellipse(16, 16, [0, 80]), fill("#c8902a"), stroke("#4a3008", 2)]),
    ], { s: [flip, 100] });
  return anim("Combate", 80, [
    layer("clarão", [group([star(12, 120, 30), fill("#ffd36b")])], { s: [[18, [0, 0], "out"], [24, [120, 120], "in"], [44, [0, 0]]], r: [[18, 0, "linear"], [44, 40]] }),
    ring(20, "#ffb347", 20, 240, 14, 30),
    layer("espadaE", [sword(100)], {
      p: [[0, [40, 260], "in"], [20, [150, 160]]],
      r: [[0, -100, "in"], [20, -40, "out"], [26, -48, "inOut"], [34, -40]],
      o: fadeInOut(0, 4, 64, 80),
    }),
    layer("espadaD", [sword(-100)], {
      p: [[0, [260, 260], "in"], [20, [150, 160]]],
      r: [[0, 100, "in"], [20, 40, "out"], [26, 48, "inOut"], [34, 40]],
      o: fadeInOut(0, 4, 64, 80),
    }),
    ...sparkles(8, 20, 10, 120, "#fff1b0", 10, 30),
  ]);
}

function vitoria() {
  layerIdx = 0;
  const skull = [
    group([ellipse(110, 100, [0, -10]), fill("#efe6d2"), stroke("#3b2a1a", 5)]),
    group([rect(64, 34, 8, [0, 40]), fill("#efe6d2"), stroke("#3b2a1a", 5)]),
    group([ellipse(26, 30, [-24, -8]), fill("#1b120b")]),
    group([ellipse(26, 30, [24, -8]), fill("#1b120b")]),
    group([path([[0, 10], [-8, 24], [8, 24]]), fill("#1b120b")]),
  ];
  const shards = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    return layer(`caco${i}`, [group([path([[-12, -10], [14, -6], [4, 14]]), fill(i % 2 ? "#efe6d2" : "#d6c9ad"), stroke("#3b2a1a", 3)])], {
      p: [[30, polar(a, 10), "out"], [70, polar(a, 140)]],
      r: [[30, 0, "linear"], [70, (i % 2 ? 1 : -1) * 260]],
      o: [[30, 0, "hold"], [31, 100, "linear"], [70, 0]],
    });
  });
  return anim("Monstro derrotado", 90, [
    layer("brilho", [group([star(20, 140, 60), fill("#ffcf4a", 35)])], { s: pop(28, 120, 110), o: fadeInOut(28, 34, 70, 90), r: [[28, 0, "linear"], [90, 40]] }),
    ring(30, "#ffd75a", 20, 280, 16, 40),
    layer("caveira", skull, {
      s: [[0, [0, 0], "out"], [12, [105, 105], "inOut"], [18, [100, 100]]],
      r: [[18, 0, "linear"], [21, -6, "linear"], [24, 6, "linear"], [27, -4, "linear"], [30, 0]],
      o: [[0, 100, "hold"], [30, 0]],
    }),
    ...shards,
    ...sparkles(10, 32, 20, 130, "#fff1b0", 12, 40),
  ]);
}

function morte() {
  layerIdx = 0;
  const puffs = Array.from({ length: 6 }, (_, i) => {
    const x = 70 + i * 32;
    return layer(`fumaça${i}`, [group([ellipse(50), fill("#3a3540")])], {
      p: [[4 + i * 3, [x, 250], "out"], [70, [x + (i % 2 ? 14 : -14), 200]]],
      s: [[4 + i * 3, [20, 20], "out"], [70, [160, 160]]],
      o: [[4 + i * 3, 80, "linear"], [70, 0]],
    });
  });
  return anim("Morte", 110, [
    ...puffs,
    layer("lápide", [
      group([curve([[-55, 70], [-55, -40, 0, 0, 0, -40], [0, -85, -30, 0, 30, 0], [55, -40, 0, -40, 0, 0], [55, 70]]), fill("#6d6a73"), stroke("#26242a", 5)]),
      group([rect(14, 70, 2, [0, -10]), fill("#3a3840")]),
      group([rect(46, 14, 2, [0, -26]), fill("#3a3840")]),
      group([rect(140, 16, 4, [0, 76]), fill("#3a2a1a")]),
    ], {
      p: [[0, [150, 330], "out"], [26, [150, 170]]],
      o: fadeInOut(0, 4, 90, 110),
    }),
    layer("fantasma", [
      group([curve([[-26, 30], [-26, -10, 0, 0, 0, -18], [0, -36, -16, 0, 16, 0], [26, -10, 0, -18, 0, 0], [26, 30], [13, 20], [0, 30], [-13, 20]]), fill("#f2f0ff", 85)]),
      group([ellipse(7, 10, [-9, -8]), fill("#1b1820")]),
      group([ellipse(7, 10, [9, -8]), fill("#1b1820")]),
    ], {
      p: [[30, [150, 160], "out"], [100, [170, 40]]],
      s: [[30, [0, 0], "out"], [44, [100, 100]]],
      r: [[30, -8, "inOut"], [60, 8, "inOut"], [100, -6]],
      o: [[30, 0, "linear"], [40, 90, "hold"], [80, 90, "linear"], [104, 0]],
    }),
  ]);
}

function maldicao() {
  layerIdx = 0;
  const arcs = [0, 1, 2].map((i) =>
    layer(`espiral${i}`, [group([ellipse(200 - i * 46), stroke(["#7a2bd1", "#2bd17a", "#b04ad9"][i], 8), trim(0, 55, i * 120)])], {
      r: [[0, i * 40, "linear"], [100, i * 40 + (i % 2 ? -540 : 540)]],
      s: [[0, [140, 140], "out"], [40, [100, 100], "inOut"], [100, [60, 60]]],
      o: fadeInOut(0, 10, 80, 100),
    }),
  );
  return anim("Maldição", 100, [
    layer("névoa", [group([ellipse(230), fill("#2a0f3a", 55)])], { s: pop(0, 110, 100), o: fadeInOut(0, 10, 80, 100) }),
    ...arcs,
    layer("olho", [
      group([curve([[-60, 0, 0, 0, 30, -40], [60, 0, -30, -40, -30, 40]]), fill("#e8f5d0"), stroke("#1b0a24", 5)]),
      group([ellipse(40, 40), fill("#7a2bd1")]),
      group([ellipse(12, 30), fill("#0b0610")]),
      group([ellipse(8, 8, [8, -10]), fill("#ffffff")]),
    ], {
      s: [[16, [100, 0], "out"], [32, [100, 100], "inOut"], [60, [100, 100], "inOut"], [64, [100, 10], "inOut"], [68, [100, 100], "hold"], [86, [100, 100], "in"], [100, [100, 0]]],
    }),
    ...sparkles(6, 40, 40, 120, "#59f0a0", 9, 40),
  ]);
}

function runa() {
  layerIdx = 0;
  const glyphs = [
    [[0, -14], [0, 14], [0, -14], [10, -6], [0, 0], [10, 14]],
    [[-6, 14], [-6, -14], [6, -4], [-6, 2]],
    [[0, -14], [0, 14], [0, -6], [10, -14], [0, 2], [10, -6]],
    [[-8, -14], [-8, 14], [8, -14], [8, 14], [-8, -14]],
    [[-8, 14], [0, -14], [8, 14], [-4, 2], [4, 2]],
    [[0, -14], [0, 14], [-9, -6], [0, 2], [9, -6]],
  ];
  const ringLayers = glyphs.map((g, i) => {
    const a = (i / glyphs.length) * Math.PI * 2 - Math.PI / 2;
    return layer(`runa${i}`, [group([path(g, false), stroke("#ffb36b", 4)])], {
      p: [[10, polar(a, 40), "out"], [36, polar(a, 96)]],
      o: fadeInOut(10, 20, 74, 90),
      s: pop(10, 130, 100),
    });
  });
  return anim("Runa encaixada", 90, [
    layer("círculo", [group([ellipse(200), stroke("#ff6a5a", 5), trim(0, [[0, 0, "out"], [30, 100]])]), group([ellipse(180), stroke("#ffd27a", 2, 70)])], {
      r: [[0, -90, "linear"], [90, 90]],
      o: fadeInOut(0, 4, 72, 90),
    }),
    ...ringLayers,
    layer("gema", [group([path([[0, -36], [26, 0], [0, 36], [-26, 0]]), fill("#c21934"), stroke("#ffd3d9", 3)]), group([path([[0, -36], [26, 0], [0, 0]]), fill("#ee5a6d")])], {
      s: [[4, [0, 0], "out"], [20, [120, 120], "inOut"], [30, [100, 100], "inOut"], [50, [112, 112], "inOut"], [70, [100, 100]]],
      o: fadeInOut(4, 8, 74, 90),
    }),
    ring(24, "#ff8a6a", 40, 260, 8, 36),
  ]);
}

function fim() {
  layerIdx = 0;
  const colors = ["#f5b82e", "#e8453c", "#3c8de8", "#46c46a", "#b04ad9", "#ffffff"];
  const confetti = Array.from({ length: 22 }, (_, i) => {
    const x = 20 + ((i * 53) % 260);
    const d = 60 + (i % 5) * 12;
    return layer(`confete${i}`, [group([rect(8, 14, 1), fill(colors[i % colors.length])])], {
      p: [[10 + (i % 7) * 3, [x, -20], "linear"], [10 + (i % 7) * 3 + d, [x + ((i % 3) - 1) * 30, 320]]],
      r: [[0, 0, "linear"], [120, (i % 2 ? 1 : -1) * 720]],
    });
  });
  return anim("Vitória", 130, [
    layer("raios", [group([star(18, 170, 50), fill("#ffd75a", 30)])], { r: [[0, 0, "linear"], [130, 120]], s: pop(10, 110, 100) }),
    layer("coroa", [
      group([path([[-70, 40], [-80, -40], [-40, -5], [0, -60], [40, -5], [80, -40], [70, 40]]), fill("#f2b632"), stroke("#5a3a05", 6)]),
      group([rect(140, 22, 4, [0, 44]), fill("#d99a1c"), stroke("#5a3a05", 5)]),
      group([ellipse(16, 16, [0, 44]), fill("#c21934")]),
      group([ellipse(12, 12, [-40, 44]), fill("#2c62cc")]),
      group([ellipse(12, 12, [40, 44]), fill("#14954f")]),
      group([ellipse(12, 12, [0, -60]), fill("#fff6c8")]),
      group([ellipse(10, 10, [-80, -40]), fill("#fff6c8")]),
      group([ellipse(10, 10, [80, -40]), fill("#fff6c8")]),
    ], {
      p: [[0, [150, -80], "in"], [24, [150, 150], "out"], [32, [150, 136], "in"], [40, [150, 150]]],
      s: [[24, [100, 100], "out"], [28, [112, 88], "inOut"], [36, [100, 100]]],
    }),
    ...confetti,
    ...sparkles(8, 26, 40, 140, "#fff6c8", 14, 40),
  ]);
}

function tesouro() {
  layerIdx = 0;
  const coins = Array.from({ length: 9 }, (_, i) => {
    const dx = (i - 4) * 26;
    const peak = 60 + (i % 3) * 20;
    return layer(`moeda${i}`, [group([ellipse(30, 30), fill("#f2b632"), stroke("#7a4b05", 3)]), group([ellipse(16, 16), stroke("#ffe08a", 2)])], {
      p: [[i * 2, [150, 220], "out"], [i * 2 + 24, [150 + dx, peak], "in"], [i * 2 + 56, [150 + dx * 1.4, 330]]],
      s: [[i * 2, [100, 100], "linear"], [i * 2 + 10, [30, 100], "linear"], [i * 2 + 20, [100, 100], "linear"], [i * 2 + 30, [30, 100], "linear"], [i * 2 + 40, [100, 100]]],
    });
  });
  return anim("Tesouro", 90, [
    layer("brilho", [group([star(12, 110, 30), fill("#ffe08a", 40)])], { p: [150, 210], s: pop(0, 110, 90), o: fadeOut(20, 60) }),
    ...coins,
    ...sparkles(6, 10, 20, 110, "#fff6c8", 10, 40),
  ]);
}

function fuga() {
  layerIdx = 0;
  const dust = Array.from({ length: 5 }, (_, i) =>
    layer(`poeira${i}`, [group([ellipse(40), fill("#9b8a72", 70)])], {
      p: [[i * 6, [200 - i * 10, 210], "out"], [i * 6 + 40, [80 - i * 20, 190 - (i % 2) * 20]]],
      s: [[i * 6, [30, 30], "out"], [i * 6 + 40, [150, 150]]],
      o: fadeOut(i * 6, i * 6 + 40, 80),
    }),
  );
  const lines = [0, 1, 2].map((i) =>
    layer(`vento${i}`, [group([path([[-60, 0], [60, 0]], false), stroke("#e8dcc4", 5), trim([[i * 4, 0, "out"], [i * 4 + 18, 100]], [[i * 4 + 10, 0, "out"], [i * 4 + 30, 100]])])], {
      p: [130, 130 + i * 30],
    }),
  );
  return anim("Fuga", 70, [
    ...dust,
    ...lines,
    layer("pé", [group([curve([[-14, 20], [-18, -10, 0, 10, 0, -14], [0, -26, -10, 0, 10, 0], [16, -8, 0, -12, 0, 12], [10, 22, 6, 0, -6, 0]]), fill("#3a2a1a")])], {
      p: [[0, [210, 170], "out"], [50, [60, 170]]],
      r: [[0, -10, "inOut"], [25, 10, "inOut"], [50, -10]],
      o: fadeInOut(0, 4, 50, 66),
    }),
  ]);
}

const out = join(process.cwd(), "public", "animacoes");
mkdirSync(out, { recursive: true });
const all: Record<string, unknown> = {
  nivel: nivel(),
  combate: combate(),
  vitoria: vitoria(),
  morte: morte(),
  maldicao: maldicao(),
  runa: runa(),
  fim: fim(),
  tesouro: tesouro(),
  fuga: fuga(),
};
for (const [name, data] of Object.entries(all)) writeFileSync(join(out, `${name}.json`), JSON.stringify(data));
console.log(`✅ ${Object.keys(all).length} animações geradas em public/animacoes/`);
