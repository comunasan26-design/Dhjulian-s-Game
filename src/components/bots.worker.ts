// Web Worker do modo local: a IA dos bots pensa aqui, fora da linha da interface
// (no celular, cada decisão travava a tela por centenas de milissegundos).
import { stepBots } from "@/game/bot/ai";
import { type Ctx, type GameState, tick } from "@/game/engine";

interface Request {
  id: number;
  state: GameState;
  now: number;
}

const rng = {
  int: (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  },
};

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, state, now } = e.data;
  const ctx: Ctx = { now, rng };
  let changed = false;
  try {
    changed = tick(state, ctx) || stepBots(state, ctx);
  } catch (err) {
    console.error("bots (worker)", err);
  }
  (self as unknown as Worker).postMessage({ id, changed, state: changed ? state : null });
};
