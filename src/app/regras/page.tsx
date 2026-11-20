import Link from "next/link";
import { CardBrowser } from "@/components/CardBrowser";

export const metadata = { title: "Regras e cartas — Dhjulian's Game" };

const RULES: [string, string][] = [
  ["Objetivo", "Chegar ao nível 20. Do 19 para o 20, só derrotando um monstro: nenhuma habilidade, carta ou venda dá esse nível."],
  ["Início", "Todos começam no nível 1 com raça e classe aleatórias, 4 cartas de Porta e 4 de Tesouro. Na preparação, joguem raça, classe e itens da mão. Quem tirar o maior d6 começa; depois segue a ordem da mesa."],
  ["1. Chutar a porta", "Vire a carta do topo de Portas. Monstro: lute. Maldição: ela afeta você. Outra carta: vai para a sua mão."],
  ["2. Procurar encrenca", "Se a porta não trouxe monstro, você pode lutar com um monstro da sua mão."],
  ["3. Saquear a sala", "Se não lutou neste turno, compre 1 carta de Porta virada para baixo."],
  ["4. Caridade", "No fim do turno a mão pode ter no máximo 5 cartas (Humano 6, Anão 6/7, Bolsa Devoradora +2). O excesso vai para o jogador de menor nível; se o menor for você, descarte."],
  ["Combate", "Força = nível + itens equipados + modificadores. Para vencer, sua força precisa passar a soma dos monstros (empate: o monstro vence, exceto Guerreiro). Ao clicar em “Atacar”, os outros têm 60 segundos para interferir ou “Deixar passar”; cada carta ou ação que muda o combate reinicia o contador."],
  ["Ajuda", "Peça ajuda a 1 jogador (ou aceite uma oferta) combinando quantos tesouros ele leva e como dividir: aleatório, quem luta decide, ou ajudante escolhe primeiro. O ajudante não ganha nível (exceto o Elfo)."],
  ["Fugir", "Role 1d6: sucesso com 5+ (somando bônus de Fugir). Role para cada monstro; cada falha aplica as Coisas Ruins dele. O ajudante também rola."],
  ["Recompensa", "Quem vence sobe os níveis da carta e compra os tesouros: virados para baixo se lutou sozinho, abertos se teve ajuda."],
  ["Morte", "Você perde todos os itens e a mão, mas mantém nível, raça e classe. Do maior nível para o menor, cada jogador pega 1 item seu. No seu próximo turno, receba 4 Portas e 4 Tesouros."],
  ["Itens", "Equipar só no seu turno e fora de combate. Itens na mesa não equipados não dão bônus. Só 1 item Grande (Gigante 2; Anão e Fada nenhum) e 1 Lendário equipado. Vender: 1.000 de ouro = 1 nível, só no seu turno e fora de combate."],
  ["A qualquer momento", "Maldições, poções, cartas de subir nível e bônus de monstro podem ser jogados a qualquer momento, até no turno dos outros. Trocas de itens: a qualquer momento, menos durante um combate."],
  ["Ameaçar atrapalhar", "Fora do combate, você pode pedir tesouros a quem está lutando para não atrapalhar. Se ele aceitar, você recebe os tesouros quando ele vencer e não pode atrapalhá-lo pelo resto da rodada."],
  ["Desistir", "Conta como morte (os outros saqueiam seus itens) e você sai da partida. Se só sobrarem bots, a sala fecha; se sobrar um jogador, ele vence."],
  ["Bots", "Na sala de espera o anfitrião pode adicionar bots. Eles jogam para vencer: equipam o melhor que têm, montam combos, atrapalham humanos e quem está na liderança, preferem se aliar a outros bots e negociam itens exclusivos da sua raça/classe. No modo local você joga só contra bots, sem conta e sem servidor."],
  ["Reconexão", "Caiu a internet ou fechou a aba? Entre de novo pelo lobby (Suas salas): o jogo continua exatamente de onde parou. Se o jogador da vez sumir por mais de 45s, qualquer um pode pular o turno dele."],
];

const NOTES = [
  "“Anão: carregar até 6 itens” foi interpretado como limite de mão 6 (7 a partir do nível 11), como no Anão clássico.",
  "Desafio (Guerreiro): “o nível do monstro conta por 2” foi interpretado como níveis ganhos em dobro; você luta com -5 e não pode fugir.",
  "Escudo da Fé (Paladino): “ganhe +3 cartas” = compra 3 Tesouros depois de sofrer as Coisas Ruins.",
  "Dano de fogo: Baforada, Tempestade Elemental, Óleo de Fogo Grego, Lança Flamejante, Anel de Fogo, Runa do Fogo, Pesadelo e o Sopro do Dragão Bebê.",
  "Resistência Lendária anula a primeira ativa de combate usada pelo lado dos jogadores contra um Lendário.",
  "Espelho de Prata: o Monstro Errante vai para o jogador escolhido, que o enfrenta ao chutar a porta no próximo turno dele.",
  "Durações de maldições contam turnos do alvo (se lançada no turno do próprio alvo, o turno atual não conta).",
  "Cartas que o livro cita mas não define foram criadas: 9 Bônus de Monstro, 3 Monstros Errantes e 6 cartas de Subir de Nível.",
  "Partidas podem começar com 2 jogadores para teste; o recomendado continua 3 a 9.",
];

export default function RulesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <Link href="/lobby" className="text-sm text-muted hover:text-ink">
        ← Lobby
      </Link>
      <h1 className="mt-2 font-display text-3xl text-gold-2">Regras e cartas</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {RULES.map(([t, d]) => (
          <div key={t} className="rounded-xl border border-edge bg-panel p-3">
            <h2 className="font-display text-gold-2">{t}</h2>
            <p className="mt-1 text-sm text-ink/90">{d}</p>
          </div>
        ))}
      </div>
      <details className="mt-4 rounded-xl border border-edge bg-panel p-3">
        <summary className="cursor-pointer font-display text-gold-2">Interpretações adotadas</summary>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
          {NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
      <h2 className="mt-8 font-display text-2xl text-gold-2">Todas as cartas</h2>
      <CardBrowser />
      <p className="mt-8 text-xs text-muted">
        Nomes de monstros baseados no SRD 5.1 (Wizards of the Coast), licenciado sob CC-BY-4.0.
      </p>
    </main>
  );
}
