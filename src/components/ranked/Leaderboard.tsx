export interface LeaderRow {
  rank: number;
  username: string;
  rating: number;
  games: number;
}

/** Tabela do ranking (rating estilo Elo; só quem já terminou as 5 partidas de colocação). */
export function Leaderboard({ rows, me, className = "" }: { rows: LeaderRow[]; me?: string; className?: string }) {
  return (
    <section className={`rounded-xl border border-edge bg-panel p-4 ${className}`}>
      <h2 className="mb-3 font-display text-lg text-gold-2">🏆 Ranking</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Ninguém terminou as 5 partidas de colocação ainda. Seja o primeiro!</p>
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
              <span className="text-xs text-muted">{r.games} partidas</span>
              <span className="w-12 text-right font-mono text-ink">{r.rating}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
