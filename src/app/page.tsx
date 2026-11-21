import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Leaderboard } from "@/components/ranked/Leaderboard";
import { getCurrentUser } from "@/lib/auth";
import { leaderboard } from "@/lib/ranked";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/lobby");
  const rows = await leaderboard(20).catch(() => []);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-10">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <section>
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Jogo de cartas online</p>
          <h1 className="mt-2 font-display text-5xl leading-tight text-ink">Dhjulian&apos;s Game</h1>
          <p className="mt-4 text-muted">
            Chute portas, enfrente monstros, roube tesouros dos amigos e seja o primeiro a chegar ao{" "}
            <span className="text-gold-2">nível 20</span>. De 3 a 9 jogadores, em tempo real.
          </p>
          <a
            href="/local"
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-gold/60 px-4 py-2 text-sm text-gold-2 hover:bg-gold/10"
          >
            🤖 Jogar local contra bots (sem conta)
          </a>
          <ul className="mt-6 space-y-2 text-sm text-muted">
            <li>⚔️ 60 monstros, 17 raças e 16 classes com habilidades únicas</li>
            <li>🧪 Itens, runas, poções e 33 maldições</li>
            <li>🔁 Caiu a conexão? Entre de novo e continue de onde parou</li>
            <li>🏆 Modo ranqueado com rating estilo xadrez e ranking</li>
          </ul>
        </section>
        <AuthForm />
      </div>
      <Leaderboard rows={rows} className="w-full max-w-4xl" />
    </main>
  );
}
