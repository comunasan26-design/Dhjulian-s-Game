import type { ClassId, ItemCard, LevelUpCard, MiscCard, PotionCard, RuneCard } from "./types";

const ARCANE: ClassId[] = ["mago", "feiticeiro", "bruxo", "ilusionista"];

const it = (x: Omit<ItemCard, "kind" | "deck" | "id"> & { id: string }): ItemCard => ({
  ...x,
  id: `item.${x.id}`,
  kind: "item",
  deck: "treasure",
});

export const ITEMS: ItemCard[] = [
  // ---------- Capacetes ----------
  it({ id: "panela", name: "Panela Amassada", slot: "head", rarity: "comum", bonus: 1, price: 100, text: "Nenhum. Pelo menos protege do sol." }),
  it({ id: "elmo-couro", name: "Elmo de Couro", slot: "head", rarity: "comum", bonus: 2, price: 200, text: "" }),
  it({ id: "chapeu-arcano", name: "Chapéu Pontudo do Arcano", slot: "head", rarity: "incomum", bonus: 3, price: 400, text: "Somente Mago, Feiticeiro, Bruxo ou Ilusionista.", requires: { classes: ARCANE } }),
  it({ id: "elmo-chifres", name: "Elmo com Chifres", slot: "head", rarity: "raro", bonus: 4, price: 600, text: "Orc e Berserker ganham +2 a mais." }),
  it({ id: "coroa-goblin", name: "Coroa do Rei Goblin", slot: "head", rarity: "epico", bonus: 5, price: 800, text: "Monstros Kobold e Goblin não perseguem você." }),
  it({ id: "elmo-olho", name: "Elmo do Olho Vigilante", slot: "head", rarity: "lendario", bonus: 6, price: 1000, text: "Monstros Errantes jogados contra você dão metade do dano e dos tesouros." }),
  // ---------- Peitorais ----------
  it({ id: "gibao", name: "Gibão Acolchoado", slot: "chest", rarity: "comum", bonus: 1, price: 100, text: "" }),
  it({ id: "cota-enferrujada", name: "Cota de Malha Enferrujada", slot: "chest", rarity: "comum", bonus: 2, price: 150, text: "O Monstro da Ferrugem ganha +3 contra você." }),
  it({ id: "couraca-kobold", name: "Couraça de Escamas de Kobold", slot: "chest", rarity: "incomum", bonus: 3, price: 400, text: "" }),
  it({ id: "placas", name: "Armadura de Placas Brilhante", slot: "chest", rarity: "raro", bonus: 4, price: 600, big: true, flee: -1, text: "Grande. -1 em Fugir. Fada e Ladino não podem usar.", forbids: { races: ["fada"], classes: ["ladino"] } }),
  it({ id: "manto-elfico", name: "Manto Élfico", slot: "chest", rarity: "epico", bonus: 5, price: 800, flee: 1, text: "+1 em Fugir. Somente Elfo, Fada ou Ladino.", requires: { races: ["elfo", "fada"], classes: ["ladino"] } }),
  it({ id: "armadura-dragao", name: "Armadura de Escamas de Dragão Vermelho", slot: "chest", rarity: "lendario", bonus: 6, price: 1000, text: "Imune às Coisas Ruins de monstros Fogo, exceto Lendários." }),
  // ---------- Calças ----------
  it({ id: "bermuda", name: "Bermuda de Aventureiro", slot: "legs", rarity: "comum", bonus: 1, price: 100, text: "" }),
  it({ id: "calcas-couro", name: "Calças de Couro Batido", slot: "legs", rarity: "comum", bonus: 2, price: 200, text: "" }),
  it({ id: "calcas-antichamas", name: "Calças Antichamas", slot: "legs", rarity: "incomum", bonus: 3, price: 400, text: "Não podem ser perdidas por Coisas Ruins de monstros Fogo." }),
  it({ id: "grevas-mithral", name: "Grevas de Mithral", slot: "legs", rarity: "raro", bonus: 4, price: 600, text: "Imunes a ácido e ferrugem (Gosma Cinzenta, Ankheg, Monstro da Ferrugem)." }),
  it({ id: "calcas-dignidade", name: "Calças da Dignidade Eterna", slot: "legs", rarity: "epico", bonus: 5, price: 800, text: "Nunca podem ser perdidas por Coisas Ruins. Você nunca passa vergonha." }),
  it({ id: "saiote-tita", name: "Saiote do Titã", slot: "legs", rarity: "lendario", bonus: 6, price: 1000, text: "Gigante ganha +2 a mais e pode usar 1 item Grande a mais." }),
  // ---------- Botas ----------
  it({ id: "sandalias", name: "Sandálias de Peregrino", slot: "feet", rarity: "comum", bonus: 0, flee: 1, price: 100, text: "+1 em Fugir." }),
  it({ id: "botas-cravejadas", name: "Botas Cravejadas", slot: "feet", rarity: "comum", bonus: 2, price: 200, text: "" }),
  it({ id: "botas-silenciosas", name: "Botas Silenciosas", slot: "feet", rarity: "incomum", bonus: 2, flee: 1, price: 400, text: "+1 em Fugir." }),
  it({ id: "botas-velocidade", name: "Botas da Velocidade", slot: "feet", rarity: "raro", bonus: 2, flee: 2, price: 600, text: "+2 em Fugir." }),
  it({ id: "botas-sete-leguas", name: "Botas das Sete Léguas", slot: "feet", rarity: "lendario", bonus: 4, flee: 2, price: 1000, text: "+2 em Fugir; você pode fugir até de monstros que dizem \"não dá para fugir\"." }),
  // ---------- Armas e escudos ----------
  it({ id: "adaga", name: "Adaga Enferrujada", slot: "hand", hands: 1, rarity: "comum", bonus: 1, price: 100, text: "Ladino ganha +2 a mais." }),
  it({ id: "clava", name: "Clava com Prego", slot: "hand", hands: 1, rarity: "comum", bonus: 2, price: 200, impact: true, text: "Conta como dano de impacto (Esqueleto)." }),
  it({ id: "escudo-barril", name: "Escudo de Tampa de Barril", slot: "hand", hands: 1, rarity: "comum", bonus: 2, price: 200, text: "" }),
  it({ id: "lanca-pau", name: "Lança de Pau", slot: "hand", hands: 2, rarity: "comum", bonus: 4, price: 300, big: true, text: "Duas mãos. Grande." }),
  it({ id: "cajado-aprendiz", name: "Cajado do Aprendiz", slot: "hand", hands: 2, rarity: "incomum", bonus: 5, price: 500, text: "Duas mãos. Somente Mago, Feiticeiro, Bruxo ou Ilusionista.", requires: { classes: ARCANE } }),
  it({ id: "arco-elfico", name: "Arco Élfico", slot: "hand", hands: 2, rarity: "incomum", bonus: 5, price: 500, text: "Duas mãos. Somente Elfo ou Patrulheiro. Um Elfo pode usá-lo para ajudar de fora do combate (1x por combate).", requires: { races: ["elfo"], classes: ["patrulheiro"] } }),
  it({ id: "martelo-anao", name: "Martelo de Guerra Anão", slot: "hand", hands: 1, rarity: "raro", bonus: 4, price: 600, impact: true, text: "Anão ganha +2 a mais. Conta como dano de impacto." }),
  it({ id: "escudo-torre", name: "Escudo Torre", slot: "hand", hands: 1, rarity: "raro", bonus: 4, price: 600, big: true, flee: -1, text: "Grande. -1 em Fugir. Você não perde o capacete por Coisas Ruins." }),
  it({ id: "machado-carrasco", name: "Machado Duplo do Carrasco", slot: "hand", hands: 2, rarity: "raro", bonus: 6, price: 700, big: true, text: "Duas mãos. Grande. Berserker e Bárbaro ganham +2 a mais." }),
  it({ id: "lanca-flamejante", name: "Lança Flamejante", slot: "hand", hands: 2, rarity: "epico", bonus: 7, price: 900, fire: true, text: "Duas mãos. Conta como dano de fogo (Troll, Múmia, Gigante do Gelo)." }),
  it({ id: "martelo-trovao", name: "Martelo do Trovão", slot: "hand", hands: 1, rarity: "epico", bonus: 5, price: 800, text: "+3 contra Gigantes (Colinas, Gelo, Fogo e Tempestades)." }),
  it({ id: "escudo-refletor", name: "Escudo Refletor", slot: "hand", hands: 1, rarity: "epico", bonus: 5, price: 900, text: "1x por rodada, uma maldição lançada em você volta para quem a lançou." }),
  it({ id: "espada-vorpal", name: "Espada Vorpal", slot: "hand", hands: 1, rarity: "lendario", bonus: 6, price: 1000, text: "Ao vencer, role 1d6: com 6 suba 1 nível extra (cortou a cabeça)." }),
  it({ id: "cajado-arquimago", name: "Cajado do Arquimago", slot: "hand", hands: 2, rarity: "lendario", bonus: 8, price: 1000, text: "Duas mãos. Somente Mago, Feiticeiro, Bruxo ou Ilusionista. 1x por combate, refaça uma rolagem de Fugir sua.", requires: { classes: ARCANE } }),
  // ---------- Anéis ----------
  it({ id: "anel-lata", name: "Anel de Lata", slot: "ring", rarity: "comum", bonus: 1, price: 100, text: "Nenhum. Brilha bonito." }),
  it({ id: "anel-pe-ligeiro", name: "Anel do Pé Ligeiro", slot: "ring", rarity: "comum", bonus: 0, flee: 1, price: 150, text: "+1 em Fugir." }),
  it({ id: "anel-protecao", name: "Anel de Proteção", slot: "ring", rarity: "incomum", bonus: 1, price: 400, text: "Anula 1 maldição lançada em você; depois vira um Anel de Lata." }),
  it({ id: "anel-fogo", name: "Anel de Fogo", slot: "ring", rarity: "raro", bonus: 1, price: 600, fire: true, text: "Seu dano conta como dano de fogo." }),
  it({ id: "anel-invisibilidade", name: "Anel da Invisibilidade", slot: "ring", rarity: "raro", bonus: 1, price: 700, text: "Ninguém pode jogar Monstros Errantes no seu combate." }),
  it({ id: "anel-regeneracao", name: "Anel da Regeneração", slot: "ring", rarity: "epico", bonus: 2, price: 800, text: "Ao perder níveis por Coisas Ruins, perca 1 a menos (1x por rodada)." }),
  it({ id: "anel-desejos", name: "Anel dos Três Desejos", slot: "ring", rarity: "lendario", bonus: 2, price: 1000, text: "3 cargas: gaste 1 para anular as Coisas Ruins de um combate. Sem cargas, vira um Anel de Lata." }),
  // ---------- Colares ----------
  it({ id: "colar-lobo", name: "Colar de Dente de Lobo", slot: "neck", rarity: "comum", bonus: 1, price: 100, text: "Druida ganha +1 a mais." }),
  it({ id: "amuleto-alho", name: "Amuleto de Alho", slot: "neck", rarity: "incomum", bonus: 3, price: 500, text: "+3 a mais contra Mortos-vivos. Vampírico não pode usar.", forbids: { races: ["vampirico"] } }),
  it({ id: "medalhao", name: "Medalhão dos Pensamentos", slot: "neck", rarity: "raro", bonus: 4, price: 700, text: "1x por rodada, olhe a mão de um jogador." }),
  it({ id: "amuleto-saude", name: "Amuleto da Saúde", slot: "neck", rarity: "epico", bonus: 5, price: 800, text: "Imune a veneno e doença (Podridão de Múmia, Serpe, Dragão Verde Ancião)." }),
  it({ id: "talisma", name: "Talismã do Bem Puro", slot: "neck", rarity: "lendario", bonus: 6, price: 1000, text: "Divino e Paladino ganham +3 a mais. Vampírico e Bruxo não podem usar.", forbids: { races: ["vampirico"], classes: ["bruxo"] } }),
  // ---------- Montarias ----------
  it({ id: "mula", name: "Mula Teimosa", slot: "mount", rarity: "comum", bonus: 1, flee: 1, price: 100, mountTags: ["animal"], text: "Ao fugir, role 1d6: com 1 ela empaca e a fuga falha." }),
  it({ id: "ponei", name: "Pônei de Carga", slot: "mount", rarity: "comum", bonus: 2, flee: 0, price: 200, mountTags: ["animal"], text: "Carrega 1 item Grande para você (não conta no limite)." }),
  it({ id: "lobo-atroz", name: "Lobo Atroz", slot: "mount", rarity: "incomum", bonus: 3, flee: 1, price: 400, mountTags: ["animal"], text: "" }),
  it({ id: "cavalo-guerra", name: "Cavalo de Guerra", slot: "mount", rarity: "raro", bonus: 4, flee: 1, price: 600, mountTags: ["animal"], text: "Paladino ganha +2 a mais." }),
  it({ id: "grifo", name: "Grifo", slot: "mount", rarity: "raro", bonus: 4, flee: 2, price: 700, mountTags: ["animal", "voador"], text: "" }),
  it({ id: "pesadelo", name: "Pesadelo", slot: "mount", rarity: "epico", bonus: 5, flee: 2, price: 900, fire: true, mountTags: ["demonio", "fogo"], text: "Seu dano conta como dano de fogo. Paladino e Divino não podem usar.", forbids: { races: ["divino"], classes: ["paladino"] } }),
  it({ id: "dragao-bebe", name: "Dragão Bebê Rabugento", slot: "mount", rarity: "lendario", bonus: 6, flee: 2, price: 1000, mountTags: ["dragao", "voador"], text: "1x por combate, Sopro: +3 e dano de fogo. Draconato ganha +2 a mais." }),
];

