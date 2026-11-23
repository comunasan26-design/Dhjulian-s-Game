import "server-only";
// Modo ranqueado: fila com pareamento por rating, criação da partida de 6 (completando com bots)
// e aplicação do rating no fim. As contas do rating ficam em ./rating.ts.
import type { Prisma } from "@/generated/prisma/client";
import { botName } from "@/game/bot/ai";
import { createGame, type GameState } from "@/game/engine";
import { USER_ONLINE_MS } from "./auth";
import { db } from "./db";
import { HttpError } from "./http";
import {
  RANKED_SIZE,
  type RatedPlayer,
  botRating,
  botSkillFor,
  finalPositions,
  queueWindow,
  ratingChanges,
} from "./rating";
import { makeCode, serverCtx } from "./rooms";

/** Quem não dá sinal de vida na fila há esse tempo sai dela. */
const QUEUE_STALE_MS = 15_000;
/** Depois desse tempo na fila, a sala é completada com bots. */
const FILL_WITH_BOTS_MS = 60_000;

export interface QueueStatus {
  status: "idle" | "searching" | "matched";
  code?: string;
  elapsedMs?: number;
  /** Diferença de rating aceita agora (±). */
  window?: number;
  online: number;
  searching: number;
}

/** Um pareamento por vez (o servidor é um processo só). */
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

interface MatchPlayer {
  id: string;
  name: string;
  bot: boolean;
  rating: number;
  games: number;
  skill?: number;
}

async function counts(now = Date.now()): Promise<{ online: number; searching: number }> {
  const [online, searching] = await Promise.all([
    db().user.count({ where: { lastSeenAt: { gte: new Date(now - USER_ONLINE_MS) } } }),
    db().rankedQueue.count({ where: { roomCode: null, lastSeenAt: { gte: new Date(now - QUEUE_STALE_MS) } } }),
  ]);
  return { online, searching };
}

/** Partida ranqueada em andamento em que o usuário ainda está na mesa (para reconectar). */
async function activeRankedRoom(userId: string): Promise<string | null> {
  const rooms = await db().room.findMany({
    where: { ranked: true, status: "PLAYING", players: { some: { userId } } },
    select: { code: true, state: true },
  });
  for (const r of rooms) {
    const state = r.state as unknown as GameState | null;
    if (state && state.phase !== "FINISHED" && state.players.some((p) => p.id === userId)) return r.code;
  }
  return null;
}

export async function joinQueue(userId: string): Promise<QueueStatus> {
  const active = await activeRankedRoom(userId);
  if (active) return { status: "matched", code: active, ...(await counts()) };
  const user = await db().user.findUnique({ where: { id: userId }, select: { rating: true } });
  if (!user) throw new HttpError(401, "Você precisa estar logado.");
  const now = new Date();
  await db().rankedQueue.upsert({
    where: { userId },
    create: { userId, rating: user.rating, joinedAt: now, lastSeenAt: now },
    update: { rating: user.rating, joinedAt: now, lastSeenAt: now, roomCode: null },
  });
  return pollQueue(userId);
}

export async function leaveQueue(userId: string): Promise<void> {
  await db().rankedQueue.deleteMany({ where: { userId, roomCode: null } });
}

export async function pollQueue(userId: string): Promise<QueueStatus> {
  const read = () => db().rankedQueue.findUnique({ where: { userId } });
  let row = await read();
  if (!row) return { status: "idle", ...(await counts()) };
  if (!row.roomCode) {
    await db().rankedQueue.update({ where: { userId }, data: { lastSeenAt: new Date() } });
    await withLock(matchmake);
    row = await read();
    if (!row) return { status: "idle", ...(await counts()) };
  }
  if (row.roomCode) {
    await db().rankedQueue.delete({ where: { userId } }).catch(() => undefined);
    return { status: "matched", code: row.roomCode, ...(await counts()) };
  }
  const elapsedMs = Date.now() - row.joinedAt.getTime();
  return { status: "searching", elapsedMs, window: elapsedMs < 30_000 ? 100 : 250, ...(await counts()) };
}

