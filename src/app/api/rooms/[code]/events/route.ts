import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ONLINE_WINDOW_MS, deadlineOf, loadRoom, payloadFor, tickRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";
// Cada conexão SSE vive no máximo ~55s; o EventSource do navegador reconecta sozinho.
export const maxDuration = 60;

const POLL_MS = 700;
const LIFETIME_MS = 50_000;
const PRESENCE_MS = 8_000;

/**
 * Stream de eventos (Server-Sent Events) de uma sala.
 * Funciona em ambiente serverless (Vercel): consulta a versão da sala no Postgres
 * e envia o estado filtrado para o jogador sempre que algo muda.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const { code } = await ctx.params;
  let room;
  try {
    room = await loadRoom(code);
  } catch {
    return new Response("Sala não encontrada", { status: 404 });
  }
  if (!room.players.some((p) => p.userId === user.id)) return new Response("Você não está nesta sala", { status: 403 });
  const roomId = room.id;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      req.signal.addEventListener("abort", () => {
        closed = true;
      });

      const started = Date.now();
      let lastVersion = -1;
      let lastPresence = "";
      let lastTouch = 0;
      let lastPing = Date.now();
      let deadline: number | null = null;

      send("hello", { retry: 1500 });
      while (!closed && Date.now() - started < LIFETIME_MS) {
        try {
          const now = Date.now();
          if (now - lastTouch > PRESENCE_MS) {
            lastTouch = now;
            await db().roomPlayer.updateMany({ where: { roomId, userId: user.id }, data: { lastSeenAt: new Date() } });
          }
          const head = await db().room.findUnique({
            where: { id: roomId },
            select: { version: true, players: { select: { userId: true, lastSeenAt: true } } },
          });
          if (!head) {
            send("gone", {});
            break;
          }
          if (!head.players.some((p) => p.userId === user.id)) {
            send("kicked", {});
            break;
          }
          const presence = head.players
            .filter((p) => now - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS)
            .map((p) => p.userId)
            .sort()
            .join(",");
          if (head.version !== lastVersion) {
            const full = await loadRoom(code);
            lastVersion = full.version;
            lastPresence = presence;
            deadline = deadlineOf(full.state);
            send("state", payloadFor(full, user.id));
          } else if (presence !== lastPresence) {
            lastPresence = presence;
            send("presence", { online: presence ? presence.split(",") : [] });
          } else if (now - lastPing > 15_000) {
            lastPing = now;
            controller.enqueue(encoder.encode(`: ping\n\n`));
          }
          // Prazos vencidos (janela de reação, prompts) são processados aqui
          if (deadline !== null && deadline <= Date.now()) {
            const full = await loadRoom(code);
            const online = new Set(presence ? presence.split(",") : []);
            const offline = new Set(full.players.map((p) => p.userId).filter((id) => !online.has(id)));
            await tickRoom(full.id, full.version, full.state, offline);
            deadline = null;
          }
        } catch (err) {
          console.error("SSE loop", err);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      send("reconnect", {});
      try {
        controller.close();
      } catch {
        // já fechado
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