const po = (x: Omit<PotionCard, "kind" | "deck" | "id"> & { id: string }): PotionCard => ({
  ...x,
  id: `potion.${x.id}`,
  kind: "potion",
  deck: "treasure",
});

export const POTIONS: PotionCard[] = [
  po({ id: "forca-menor", name: "Poção de Força Menor", rarity: "comum", price: 100, copies: 2, text: "+2 para um lado do combate." }),
  po({ id: "acido", name: "Frasco de Ácido", rarity: "comum", price: 200, copies: 2, text: "-3 para o monstro ou para um jogador." }),
  po({ id: "fuga-rapida", name: "Poção de Fuga Rápida", rarity: "comum", price: 200, copies: 2, text: "+2 em Fugir." }),
  po({ id: "fogo-grego", name: "Óleo de Fogo Grego", rarity: "incomum", price: 300, copies: 2, text: "+3 para um lado do combate; conta como dano de fogo." }),
  po({ id: "agua-benta", name: "Água Benta", rarity: "incomum", price: 300, copies: 2, text: "+4 contra Mortos-vivos e Demônios. Também remove a maldição Podridão Antiga." }),
  po({ id: "cura", name: "Poção de Cura", rarity: "incomum", price: 400, copies: 2, text: "Devolve 1 nível perdido neste combate." }),
  po({ id: "amizade", name: "Poção da Amizade Duvidosa", rarity: "raro", price: 500, text: "Um jogador escolhido é obrigado a ajudar você neste combate e não recebe tesouro." }),
  po({ id: "elixir-gigante", name: "Elixir de Gigante", rarity: "raro", price: 500, text: "+5 para um lado do combate, mas quem beber faz -1 em Fugir." }),
  po({ id: "invisibilidade", name: "Poção de Invisibilidade", rarity: "epico", price: 700, text: "Fuja automaticamente de um monstro que não seja Lendário." }),
  po({ id: "ascensao", name: "Elixir da Ascensão", rarity: "lendario", price: 1000, text: "Suba 1 nível (nunca para o nível 20)." }),
];

