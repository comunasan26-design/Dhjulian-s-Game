import { RatingValue } from "./RatingValue";

export interface LeaderRow {
  rank: number;
  username: string;
  rating: number;
  games: number;
}

/** Tabela do ranking (rating estilo Elo; "?" = ainda nas partidas de colocação). */
export function Leaderboard({ rows, me, className = "" }: { rows: LeaderRow[]; me?: string; className?: string }) {
  return (
    <section className={`rounded-xl border border-edge bg-panel p-4 ${className}`}>
      <h2 className="mb-3 font-display text-lg text-gold-2">🏆 Ranking</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Ninguém terminou uma partida ranqueada ainda. Seja o primeiro!</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {rows.map((r) => (
            <li
              key={r.username}
              className={`flex items-center gap-3 rounded-md px-2 py-1 ${r.username === me ? "bg-gold/15 text-gold-2" : "odd:bg-panel-2/60"}`}
            >
              <span className={`w-7 text-right font-mono ${r.rank <= 3 ? "text-gold-2" : "text-muted"}`}>
                {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `${r.rank}.`}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.username}</span>
              <span className="text-xs text-muted">{r.games} {r.games === 1 ? "partida" : "partidas"}</span>
              <RatingValue rating={r.rating} games={r.games} self={r.username === me} className="inline-block w-14 text-right text-ink" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
