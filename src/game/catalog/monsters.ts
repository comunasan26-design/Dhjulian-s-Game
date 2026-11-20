import type { BadEffect, MonsterCard, Tag } from "./types";

type M = {
  id: string;
  level: number;
  name: string;
  tags?: Tag[];
  special: string;
  bad: string;
  badStuff: BadEffect[];
  treasures: number;
  levels: number;
  fleeMod?: number;
  cantFlee?: boolean;
  acidRust?: boolean;
  poison?: boolean;
  giant?: boolean;
  goblinoid?: boolean;
};

function tierOf(level: number): 1 | 2 | 3 | 4 {
  if (level <= 10) return 1;
  if (level <= 20) return 2;
  if (level <= 30) return 3;
  return 4;
}

const m = (x: M): MonsterCard => ({
  id: `monster.${x.id}`,
  name: x.name,
  kind: "monster",
  deck: "door",
  level: x.level,
  tags: x.tags ?? [],
  special: x.special,
  badStuffText: x.bad,
  badStuff: x.badStuff,
  treasures: x.treasures,
  levels: x.levels,
  tier: tierOf(x.level),
  legendary: x.level >= 31,
  fleeMod: x.fleeMod,
  cantFlee: x.cantFlee,
  acidRust: x.acidRust,
  poison: x.poison,
  giant: x.giant,
  goblinoid: x.goblinoid,
});

const L = (n: number): BadEffect => ({ t: "levels", n });
const DEATH: BadEffect = { t: "death" };