const ru = (x: Omit<RuneCard, "kind" | "deck" | "id"> & { id: string }): RuneCard => ({
  ...x,
  id: `rune.${x.id}`,
  kind: "rune",
  deck: "treasure",
});

export const RUNES: RuneCard[] = [
  ru({ id: "pedra", name: "Runa da Pedra", rarity: "comum", price: 100, text: "O item não pode ser perdido por ácido nem ferrugem." }),
  ru({ id: "vento", name: "Runa do Vento", rarity: "incomum", price: 300, text: "+1 em Fugir (conta no limite de +2 dos anéis se estiver num anel)." }),
  ru({ id: "fogo", name: "Runa do Fogo", rarity: "incomum", price: 400, text: "+1 no item; o dano dele conta como fogo." }),
  ru({ id: "vinculo", name: "Runa do Vínculo", rarity: "raro", price: 500, text: "O item não pode ser roubado nem trocado (Ladino, Fada, Goblin)." }),
  ru({ id: "sorte", name: "Runa da Sorte", rarity: "raro", price: 600, text: "1x por rodada, refaça um resultado 1 no dado (automático)." }),
  ru({ id: "sangue", name: "Runa do Sangue", rarity: "epico", price: 700, text: "+3 no item, mas se você perder um combate, perca 1 nível a mais." }),
  ru({ id: "rei", name: "Runa do Rei", rarity: "lendario", price: 1000, text: "Dobra o bônus do item. O item passa a contar como Lendário." }),
];