/**
 * Pareamento: começa por quem espera há mais tempo e junta os de rating mais parecido dentro da janela
 * (±100 até 30 s, ±250 até 60 s). Fecha a sala com 6 humanos ou, depois de 60 s, completa com bots.
 */
async function matchmake(): Promise<void> {
  const now = Date.now();
  await db().rankedQueue.deleteMany({ where: { roomCode: null, lastSeenAt: { lt: new Date(now - QUEUE_STALE_MS) } } });
  await db().rankedQueue.deleteMany({ where: { roomCode: { not: null }, lastSeenAt: { lt: new Date(now - 5 * 60_000) } } });
  const waiting = await db().rankedQueue.findMany({ where: { roomCode: null }, orderBy: { joinedAt: "asc" } });
  const used = new Set<string>();
  for (const anchor of waiting) {
    if (used.has(anchor.userId)) continue;
    const wait = now - anchor.joinedAt.getTime();
    const win = Math.min(250, queueWindow(wait));
    const group = waiting
      .filter((w) => !used.has(w.userId) && Math.abs(w.rating - anchor.rating) <= win)
      .sort((a, b) => Math.abs(a.rating - anchor.rating) - Math.abs(b.rating - anchor.rating) || a.joinedAt.getTime() - b.joinedAt.getTime())
      .slice(0, RANKED_SIZE);
    if (group.length < RANKED_SIZE && wait < FILL_WITH_BOTS_MS) continue;
    const code = await createMatch(group.map((g) => g.userId));
    for (const g of group) used.add(g.userId);
    await db().rankedQueue.updateMany({ where: { userId: { in: group.map((g) => g.userId) } }, data: { roomCode: code, lastSeenAt: new Date() } });
  }
}

