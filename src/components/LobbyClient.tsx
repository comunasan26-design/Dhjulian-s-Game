"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { SkillSelect } from "./SkillSelect";
import { Leaderboard, type LeaderRow } from "./ranked/Leaderboard";
import { RankedPanel } from "./ranked/RankedPanel";

interface RoomRow {
  code: string;
  name: string;
  status: "LOBBY" | "PLAYING" | "FINISHED";
  host: string;
  players: number;
  online: number;
  maxPlayers: number;
  isMember: boolean;
}

export function LobbyClient({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<RoomRow[]>([]);
  const [mine, setMine] = useState<RoomRow[]>([]);
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [botSkill, setBotSkill] = useState(20);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/rooms", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    const data = await res.json();
    setOpen(data.open ?? []);
    setMine(data.mine ?? []);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const get = () =>
      fetch("/api/ranked/leaderboard", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setLeaders(d.rows ?? []));
    void get();
    const t = setInterval(get, 30_000);
    return () => clearInterval(t);
  }, []);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, maxPlayers, botSkill }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Erro ao criar sala.");
    router.push(`/sala/${data.code}`);
  }

  async function join(c: string) {
    setError(null);
    const clean = c.trim().toUpperCase();
    if (!clean) return;
    const res = await fetch(`/api/rooms/${clean}/join`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Não foi possível entrar.");
    router.push(`/sala/${clean}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold-2">Dhjulian&apos;s Game</h1>
          <p className="text-sm text-muted">
            Olá, <span className="text-ink">{username}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/local" className="rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-ink">
            🤖 Partida local
          </Link>
          <Link href="/regras" className="rounded-md border border-edge px-3 py-1.5 text-sm text-muted hover:text-ink">
            📖 Regras e cartas
          </Link>
          <Button variant="ghost" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>

      {error && <p className="mb-4 rounded-md border border-blood/50 bg-blood/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {mine.length > 0 && (
        <section className="mb-6 rounded-xl border border-gold/40 bg-panel p-4">
          <h2 className="mb-3 font-display text-lg text-gold-2">Suas salas (reconectar)</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {mine.map((r) => (
              <Link
                key={r.code}
                href={`/sala/${r.code}`}
                className="flex items-center justify-between rounded-lg border border-edge bg-panel-2 px-3 py-2 hover:border-gold"
              >
                <span>
                  <span className="font-medium">{r.name}</span>{" "}
                  <span className="text-xs text-muted">
                    {r.code} · {r.status === "PLAYING" ? "em jogo" : "aguardando"} · {r.online}/{r.players} online
                  </span>
                </span>
                <span className="text-gold">Entrar →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="space-y-4">
          <RankedPanel />
          <form onSubmit={createRoom} className="rounded-xl border border-edge bg-panel p-4">
            <h2 className="mb-3 font-display text-lg text-gold-2">Criar sala</h2>
            <input
              className="w-full rounded-md border border-edge bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
              placeholder={`Mesa de ${username}`}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="mt-3 flex items-center justify-between text-sm text-muted">
              Máximo de jogadores
              <select
                className="rounded-md border border-edge bg-bg px-2 py-1 text-ink"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <SkillSelect className="mt-3" value={botSkill} onChange={setBotSkill} />
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={loading}>
              Criar e entrar
            </Button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void join(code);
            }}
            className="rounded-xl border border-edge bg-panel p-4"
          >
            <h2 className="mb-3 font-display text-lg text-gold-2">Entrar com código</h2>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-edge bg-bg px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-gold"
                placeholder="ABCDE"
                value={code}
                maxLength={8}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit">Entrar</Button>
            </div>
          </form>
        </section>

        <div className="space-y-6">
        <section className="rounded-xl border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-gold-2">Salas abertas</h2>
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              ↻ Atualizar
            </Button>
          </div>
          {open.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nenhuma sala aguardando jogadores. Crie a sua!</p>
          ) : (
            <ul className="space-y-2">
              {open.map((r) => (
                <li key={r.code} className="flex items-center justify-between rounded-lg border border-edge bg-panel-2 px-3 py-2">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">
                      {r.code} · anfitrião {r.host} · {r.players}/{r.maxPlayers} jogadores
                    </p>
                  </div>
                  <Button size="sm" variant={r.isMember ? "secondary" : "primary"} onClick={() => void join(r.code)} disabled={!r.isMember && r.players >= r.maxPlayers}>
                    {r.isMember ? "Voltar" : r.players >= r.maxPlayers ? "Cheia" : "Entrar"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Leaderboard rows={leaders} me={username} />
        </div>
      </div>
    </main>
  );
}