export const MONSTERS: MonsterCard[] = [
  // ---------------- Faixa 1 ----------------
  m({ id: "kobold", level: 1, name: "Kobold Covarde", goblinoid: true, special: "Não persegue jogadores de nível 5 ou mais.", bad: "Morde o tornozelo: perca as botas.", badStuff: [{ t: "slot", slot: "feet" }], treasures: 1, levels: 1 }),
  m({ id: "estirge", level: 1, name: "Estirge", tags: ["voador", "animal"], special: "Vampíricos ganham +3 (concorrência).", bad: "Suga seu sangue: perca 1 nível.", badStuff: [L(1)], treasures: 1, levels: 1 }),
  m({ id: "goblin", level: 2, name: "Goblin Batedor de Carteira", goblinoid: true, special: "Jogadores da raça Goblin podem dispensá-lo: descartam o monstro e compram 1 tesouro (sem nível).", bad: "Perca 2 anéis à sua escolha.", badStuff: [{ t: "rings", n: 2 }], treasures: 1, levels: 1 }),
  m({ id: "cogumelo", level: 2, name: "Cogumelo Gritante", special: "Grito: ao ser revelado, o jogador à sua esquerda pode pôr 1 monstro da mão neste combate, como Monstro Errante.", bad: "Perca 1 carta da mão (de vergonha).", badStuff: [{ t: "handCards", n: 1 }], treasures: 1, levels: 1 }),
  m({ id: "esqueleto", level: 3, name: "Esqueleto Desmontável", tags: ["morto-vivo"], special: "Vulnerável a impacto: Monges e Bárbaros (e quem usa arma de impacto) ganham +3.", bad: "Perca o capacete.", badStuff: [{ t: "slot", slot: "head" }], treasures: 1, levels: 1 }),
  m({ id: "zumbi", level: 4, name: "Zumbi Lerdo", tags: ["morto-vivo"], fleeMod: 1, special: "+1 em Fugir contra ele. Se você fugir, ele volta ao topo do baralho de Portas (zumbi não desiste).", bad: "Perca 1 nível.", badStuff: [L(1)], treasures: 1, levels: 1 }),
  m({ id: "gnoll", level: 4, name: "Gnoll", special: "Faro de sangue: +3 contra quem perdeu nível nesta rodada.", bad: "Perca 1 nível e 1 anel.", badStuff: [L(1), { t: "rings", n: 1 }], treasures: 1, levels: 1 }),
  m({ id: "gosma", level: 5, name: "Gosma Cinzenta", acidRust: true, special: "Ácido: itens de mão não somam bônus contra ela.", bad: "Perca o peitoral.", badStuff: [{ t: "slot", slot: "chest" }], treasures: 2, levels: 1 }),
  m({ id: "harpia", level: 6, name: "Harpia Desafinada", tags: ["voador"], fleeMod: -1, special: "Canto hipnótico: -1 em Fugir. Tritão/Sereia e Bardos ganham +3 (cantam melhor).", bad: "Perca a montaria.", badStuff: [{ t: "slot", slot: "mount" }], treasures: 2, levels: 1 }),
  m({ id: "bugbear", level: 6, name: "Bugbear", special: "Ataque surpresa: você não pode pedir ajuda, mas outros podem se oferecer.", bad: "Perca o capacete e 1 nível.", badStuff: [{ t: "slot", slot: "head" }, L(1)], treasures: 2, levels: 1 }),
  m({ id: "mimico", level: 7, name: "Mímico", cantFlee: true, special: "Não dá para fugir: você já abriu o baú.", bad: "Perca 1 item Grande; sem item Grande, perca 2 itens à sua escolha.", badStuff: [{ t: "bigOrChoose2" }], treasures: 2, levels: 1 }),
  m({ id: "urso-coruja", level: 8, name: "Urso-Coruja", tags: ["animal"], special: "+4 contra Owlin (assunto de família). Druidas podem dispensá-lo descartando 1 carta.", bad: "Perca 2 níveis.", badStuff: [L(2)], treasures: 2, levels: 1 }),
  m({ id: "ferrugem", level: 9, name: "Monstro da Ferrugem", tags: ["animal"], acidRust: true, special: "Não persegue quem não tem nenhuma armadura equipada (Bárbaros agradecem).", bad: "Perca o capacete e o peitoral.", badStuff: [{ t: "slot", slot: "head" }, { t: "slot", slot: "chest" }], treasures: 2, levels: 1 }),
  m({ id: "ankheg", level: 9, name: "Ankheg", tags: ["animal"], acidRust: true, special: "Brota do chão: montarias não somam bônus.", bad: "Ácido: perca as calças e 1 nível.", badStuff: [{ t: "slot", slot: "legs" }, L(1)], treasures: 2, levels: 1 }),
  m({ id: "cubo", level: 10, name: "Cubo Gelatinoso", special: "Itens Grandes não somam bônus (afundam no cubo).", bad: "Perca 2 itens equipados aleatórios.", badStuff: [{ t: "randomEquipped", n: 2 }], treasures: 2, levels: 1 }),
  // ---------------- Faixa 2 ----------------
  m({ id: "ogro", level: 11, name: "Ogro Faminto", special: "+3 contra Gnomos, Fadas e Goblins (petiscos).", bad: "Perca 2 níveis.", badStuff: [L(2)], treasures: 3, levels: 1 }),
  m({ id: "carnical", level: 12, name: "Carniçal", tags: ["morto-vivo"], special: "Toque paralisante: ninguém do seu lado usa habilidades ativas neste combate. Clérigos ignoram isso.", bad: "Perca 2 níveis.", badStuff: [L(2)], treasures: 3, levels: 1 }),
  m({ id: "cao-infernal", level: 12, name: "Cão Infernal", tags: ["demonio", "fogo", "animal"], fleeMod: -2, special: "Faro: -2 em Fugir.", bad: "Perca 2 níveis e as botas.", badStuff: [L(2), { t: "slot", slot: "feet" }], treasures: 3, levels: 1 }),
  m({ id: "basilisco", level: 13, name: "Basilisco", tags: ["animal"], special: "Ao revelar, role 1d6: com 1–2 você fica meio petrificado e luta com -5.", bad: "Perca as calças e as botas (viraram pedra).", badStuff: [{ t: "slot", slot: "legs" }, { t: "slot", slot: "feet" }], treasures: 3, levels: 1 }),
  m({ id: "corpo-seco", level: 13, name: "Corpo-Seco", tags: ["morto-vivo"], special: "Dreno de vida: a Cura do Clérigo não devolve níveis perdidos para ele.", bad: "Perca 2 níveis.", badStuff: [L(2)], treasures: 3, levels: 1 }),
  m({ id: "mumia", level: 14, name: "Múmia", tags: ["morto-vivo"], poison: true, special: "Vulnerável a fogo: +4 para o seu lado se alguém causar dano de fogo.", bad: "Podridão de Múmia: perca 2 níveis e fique com -2 em combate por 2 rodadas (conta como maldição).", badStuff: [L(2), { t: "mummyRot" }], treasures: 3, levels: 1 }),
  m({ id: "gargula", level: 14, name: "Gárgula", tags: ["voador"], special: "Pele de pedra: itens de mão dão metade do bônus.", bad: "Perca o capacete e 2 níveis.", badStuff: [{ t: "slot", slot: "head" }, L(2)], treasures: 3, levels: 1 }),
  m({ id: "minotauro", level: 15, name: "Minotauro", fleeMod: -2, special: "Labirinto: -2 em Fugir.", bad: "Perca 3 níveis.", badStuff: [L(3)], treasures: 3, levels: 2 }),
  m({ id: "troll", level: 16, name: "Troll", special: "Regenera: +6, a menos que alguém do seu lado cause dano de fogo.", bad: "Perca 2 itens equipados à sua escolha.", badStuff: [{ t: "chooseEquipped", n: 2 }], treasures: 4, levels: 2 }),
  m({ id: "manticora", level: 17, name: "Mantícora", tags: ["voador"], special: "Espinhos: cada ajudante dá 2 a menos do que daria. Elfos e Patrulheiros ganham +3 (atacam de longe).", bad: "Perca o capacete e 2 níveis.", badStuff: [{ t: "slot", slot: "head" }, L(2)], treasures: 4, levels: 2 }),
  m({ id: "ettin", level: 17, name: "Ettin", giant: true, special: "Duas cabeças: ao revelar, role 1d6; com 1–2 ele briga consigo mesmo e luta com -6.", bad: "Perca 3 níveis.", badStuff: [L(3)], treasures: 4, levels: 2 }),
  m({ id: "medusa", level: 18, name: "Medusa", special: "Quem te ajudar também sofre as Coisas Ruins se vocês perderem.", bad: "Vira estátua: perca 3 níveis.", badStuff: [L(3)], treasures: 4, levels: 2 }),
  m({ id: "gigante-colinas", level: 19, name: "Gigante das Colinas", giant: true, fleeMod: -1, special: "Arremessa pedras: -1 em Fugir. Jogadores da raça Gigante podem dispensá-lo descartando 1 carta (são primos).", bad: "Perca 1 item Grande ou 3 níveis.", badStuff: [{ t: "bigOrLevels", n: 3 }], treasures: 4, levels: 2 }),
  m({ id: "oni", level: 19, name: "Ogro Mago (Oni)", special: "Mestre das ilusões: o primeiro bônus de monstro jogado a favor dele vale o dobro.", bad: "Perca 3 níveis e 1 item à sua escolha.", badStuff: [L(3), { t: "chooseEquipped", n: 1 }], treasures: 4, levels: 2 }),
  m({ id: "serpe", level: 20, name: "Serpe", tags: ["dragao", "voador"], poison: true, special: "Ataca de cima: +3 contra quem estiver montado.", bad: "Ferrão venenoso: perca 3 níveis e a montaria.", badStuff: [L(3), { t: "slot", slot: "mount" }], treasures: 4, levels: 2 }),
  // ---------------- Faixa 3 ----------------
  m({ id: "fantasma", level: 21, name: "Fantasma Choramingão", tags: ["morto-vivo"], special: "Incorpóreo: itens de mão não somam bônus; anéis, runas e poções funcionam normalmente.", bad: "Possessão: o jogador à sua esquerda escolhe 1 item seu e fica com ele.", badStuff: [{ t: "possession" }], treasures: 5, levels: 2 }),
  m({ id: "elemental-fogo", level: 21, name: "Elemental do Fogo", tags: ["fogo"], special: "Tritão/Sereia ganham +4. Jogadores da raça Elemental podem dispensá-lo descartando 1 carta (parentes).", bad: "Perca o peitoral e 2 níveis.", badStuff: [{ t: "slot", slot: "chest" }, L(2)], treasures: 5, levels: 2 }),
  m({ id: "gigante-gelo", level: 22, name: "Gigante do Gelo", giant: true, fleeMod: -2, special: "Congela: -2 em Fugir. +4 para o seu lado se alguém causar dano de fogo.", bad: "Perca as botas e 3 níveis.", badStuff: [{ t: "slot", slot: "feet" }, L(3)], treasures: 5, levels: 2 }),
  m({ id: "hidra", level: 23, name: "Hidra", tags: ["aquatico", "animal"], special: "Cabeças crescem: +3 para cada jogador que ajudar você.", bad: "Perca 4 níveis.", badStuff: [L(4)], treasures: 5, levels: 2 }),
  m({ id: "naga", level: 23, name: "Naga Espiritual", special: "Feitiço: o ajudante de maior nível passa a lutar do lado dela.", bad: "Perca 3 níveis.", badStuff: [L(3)], treasures: 5, levels: 2 }),
  m({ id: "golem", level: 24, name: "Golem de Ferro", special: "Imune a magia: nenhuma habilidade ativa funciona neste combate, de nenhum lado.", bad: "Perca o peitoral e 2 níveis.", badStuff: [{ t: "slot", slot: "chest" }, L(2)], treasures: 5, levels: 2 }),
  m({ id: "dragao-branco", level: 24, name: "Dragão Branco Adulto", tags: ["dragao", "voador"], special: "Sopro congelante: ninguém pode usar poções neste combate.", bad: "Perca as botas e 3 níveis.", badStuff: [{ t: "slot", slot: "feet" }, L(3)], treasures: 5, levels: 2 }),
  m({ id: "quimera", level: 25, name: "Quimera", tags: ["fogo", "voador", "animal", "dragao"], special: "Três cabeças: conta também como Dragão.", bad: "Role 1d6 três vezes: perca 1 nível para cada resultado de 1 a 3.", badStuff: [{ t: "chimera" }], treasures: 6, levels: 2 }),
  m({ id: "vampiro", level: 26, name: "Vampiro Ancestral", tags: ["morto-vivo"], special: "Jogadores da raça Vampírico podem dispensá-lo e comprar 2 tesouros (sem nível). Divinos e Paladinos ganham +4.", bad: "Perca 4 níveis. Se morrer neste combate, sua raça vira Vampírico.", badStuff: [L(4), { t: "vampirize" }], treasures: 6, levels: 2 }),
  m({ id: "gigante-fogo", level: 27, name: "Gigante do Fogo", tags: ["fogo"], giant: true, special: "Anões ganham +3 (rivalidade de forja).", bad: "Perca os itens das 2 mãos e 3 níveis.", badStuff: [{ t: "slot", slot: "hands" }, L(3)], treasures: 6, levels: 2 }),
  m({ id: "aboleth", level: 27, name: "Aboleth", tags: ["aquatico"], special: "Escraviza mentes: o jogador com mais cartas na mão (fora você) luta do lado dele.", bad: "Perca 4 níveis.", badStuff: [L(4)], treasures: 6, levels: 2 }),
  m({ id: "verme", level: 28, name: "Verme Púrpura", fleeMod: -2, special: "Engole inteiro: -2 em Fugir.", bad: "Morte.", badStuff: [DEATH], treasures: 6, levels: 2 }),
  m({ id: "dragao-vermelho-adulto", level: 29, name: "Dragão Vermelho Adulto", tags: ["dragao", "fogo", "voador"], special: "Ganancioso: +5 contra quem tiver 8 ou mais itens equipados.", bad: "Morte.", badStuff: [DEATH], treasures: 7, levels: 2 }),
  m({ id: "gigante-tempestades", level: 29, name: "Gigante das Tempestades", giant: true, special: "Tempestade: montarias não somam bônus.", bad: "Perca 4 níveis e a montaria.", badStuff: [L(4), { t: "slot", slot: "mount" }], treasures: 7, levels: 2 }),
  m({ id: "glabrezu", level: 30, name: "Glabrezu", tags: ["demonio"], special: "Oferece um desejo: antes do combate, você pode subir 1 nível na hora; se aceitar, ele ganha +10.", bad: "Perca 4 níveis e todos os anéis.", badStuff: [L(4), { t: "rings", n: "all" }], treasures: 7, levels: 3 }),
  // ---------------- Faixa 4 — Lendários ----------------
  m({ id: "senhor-mumias", level: 31, name: "Senhor das Múmias", tags: ["morto-vivo"], special: "Maldição do faraó: mesmo vencendo, quem lutou perde 1 item aleatório. +4 para o seu lado se alguém causar dano de fogo.", bad: "Morte.", badStuff: [DEATH], treasures: 7, levels: 3 }),
  m({ id: "dragao-negro", level: 31, name: "Dragão Negro Ancião", tags: ["dragao", "aquatico", "voador"], special: "Sopro ácido: peitorais não somam bônus.", bad: "Morte.", badStuff: [DEATH], treasures: 7, levels: 3 }),
  m({ id: "lich", level: 32, name: "Lich", tags: ["morto-vivo"], special: "Filactéria: se for derrotado sem um Clérigo ou Paladino no combate, volta ao topo do baralho de Portas.", bad: "Morte e perca 2 níveis.", badStuff: [L(2), DEATH], treasures: 8, levels: 3 }),
  m({ id: "dragao-azul", level: 33, name: "Dragão Azul Ancião", tags: ["dragao", "voador"], special: "Sopro de relâmpago: anéis não somam bônus (metal conduz).", bad: "Morte.", badStuff: [DEATH], treasures: 8, levels: 3 }),
  m({ id: "planetar", level: 33, name: "Planetar", tags: ["sagrado", "voador"], special: "Detecta mentiras: quem lançou uma maldição nesta rodada não pode ajudar nem atrapalhar este combate.", bad: "Perca 4 níveis.", badStuff: [L(4)], treasures: 8, levels: 3 }),
  m({ id: "solar", level: 34, name: "Solar", tags: ["sagrado", "voador"], special: "Divinos e Paladinos podem dispensá-lo e subir 1 nível. Vampíricos e Bruxos lutam com -5.", bad: "Julgamento: perca 5 níveis.", badStuff: [L(5)], treasures: 8, levels: 3 }),
  m({ id: "marilith", level: 34, name: "Marilith", tags: ["demonio"], special: "Seis braços: anula os 2 maiores bônus de item do seu lado.", bad: "Morte.", badStuff: [DEATH], treasures: 8, levels: 3 }),
  m({ id: "balor", level: 35, name: "Balor", tags: ["demonio", "fogo"], special: "Explode ao morrer: mesmo vencendo, cada jogador do seu lado perde 1 item equipado à escolha.", bad: "Morte.", badStuff: [DEATH], treasures: 9, levels: 3 }),
  m({ id: "kraken", level: 36, name: "Kraken", tags: ["aquatico"], special: "Tritão/Sereia ganham +6 (estão em casa). Montarias não somam bônus (afundam).", bad: "Morte.", badStuff: [DEATH], treasures: 9, levels: 3 }),
  m({ id: "dragao-verde", level: 36, name: "Dragão Verde Ancião", tags: ["dragao", "voador"], special: "Sopro venenoso: cada ajudante perde 1 nível ao entrar no combate.", bad: "Morte.", badStuff: [DEATH], treasures: 9, levels: 3 }),
  m({ id: "diabo", level: 37, name: "Diabo das Profundezas", tags: ["demonio", "fogo"], fleeMod: -3, special: "Aura de medo: -3 em Fugir e -2 para cada ajudante. Paladinos ignoram a aura.", bad: "Morte.", badStuff: [DEATH], treasures: 9, levels: 3 }),
  m({ id: "dragao-vermelho-anciao", level: 38, name: "Dragão Vermelho Ancião", tags: ["dragao", "fogo", "voador"], special: "Incendeia a vila: se ninguém o derrotar, todos os outros jogadores perdem 1 nível.", bad: "Morte.", badStuff: [DEATH], treasures: 10, levels: 3 }),
  m({ id: "empireo", level: 38, name: "Empíreo", tags: ["sagrado"], special: "Fúria titânica: +2 para cada nível que você tiver acima do 15.", bad: "Perca 5 níveis.", badStuff: [L(5)], treasures: 10, levels: 3 }),
  m({ id: "dragao-dourado", level: 39, name: "Dragão Dourado Ancião", tags: ["dragao", "sagrado", "voador"], special: "Não persegue Divinos nem Paladinos. Julga a ganância: +1 para cada carta na sua mão.", bad: "Perca 5 níveis e todos os itens que não estiverem equipados.", badStuff: [L(5), { t: "carried" }], treasures: 10, levels: 3 }),
  m({ id: "tarrasque", level: 40, name: "Tarrasque", special: "Imbatível no papel: nenhuma habilidade pode encantá-lo, anulá-lo ou dispensá-lo. Cada ajudante que vencer com você compra 1 tesouro extra.", bad: "Morte, e todos os outros jogadores perdem 2 níveis (ele passou pela cidade).", badStuff: [DEATH, { t: "othersLoseLevels", n: 2 }], treasures: 12, levels: 3 }),
];
