"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível continuar.");
      router.replace("/lobby");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-edge bg-panel/90 p-6 shadow-xl">
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-edge bg-bg p-1 text-sm">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-md py-2 transition ${mode === m ? "bg-panel-2 text-gold-2" : "text-muted hover:text-ink"}`}
          >
            {m === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      <label className="block text-sm text-muted">
        Usuário
        <input
          className="mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-ink outline-none focus:border-gold"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          maxLength={20}
          required
        />
      </label>
      <label className="mt-4 block text-sm text-muted">
        Senha
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-ink outline-none focus:border-gold"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </label>
      {mode === "register" && <p className="mt-2 text-xs text-muted">3 a 20 caracteres no usuário; senha com 6 ou mais.</p>}
      {error && <p className="mt-4 rounded-md border border-blood/50 bg-blood/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={loading}>
        {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta e entrar"}
      </Button>
    </form>
  );
}
