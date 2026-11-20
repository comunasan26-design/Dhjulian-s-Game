import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { botName, stepBots } from "@/game/bot/ai";
import { type Action, applyAction, createGame, type Ctx, type GameState, type GameView, nextDeadline, tick, viewFor } from "@/game/engine";
import { db } from "./db";
import { HttpError } from "./http";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 9;
/** Um jogador é considerado online se deu sinal de vida nos últimos N ms. */
export const ONLINE_WINDOW_MS = 25_000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export function serverCtx(offline?: Set<string>): Ctx {
  return { now: Date.now(), rng: { int: (max: number) => randomInt(max) }, offline };
}

const roomInclude = {
  players: { include: { user: { select: { id: true, username: true } } }, orderBy: { seat: "asc" } },
} satisfies Prisma.RoomInclude;

export type RoomWithPlayers = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

export async function loadRoom(code: string): Promise<RoomWithPlayers> {
  const room = await db().room.findUnique({ where: { code: code.toUpperCase() }, include: roomInclude });
  if (!room) throw new HttpError(404, "Sala não encontrada.");
  return room;
}

export function onlineSet(room: RoomWithPlayers, now = Date.now()): Set<string> {
  return new Set(room.players.filter((p) => now - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS).map((p) => p.userId));
}

export interface RoomInfo {
  code: string;
  name: string;
  status: "LOBBY" | "PLAYING" | "FINISHED";
  hostId: string;
  maxPlayers: number;
  bots: number;
  version: number;
  players: { id: string; username: string; seat: number; online: boolean }[];
}

export interface RoomPayload {
  room: RoomInfo;
  game: GameView | null;
}

export function roomInfo(room: RoomWithPlayers): RoomInfo {
  const online = onlineSet(room);
  return {
    code: room.code,
    name: room.name,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    bots: room.bots,
    version: room.version,
    players: room.players.map((p) => ({ id: p.userId, username: p.user.username, seat: p.seat, online: online.has(p.userId) })),
  };
}

export function payloadFor(room: RoomWithPlayers, userId: string): RoomPayload {
  const info = roomInfo(room);
  const state = room.state as unknown as GameState | null;
  const online = new Set(info.players.filter((p) => p.online).map((p) => p.id));
  online.add(userId);
  return {
    room: info,
    game: state ? viewFor(state, userId, Date.now(), online) : null,
  };
}

export function assertMember(room: RoomWithPlayers, userId: string) {
  if (!room.players.some((p) => p.userId === userId)) throw new HttpError(403, "Você não está nesta sala.");
}

export async function touchPresence(roomId: string, userId: string) {
  await db()
    .roomPlayer.update({ where: { roomId_userId: { roomId, userId } }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
}

export async function bumpVersion(roomId: string) {
  await db().room.update({ where: { id: roomId }, data: { version: { increment: 1 } } });
}

/** Cria a partida a partir dos jogadores da sala. */
export async function startGame(code: string, userId: string): Promise<RoomWithPlayers> {
  const room = await loadRoom(code);
  if (room.hostId !== userId) throw new HttpError(403, "Só o anfitrião pode iniciar a partida.");
  if (room.status !== "LOBBY") throw new HttpError(400, "A partida já começou.");
  if (room.players.length + room.bots < MIN_PLAYERS)
    throw new HttpError(400, `São necessários pelo menos ${MIN_PLAYERS} jogadores (contando bots).`);
  const state = createGame(
    [
      ...room.players.map((p) => ({ id: p.userId, name: p.user.username })),
      ...Array.from({ length: room.bots }, (_, i) => ({ id: `bot-${i + 1}`, name: botName(i), bot: true })),
    ],
    room.hostId,
    serverCtx(),
  );
  const res = await db().room.updateMany({
    where: { id: room.id, version: room.version, status: "LOBBY" },
    data: { status: "PLAYING", state: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
  });
  if (res.count !== 1) throw new HttpError(409, "A sala mudou; tente de novo.");
  return loadRoom(code);
}

/**
 * Aplica uma ação ao jogo com controle de concorrência otimista (versão).
 */
export async function performAction(code: string, userId: string, action: Action): Promise<RoomWithPlayers> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const room = await loadRoom(code);
    assertMember(room, userId);
    if (!room.state) throw new HttpError(400, "A partida ainda não começou.");
    const state = structuredClone(room.state) as unknown as GameState;
    const online = onlineSet(room);
    online.add(userId);
    const offline = new Set(room.players.map((p) => p.userId).filter((id) => !online.has(id)));
    applyAction(state, userId, action, serverCtx(offline));
    const res = await db().room.updateMany({
      where: { id: room.id, version: room.version },
      data: {
        state: state as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        status: state.phase === "FINISHED" ? "FINISHED" : "PLAYING",
      },
    });
    if (res.count === 1) {
      await touchPresence(room.id, userId);
      return loadRoom(code);
    }
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
  }
  throw new HttpError(409, "Muitas ações ao mesmo tempo; tente de novo.");
}

/** Processa prazos vencidos (chamado pelo stream de eventos). Ignora conflitos. */
export async function tickRoom(roomId: string, version: number, stateJson: unknown, offline: Set<string>): Promise<boolean> {
  const state = structuredClone(stateJson) as GameState;
  const changed = tick(state, serverCtx(offline));
  if (!changed) return false;
  const res = await db().room.updateMany({
    where: { id: roomId, version },
    data: {
      state: state as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      status: state.phase === "FINISHED" ? "FINISHED" : "PLAYING",
    },
  });
  return res.count === 1;
}

export function deadlineOf(stateJson: unknown): number | null {
  if (!stateJson) return null;
  return nextDeadline(stateJson as GameState);
}

/** Deixa um bot agir (chamado pelo stream de eventos). Ignora conflitos de versão. */
export async function botStepRoom(roomId: string, version: number, stateJson: unknown, offline: Set<string>): Promise<boolean> {
  const state = structuredClone(stateJson) as GameState;
  const ctx = serverCtx(offline);
  const ticked = tick(state, ctx);
  const acted = stepBots(state, ctx);
  if (!ticked && !acted) return false;
  const res = await db().room.updateMany({
    where: { id: roomId, version },
    data: {
      state: state as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      status: state.phase === "FINISHED" ? "FINISHED" : "PLAYING",
    },
  });
  return res.count === 1;
}

export function botInfo(stateJson: unknown): { hasBots: boolean; nextAt: number; finished: boolean } {
  const s = stateJson as GameState | null;
  if (!s) return { hasBots: false, nextAt: 0, finished: false };
  return { hasBots: s.players.some((p) => p.bot), nextAt: s.botNextAt ?? 0, finished: s.phase === "FINISHED" };
}

/** Depois de desistir: o usuário sai da sala; se não sobrou nenhum humano, a sala é apagada. */
export async function leaveAfterSurrender(code: string, userId: string): Promise<{ closed: boolean }> {
  const room = await loadRoom(code);
  const state = room.state as unknown as GameState | null;
  if (state?.closed) {
    await db().room.delete({ where: { id: room.id } });
    return { closed: true };
  }
  await db().roomPlayer.deleteMany({ where: { roomId: room.id, userId } });
  if (room.hostId === userId && state) {
    const newHost = room.players.find((p) => p.userId !== userId);
    if (newHost) await db().room.update({ where: { id: room.id }, data: { hostId: newHost.userId } });
  }
  return { closed: false };
}
