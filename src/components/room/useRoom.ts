"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/game/engine";
import type { RoomPayload } from "./types";

export type ConnState = "connecting" | "online" | "reconnecting" | "offline";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? `Erro ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

/**
 * Mantém a sala sincronizada em tempo real (SSE com reconexão automática)
 * e expõe `act` para enviar ações.
 */
export function useRoom(code: string) {
  const router = useRouter();
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [busy, setBusy] = useState(false);
  const versionRef = useRef(-1);
  const lastEventRef = useRef(0);
  const [streamKey, setStreamKey] = useState(0);

  const accept = useCallback((p: RoomPayload) => {
    if (p.room.version >= versionRef.current) {
      versionRef.current = p.room.version;
      setPayload(p);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const p = await api<RoomPayload>(`/api/rooms/${code}`);
      setNeedsJoin(false);
      accept(p);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) setNeedsJoin(true);
      else if (status === 404) setFatal("Sala não encontrada.");
      else if (status === 401) router.replace("/");
    }
  }, [code, accept, router]);

  // Carga inicial
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Stream de eventos
  useEffect(() => {
    if (needsJoin || fatal) return;
    const es = new EventSource(`/api/rooms/${code}/events`);
    const touch = () => {
      lastEventRef.current = Date.now();
    };
    es.addEventListener("hello", () => {
      touch();
      setConn("online");
    });
    es.addEventListener("state", (ev) => {
      touch();
      setConn("online");
      accept(JSON.parse((ev as MessageEvent).data) as RoomPayload);
    });
    es.addEventListener("presence", (ev) => {
      touch();
      const { online } = JSON.parse((ev as MessageEvent).data) as { online: string[] };
      setPayload((prev) => {
        if (!prev) return prev;
        const set = new Set(online);
        return {
          room: { ...prev.room, players: prev.room.players.map((p) => ({ ...p, online: set.has(p.id) })) },
          game: prev.game ? { ...prev.game, players: prev.game.players.map((p) => ({ ...p, online: set.has(p.id) })) } : null,
        };
      });
    });
    es.addEventListener("kicked", () => {
      setNeedsJoin(true);
      es.close();
    });
    es.addEventListener("gone", () => {
      setFatal("A sala foi encerrada.");
      es.close();
    });
    es.addEventListener("reconnect", () => {
      touch();
    });
    es.onerror = () => {
      setConn(navigator.onLine ? "reconnecting" : "offline");
    };
    return () => es.close();
  }, [code, needsJoin, fatal, accept, streamKey]);

  // Vigia: se o stream ficar mudo, recria a conexão e ressincroniza
  useEffect(() => {
    lastEventRef.current = Date.now();
    const t = setInterval(() => {
      if (Date.now() - lastEventRef.current > 25_000) {
        lastEventRef.current = Date.now();
        setConn("reconnecting");
        setStreamKey((k) => k + 1);
        void refresh();
      }
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => {
      setStreamKey((k) => k + 1);
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  const act = useCallback(
    async (action: Action): Promise<boolean> => {
      setBusy(true);
      try {
        const p = await api<RoomPayload>(`/api/rooms/${code}/action`, { method: "POST", body: JSON.stringify({ action }) });
        accept(p);
        return true;
      } catch (e) {
        if (action.type !== "TICK") setToast((e as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, accept],
  );

  const roomCall = useCallback(
    async (path: "join" | "leave" | "start" | "kick" | "bots", body?: unknown) => {
      setBusy(true);
      try {
        const p = await api<RoomPayload | { ok: boolean }>(`/api/rooms/${code}/${path}`, {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        });
        if ("room" in p) {
          accept(p);
          setNeedsJoin(false);
        }
        return true;
      } catch (e) {
        setToast((e as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, accept],
  );

  return { payload, needsJoin, fatal, toast, setToast, conn, busy, act, roomCall, refresh };
}
