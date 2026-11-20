import type { ClassCard } from "./types";

const c = (x: Omit<ClassCard, "kind" | "deck" | "id"> & { id: string }): ClassCard => ({
  ...x,
  id: `class.${x.id}`,
  kind: "class",
  deck: "door",
});

export const CLASSES: ClassCard[] = [
  c({
    id: "guerreiro",
    cls: "guerreiro",
    name: "Guerreiro",
    passive: { name: "Mestre de Armas", text: "Vence empates em combate." },
    active: {
      name: "Desafio",
      text: "Descarte sua mão (mín. 4 cartas) e seu item equipado de maior bônus (ou montaria): ninguém mais pode jogar cartas neste combate (nem a favor nem contra), nem lutar junto; os níveis ganhos com o monstro contam em dobro e você recebe -5. Não dá para fugir: se perder, aplica as Coisas Ruins e morre. 1x por combate.",
    },
  }),
  c({
    id: "mago",
    cls: "mago",
    name: "Mago",
    passive: { name: "Foco Arcano", text: "Cada anel equipado dá +1 adicional." },
    active: {
      name: "Encantar",
      text: "Descarte a mão inteira (mín. 3 cartas): o monstro sai do combate; você ganha o tesouro, mas não o nível. Não funciona em Lendários. 1x por combate.",
    },
  }),
  c({
    id: "clerigo",
    cls: "clerigo",
    name: "Clérigo",
    passive: { name: "Fé", text: "+3 contra Mortos-vivos e Demônios." },
    active: {
      name: "Cura",
      text: "Descarte 2 cartas: remova 1 maldição ativa ou devolva 1 nível perdido nesta rodada (seu ou de outro jogador). 1x por rodada.",
    },
  }),
  c({
    id: "ladino",
    cls: "ladino",
    name: "Ladino",
    passive: { name: "Mãos Leves", text: "+1 em Fugir; seus itens equipados não podem ser roubados." },
    active: {
      name: "Roubo",
      text: "Descarte 1 carta e role 1d6: com 4+ roube 1 item equipado (não Grande) de outro jogador; com 1–3 perca 1 nível. 1x por rodada.",
    },
  }),
  c({
    id: "druida",
    cls: "druida",
    name: "Druida",
    passive: { name: "Laço Animal", text: "Montarias dão +2 adicional; +2 em Fugir contra monstros Animal." },
    active: {
      name: "Domar Fera",
      text: "Descarte 2 cartas: um monstro Animal de nível igual ou menor que o seu vira sua montaria (o bônus é o número de tesouros dele) em vez de lutar; você não ganha nível nem tesouro. 1x por rodada.",
    },
  }),
  c({
    id: "paladino",
    cls: "paladino",
    name: "Paladino",
    passive: {
      name: "Aura de Coragem",
      text: "Você e todo jogador do seu lado no mesmo combate ganham +2 (+3 a partir do nível 11).",
    },
    active: {
      name: "Escudo da Fé",
      text: "Assuma as Coisas Ruins de outro jogador (incluindo a morte); depois de aplicadas, compre 3 Tesouros. 1x por rodada.",
    },
  }),
  c({
    id: "barbaro",
    cls: "barbaro",
    name: "Bárbaro",
    passive: {
      name: "Pele Nua",
      text: "+1 por slot vazio entre capacete, peitoral, calças e botas (+2 por slot a partir do nível 5 e +3 a partir do 11).",
    },
    active: {
      name: "Esmagar",
      text: "Descarte a mão inteira (mín. 4 cartas): cancele todos os bônus que outros jogadores deram ao monstro neste combate (Monstros Errantes ficam). 1x por combate.",
    },
  }),
  c({
    id: "bardo",
    cls: "bardo",
    name: "Bardo",
    passive: {
      name: "Sorte do Bardo",
      text: "Ao vencer um combate, compre 1 Tesouro extra e descarte 1 dos tesouros comprados.",
    },
    active: {
      name: "Lábia",
      text: "Descarte 1 carta: convença o monstro a ir embora; você ganha metade dos tesouros dele (arredondado para baixo), sem nível. Não funciona em Lendários. 1x por rodada.",
    },
  }),
  c({
    id: "feiticeiro",
    cls: "feiticeiro",
    name: "Feiticeiro",
    passive: {
      name: "Magia Selvagem",
      text: "Sempre que usar uma habilidade ativa, role 1d6: com 6 ela não conta para o limite de uso.",
    },
    active: {
      name: "Polimorfia",
      text: "Descarte 2 cartas: o monstro vira o próximo monstro do baralho de Portas (vire cartas até achar um; as outras vão para o descarte). Não funciona em Lendários. 1x por combate.",
    },
  }),
  c({
    id: "bruxo",
    cls: "bruxo",
    name: "Bruxo",
    passive: {
      name: "Mestre das Maldições",
      text: "Suas maldições não podem ser anuladas nem refletidas por passivas e as que têm duração duram 1 rodada a mais.",
    },
    active: {
      name: "Maldição Sombria",
      text: "Descarte 2 cartas: um jogador fica com -3 em combate (-5 a partir do nível 11) até o fim do próximo turno dele; conta como maldição. 1x por rodada.",
    },
  }),
  c({
    id: "monge",
    cls: "monge",
    name: "Monge",
    passive: {
      name: "Corpo Treinado",
      text: "Sem itens nas mãos: +2 em combate e +1 em Fugir (+4 e +2 a partir do nível 11).",
    },
    active: {
      name: "Paz Interior",
      text: "Descarte 2 cartas: encerre o combate sem vencer nem perder; o monstro é descartado, sem nível, tesouro ou Coisas Ruins. Não funciona em Lendários. 1x por rodada.",
    },
  }),
  c({
    id: "patrulheiro",
    cls: "patrulheiro",
    name: "Patrulheiro",
    passive: {
      name: "Rastreador",
      text: "+1 em Fugir; ao derrotar um monstro Animal ou Voador, compre 1 Tesouro extra.",
    },
    active: {
      name: "Armadilha",
      text: "Descarte 2 cartas: anule um Monstro Errante que entrou em qualquer combate. 1x por rodada.",
    },
  }),
  c({
    id: "ilusionista",
    cls: "ilusionista",
    name: "Ilusionista",
    passive: {
      name: "Imagem Espelhada",
      text: "Quando outro jogador usar uma ativa ou maldição contra você, role 1d6: com 6 ela é aplicada nele (5+ a partir do nível 11). Maldições do Bruxo não podem ser refletidas.",
    },
    active: {
      name: "Duplicata",
      text: "Descarte 2 cartas e coloque em campo um monstro da mão: ele luta do seu lado e soma metade do nível dele (arredondado para cima) ao seu combate; outros jogadores não podem se juntar a você. 1x por combate.",
    },
  }),
  c({
    id: "berserker",
    cls: "berserker",
    name: "Berserker",
    passive: {
      name: "Fúria Crescente",
      text: "+1 cumulativo (+2 a partir do nível 16) por combate vencido em sequência; zera ao perder ou morrer. Você não pode fugir de nenhum combate.",
    },
    active: {
      name: "Fúria Sangrenta",
      text: "Descarte 4 cartas: dobre o bônus da Fúria Crescente. 1x por combate.",
    },
  }),
  c({
    id: "artifice",
    cls: "artifice",
    name: "Artífice",
    passive: {
      name: "Bancada Portátil",
      text: "Escolha 1 slot entre capacete, peitoral, calças, botas ou colar: você pode equipar um segundo item nele, que dá metade do bônus. No nível 11, escolha outro slot.",
    },
    active: {
      name: "Infusão",
      text: "Descarte 3 cartas: dobre o bônus de 1 item equipado (seu ou de um aliado no combate) até o fim do combate. 1x por combate.",
    },
  }),
  c({
    id: "alquimista",
    cls: "alquimista",
    name: "Alquimista",
    passive: {
      name: "Destilação",
      text: "Poções que você usa (em você ou em outros) têm efeito dobrado.",
    },
    active: {
      name: "Transmutar",
      text: "Descarte 2 cartas: pegue a primeira Poção do baralho de Tesouros e embaralhe-o depois. 1x por turno seu.",
    },
  }),
];
