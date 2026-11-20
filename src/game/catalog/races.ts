import type { RaceCard } from "./types";

const r = (c: Omit<RaceCard, "kind" | "deck" | "id"> & { id: string }): RaceCard => ({
  ...c,
  id: `race.${c.id}`,
  kind: "race",
  deck: "door",
});

export const RACES: RaceCard[] = [
  r({
    id: "divino",
    race: "divino",
    name: "Divino",
    passive: {
      name: "Proteção Celestial",
      text: "Ao ser alvo de uma maldição, role 1d6; com 5+ ela é anulada (4+ a partir do nível 11).",
    },
    active: {
      name: "Luz Sagrada",
      text: "Descarte 1 carta: +2 no combate (+4 a partir do nível 11); contra Mortos-vivos e Demônios o bônus dobra. 1x por combate.",
    },
  }),
  r({
    id: "anao",
    race: "anao",
    name: "Anão",
    passive: {
      name: "Teimosia Anã",
      text: "Coisas Ruins que fariam você perder itens tiram 1 item a menos; você pode carregar até 6 cartas na mão (7 a partir do nível 11), mas não pode segurar nem equipar itens Grandes.",
    },
    active: {
      name: "Reforjar",
      text: "Descarte 1 item: um item equipado (exceto anéis) ganha +1 permanente. Cada item só pode ser reforjado 1 vez. 1x por turno seu, fora de combate.",
    },
  }),
  r({
    id: "draconato",
    race: "draconato",
    name: "Draconato",
    passive: {
      name: "Escamas Dracônicas",
      text: "+1 em combate (+2 a partir do nível 11); imune às Coisas Ruins de monstros Fogo e Dragão, exceto Lendários.",
    },
    active: {
      name: "Baforada",
      text: "Descarte 3 cartas: +5 no combate (+7 a partir do nível 11); conta como dano de fogo. 1x por combate.",
    },
  }),
  r({
    id: "elfo",
    race: "elfo",
    name: "Elfo",
    passive: {
      name: "Graça Élfica",
      text: "+1 em Fugir; sobe 1 nível ao ajudar outro jogador a derrotar um monstro (máx. 1 por rodada).",
    },
    active: {
      name: "Disparo Duplo",
      text: "Descarte 3 cartas: se você estiver ajudando outro jogador, o seu nível conta 2x. 1x por combate.",
    },
  }),
  r({
    id: "gnomo",
    race: "gnomo",
    name: "Gnomo",
    passive: {
      name: "Gambiarra",
      text: "+1 em Fugir; ao usar uma poção, role 1d6: com 6 ela não é descartada.",
    },
    active: {
      name: "Engenhoca Explosiva",
      text: "Descarte 1 item da mão: some o bônus dele a qualquer lado do combate, mesmo que você não pudesse usá-lo. 1x por combate.",
    },
  }),
  r({
    id: "gigante",
    race: "gigante",
    name: "Gigante",
    passive: {
      name: "Colosso",
      text: "+2 em combate (+3 a partir do nível 11) e pode usar 2 itens Grandes; -1 em Fugir.",
    },
    active: {
      name: "Arremesso",
      text: "Perca 1 nível e descarte 1 item Grande seu (equipado ou da mão): some o dobro do bônus dele ao combate. 1x por combate.",
    },
  }),
  r({
    id: "humano",
    race: "humano",
    name: "Humano",
    passive: {
      name: "Versátil",
      text: "Limite de mão +1. A partir do nível 11, pode ter 2 classes ao mesmo tempo.",
    },
    active: {
      name: "Adaptação",
      text: "Descarte 3 cartas: use um item restrito a outra raça ou classe até o fim do combate. 1x por turno.",
    },
  }),
  r({
    id: "orc",
    race: "orc",
    name: "Orc",
    passive: {
      name: "Sede de Sangue",
      text: "Ao vencer sozinho um monstro de nível maior que o seu, sobe 1 nível extra (máx. 1 por rodada).",
    },
    active: {
      name: "Brutalidade",
      text: "Descarte 2 cartas: o texto Especial da carta do monstro é ignorado neste combate. Não funciona em Lendários. 1x por combate.",
    },
  }),
  r({
    id: "diabrete",
    race: "diabrete",
    name: "Diabrete",
    passive: {
      name: "Malícia",
      text: "Ao lançar uma maldição em outro jogador, compre 2 cartas de Porta (máx. 1 por rodada).",
    },
    active: {
      name: "Pacto Diabólico",
      text: "Descarte 1 carta: passe uma maldição ativa em você para outro jogador. 1x por rodada.",
    },
  }),
  r({
    id: "elemental",
    race: "elemental",
    name: "Elemental",
    passive: {
      name: "Afinidade Rúnica",
      text: "Cada item pode ter 1 runa a mais, e cada runa equipada dá +1 extra (máx. +4).",
    },
    active: {
      name: "Tempestade Elemental",
      text: "Descarte 2 cartas: todos os monstros do combate, inclusive Monstros Errantes, perdem 2 níveis (4 a partir do nível 11). 1x por combate. Se chegar ao nível zero o monstro morre automaticamente.",
    },
  }),
  r({
    id: "goblin",
    race: "goblin",
    name: "Goblin",
    passive: {
      name: "Catador",
      text: "Quando outro jogador descarta um item, você pode rolar 1d6 com sucesso em 5+ (4+ a partir do nível 11) para pegá-lo antes. 1x por rodada.",
    },
    active: {
      name: "Bugiganga Roubada",
      text: "Descarte 1 carta: pegue 1 item da pilha de descarte de Tesouros ou roube 1 tesouro aberto de alguém que acabou de ganhar. 1x por turno seu.",
    },
  }),
  r({
    id: "centauro",
    race: "centauro",
    name: "Centauro",
    passive: {
      name: "Quatro Patas",
      text: "+1 em Fugir; pode equipar 2 pares de botas; não pode usar montarias.",
    },
    active: {
      name: "Galope",
      text: "Descarte 1 carta: depois de vencer ou fugir de um combate, abra mais uma porta neste turno. 1x por turno seu.",
    },
  }),
  r({
    id: "torkle",
    race: "torkle",
    name: "Torkle",
    passive: {
      name: "Casco",
      text: "Conta como peitoral de +5 (+7 a partir do nível 11) que não pode ser perdido nem roubado; não pode equipar peitorais; -2 em Fugir.",
    },
    active: {
      name: "Hibernar",
      text: "No início do seu turno, em vez de chutar a porta, entre no casco: compre 2 Tesouros e fique imune a maldições e roubos até o seu próximo turno. 1x por turno seu.",
    },
  }),
  r({
    id: "owlin",
    race: "owlin",
    name: "Owlin",
    passive: {
      name: "Olhos da Noite",
      text: "No início e no fim do seu turno, veja a carta do topo de Portas; deixe-a lá ou mande-a para o fundo.",
    },
    active: {
      name: "Presságio",
      text: "Coloque 1 carta da sua mão no topo do baralho de Portas e pegue a última carta do baralho de Portas. 1x por rodada.",
    },
  }),
  r({
    id: "tritao",
    race: "tritao",
    name: "Tritão/Sereia",
    passive: {
      name: "Filho das Marés",
      text: "+2 em Fugir (foge automaticamente de monstros Aquáticos); +3 em combate contra monstros Aquáticos e imune às Coisas Ruins deles.",
    },
    active: {
      name: "Tridente / Canto da Sereia",
      text: "Tridente: ameace um jogador de perder 1 nível caso ele não ajude você no combate; você pode oferecer tesouros. 1x por rodada. — Canto da Sereia: descarte 2 cartas: obrigue um jogador a ajudar você no combate; ele não pode recusar e não recebe tesouro. 1x por rodada.",
    },
  }),
  r({
    id: "fada",
    race: "fada",
    name: "Fada",
    passive: {
      name: "Asas Leves",
      text: "+2 em Fugir; -1 em combate; não pode usar itens Grandes.",
    },
    active: {
      name: "Truque Feérico",
      text: "Descarte 2 cartas: troque um item equipado seu por um item equipado de outro jogador no mesmo slot (exceto Lendários); o alvo pode descartar 2 cartas para impedir. 1x por turno seu, fora de combate.",
    },
  }),
  r({
    id: "vampirico",
    race: "vampirico",
    name: "Vampírico",
    passive: {
      name: "Não-morto",
      text: "Ao morrer, role 1d6; com 5+ não morre (mantém itens, mas seu turno acaba).",
    },
    active: {
      name: "Mordida",
      text: "Após vencer um combate, descarte 2 cartas: roube 1 nível de um jogador de nível igual ou maior que o seu (nunca chega ao nível 20 assim). 1x por turno seu.",
    },
  }),
];