const mi = (x: Omit<MiscCard, "kind" | "deck" | "id"> & { id: string }): MiscCard => ({
  ...x,
  id: `misc.${x.id}`,
  kind: "misc",
  deck: "treasure",
});

export const MISC: MiscCard[] = [
  mi({ id: "isca", name: "Isca de Monstro", rarity: "comum", price: 200, permanent: false, copies: 2, text: "Uso único. Jogue no combate de outro jogador: +5 para o monstro." }),
  mi({ id: "dado-viciado", name: "Dado Viciado", rarity: "comum", price: 300, permanent: false, copies: 2, text: "Uso único. Refaça uma rolagem de Fugir sua." }),
  mi({ id: "kit-ladrao", name: "Kit de Ladrão", rarity: "incomum", price: 300, permanent: false, text: "Uso único. +2 numa rolagem de Roubo, ou role o Roubo mesmo sem ser Ladino (sucesso com 5+)." }),
  mi({ id: "espelho-prata", name: "Espelho de Prata", rarity: "incomum", price: 400, permanent: false, text: "Uso único. Um Monstro Errante jogado no seu combate vai para outro jogador à sua escolha, que o enfrenta no próximo turno dele." }),
  mi({ id: "bolsa", name: "Bolsa Devoradora", rarity: "raro", price: 500, permanent: true, text: "Permanente (na mesa). Seu limite de mão sobe em 2 cartas." }),
  mi({ id: "mapa", name: "Mapa do Tesouro", rarity: "raro", price: 600, permanent: false, text: "Uso único. Jogue no seu combate: ao vencer, compre 2 Tesouros a mais." }),
  mi({ id: "pergaminho", name: "Pergaminho de Teletransporte", rarity: "epico", price: 800, permanent: false, text: "Uso único. Fuja de qualquer combate, até de Lendários." }),
  mi({ id: "carta-rei", name: "Carta de Recomendação do Rei", rarity: "lendario", price: 1000, permanent: true, text: "Permanente (na mesa). Itens que você vende valem 50% a mais de ouro." }),
];

const lv = (id: string, name: string, text: string): LevelUpCard => ({
  id: `levelup.${id}`,
  name,
  kind: "levelup",
  deck: "treasure",
  text: `${text} Suba 1 nível (nunca para o nível 20). Jogue a qualquer momento.`,
});

export const LEVEL_UPS: LevelUpCard[] = [
  lv("critico", "Rolagem Crítica", "Um 20 natural na hora certa."),
  lv("bajular", "Bajular o Mestre", "Elogie a narração com sinceridade duvidosa."),
  lv("treino", "Treino Intenso", "Mil flexões antes do café."),
  lv("heranca", "Herança Inesperada", "Um tio-avô aventureiro deixou tudo para você."),
  lv("licao", "Lição Aprendida", "Da próxima vez, não abra o baú."),
  lv("sabedoria", "Sabedoria Ancestral", "Os antigos sussurram conselhos úteis."),
];
