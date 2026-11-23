import { PLACEMENT_GAMES } from "@/lib/rating";

/**
 * Rating arredondado. Nas primeiras partidas ranqueadas (antes de concluir as de colocação) o rating já conta,
 * mas aparece com um "?" — passar o mouse (ou tocar) explica que ainda não é definitivo.
 */
export function RatingValue({ rating, games, self = false, className = "" }: { rating: number; games: number; self?: boolean; className?: string }) {
  const provisional = games < PLACEMENT_GAMES;
  const tip = `${self ? "Você ainda não concluiu" : "Este jogador ainda não concluiu"} todas as ${PLACEMENT_GAMES} partidas de colocação (${games}/${PLACEMENT_GAMES}) para ter um rating definitivo.`;
  return (
    <span className={`font-mono ${className}`}>
      {Math.round(rating)}
      {provisional && (
        <span tabIndex={0} aria-label={tip} className="group relative ml-0.5 cursor-help text-amber-300 outline-none">
          ?
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-56 rounded-md border border-edge bg-panel-2 px-2 py-1.5 text-left font-sans text-xs font-normal text-ink shadow-xl group-hover:block group-focus:block"
          >
            {tip}
          </span>
        </span>
      )}
    </span>
  );
}