/** Cria a sala ranqueada já em jogo, com os humanos do grupo e bots até completar 6. */
async function createMatch(userIds: string[]): Promise<string> {
  const users = await db().user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, rating: true, rankedGames: true } });
  const skill = botSkillFor(users.map((u) => u.rating));
  const nBots = RANKED_SIZE - users.length;
  const players: MatchPlayer[] = [
    ...users.map((u) => ({ id: u.id, name: u.username, bot: false, rating: u.rating, games: u.rankedGames })),
    ...Array.from({ length: nBots }, (_, i) => ({ id: `bot-${i + 1}`, name: botName(i), bot: true, rating: botRating(skill), games: 0, skill })),
  ];
  const host = users[0].id;
  const state = createGame(
    players.map((p) => ({ id: p.id, name: p.name, bot: p.bot, skill: p.skill })),
    host,
    serverCtx(),
  );
  for (let i = 0; i < 8; i++) {
    const code = makeCode();
    try {
      await db().room.create({
        data: {
          code,
          name: "Partida ranqueada",
          ranked: true,
          status: "PLAYING",
          maxPlayers: RANKED_SIZE,
          bots: nBots,
          botSkill: skill,
          hostId: host,
          state: state as unknown as Prisma.InputJsonValue,
          players: { create: users.map((u, seat) => ({ userId: u.id, seat })) },
        },
      });
      await db().rankedMatch.create({
        data: { roomCode: code, counted: true, botSkill: skill, players: players as unknown as Prisma.InputJsonValue },
      });
      return code;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  throw new HttpError(500, "Não foi possível criar a partida ranqueada.");
}

/**
 * Fim de uma partida ranqueada: calcula as colocações, aplica o rating (com os ratings de ANTES da partida)
 * e guarda o resultado e o log humano x bot. Só roda uma vez por partida.
 */
export async function finalizeRanked(roomId: string, state: GameState): Promise<void> {
  if (state.phase !== "FINISHED") return;
  const room = await db().room.findUnique({ where: { id: roomId }, select: { code: true, ranked: true } });
  if (!room?.ranked) return;
  const match = await db().rankedMatch.findUnique({ where: { roomCode: room.code } });
  if (!match || match.finishedAt) return;
  const claim = await db().rankedMatch.updateMany({ where: { id: match.id, finishedAt: null }, data: { finishedAt: new Date() } });
  if (claim.count !== 1) return;

  const players = match.players as unknown as MatchPlayer[];
  const ids = players.map((p) => p.id);
  const positions = finalPositions(state, ids);
  const left = new Set((state.leftPlayers ?? []).map((p) => p.id));
  const rated: RatedPlayer[] = players.map((p) => ({
    id: p.id,
    bot: p.bot,
    rating: p.rating,
    games: p.games,
    position: positions.get(p.id) ?? RANKED_SIZE,
    abandoned: left.has(p.id),
  }));
  const changes = match.counted ? ratingChanges(rated) : [];
  const byId = new Map(changes.map((c) => [c.id, c]));
  // log humano x bot (para recalibrar a tabela de ratings dos bots depois)
  const duels = rated
    .filter((h) => !h.bot)
    .flatMap((h) =>
      rated
        .filter((b) => b.bot)
        .map((b) => ({
          human: h.id,
          humanRating: h.rating,
          botSkill: players.find((p) => p.id === b.id)?.skill ?? match.botSkill,
          botRating: b.rating,
          score: h.position < b.position ? 1 : h.position === b.position ? 0.5 : 0,
        })),
    );
  for (const h of rated.filter((p) => !p.bot)) {
    const ch = byId.get(h.id);
    const exists = await db().user.findUnique({ where: { id: h.id }, select: { id: true } });
    if (!exists) continue;
    if (ch) await db().user.update({ where: { id: h.id }, data: { rating: ch.after, rankedGames: { increment: 1 } } });
    await db().rankedResult.create({
      data: {
        matchId: match.id,
        userId: h.id,
        position: h.position,
        ratingBefore: h.rating,
        ratingAfter: ch?.after ?? h.rating,
        delta: ch?.delta ?? 0,
        abandoned: h.abandoned,
      },
    });
  }
  await db().rankedMatch.update({
    where: { id: match.id },
    data: {
      results: {
        counted: match.counted,
        winnerId: state.winnerId ?? null,
        positions: Object.fromEntries(positions),
        changes,
        duels,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface LeaderRow {
  rank: number;
  username: string;
  rating: number;
  games: number;
}

/** Ranking: todo mundo que já terminou pelo menos 1 ranqueada (o rating conta desde a primeira; provisório até a 5ª). */
export async function leaderboard(limit = 50): Promise<LeaderRow[]> {
  const rows = await db().user.findMany({
    where: { rankedGames: { gte: 1 } },
    orderBy: [{ rating: "desc" }, { rankedGames: "desc" }],
    take: limit,
    select: { username: true, rating: true, rankedGames: true },
  });
  return rows.map((r, i) => ({ rank: i + 1, username: r.username, rating: Math.round(r.rating), games: r.rankedGames }));
}

/** Resultado do usuário numa partida ranqueada (para a tela final). */
export async function myRankedResult(code: string, userId: string) {
  const match = await db().rankedMatch.findUnique({ where: { roomCode: code.toUpperCase() }, select: { id: true, counted: true, finishedAt: true } });
  if (!match) return null;
  const res = await db().rankedResult.findFirst({ where: { matchId: match.id, userId } });
  const user = await db().user.findUnique({ where: { id: userId }, select: { rating: true, rankedGames: true } });
  return {
    counted: match.counted,
    finished: !!match.finishedAt,
    position: res?.position ?? null,
    delta: res?.delta ?? null,
    rating: user?.rating ?? null,
    games: user?.rankedGames ?? 0,
  };
}
