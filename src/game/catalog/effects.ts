// Registro de todos os efeitos que podem ser usados nos arquivos JSON de cartas (pasta /cartas).
// Cada efeito tem um "tipo" e alguns parâmetros. Este registro é usado para validar os arquivos
// e para gerar a documentação (cartas/EFEITOS.md).

export type ParamKind = "numero" | "sim/nao" | "texto" | "lista";

export interface EffectSpec {
  desc: string;
  params?: Record<string, { tipo: ParamKind; desc: string; obrigatorio?: boolean; opcoes?: string[] }>;
}

export type Fx = { tipo: string } & Record<string, unknown>;

const RACAS = "racas";
const CLASSES = "classes";
const cond = {
  [RACAS]: { tipo: "lista" as const, desc: "raças (ids) que contam, ex.: [\"elfo\", \"anao\"]" },
  [CLASSES]: { tipo: "lista" as const, desc: "classes (ids) que contam, ex.: [\"mago\"]" },
};
const valor = (desc = "quanto soma (use número negativo para tirar)") => ({ valor: { tipo: "numero" as const, desc, obrigatorio: true } });
const qtd = (desc = "quantidade") => ({ quantidade: { tipo: "numero" as const, desc, obrigatorio: true } });

export const ITEM_EFFECTS: Record<string, EffectSpec> = {
  bonusPara: { desc: "Bônus a mais se o dono tiver uma das raças/classes.", params: { ...cond, ...valor() } },
  bonusContra: {
    desc: "Bônus a mais contra certos monstros.",
    params: { tags: { tipo: "lista", desc: "tags do monstro, ex.: [\"morto-vivo\"]" }, gigantes: { tipo: "sim/nao", desc: "vale contra Gigantes" }, ...valor() },
  },
  protecao: {
    desc: "O item não pode ser perdido por Coisas Ruins.",
    params: { contra: { tipo: "texto", desc: "tudo, fogo (monstros de Fogo) ou acido (ácido/ferrugem)", obrigatorio: true, opcoes: ["tudo", "fogo", "acido"] } },
  },
  protegeCapacete: { desc: "Enquanto equipado, você não perde o capacete por Coisas Ruins." },
  imuneCoisasRuins: {
    desc: "Imune às Coisas Ruins de monstros com certas tags.",
    params: { tags: { tipo: "lista", desc: "tags, ex.: [\"fogo\"]", obrigatorio: true }, excetoLendarios: { tipo: "sim/nao", desc: "não vale contra Lendários" } },
  },
  imuneVeneno: { desc: "Imune a veneno e doença (monstros marcados com \"veneno\" e o sopro do Dragão Verde)." },
  metadeErrantes: { desc: "Monstros Errantes jogados contra você valem metade (força e tesouros)." },
  naoPerseguidoPorGoblinoides: { desc: "Monstros marcados como \"goblinoide\" não perseguem você." },
  refleteMaldicao: { desc: "1x por rodada, uma maldição lançada em você volta para quem lançou." },
  nivelExtraAoVencer: { desc: "Ao vencer, role 1d6: com o valor indicado (ou mais) suba 1 nível extra.", params: { dado: { tipo: "numero", desc: "resultado mínimo no dado", obrigatorio: true } } },
  rerrolarFuga: { desc: "1x por combate, refaça uma rolagem de Fugir sua." },
  anulaMaldicao: { desc: "Anula 1 maldição lançada em você e depois vira outra carta.", params: { viraEm: { tipo: "texto", desc: "id do item em que se transforma", obrigatorio: true } } },
  bloqueiaErrantes: { desc: "Ninguém pode jogar Monstros Errantes no seu combate." },
  perdeMenosNiveis: { desc: "Ao perder níveis por Coisas Ruins, perca menos (1x por rodada).", params: qtd("quantos níveis a menos") },
  desejos: {
    desc: "Tem cargas: gaste 1 para anular as Coisas Ruins de um combate.",
    params: { cargas: { tipo: "numero", desc: "número de cargas", obrigatorio: true }, viraEm: { tipo: "texto", desc: "id do item em que vira sem cargas" } },
  },
  verMao: { desc: "1x por rodada, olhe a mão de um jogador." },
  fugirDeTudo: { desc: "Você pode fugir até de monstros que dizem \"não dá para fugir\"." },
  podeEmpacar: { desc: "Ao fugir, role 1d6: com 1 a fuga falha." },
  sopro: { desc: "1x por combate, quem estiver lutando ganha o bônus e causa dano de fogo.", params: valor() },
  atirarDeLonge: { desc: "Quem tem uma das raças pode somar o bônus do item ao combate de outro jogador sem entrar nele (1x por combate).", params: { ...cond } },
  grandeExtra: { desc: "Permite equipar 1 item Grande a mais (opcionalmente só para certas raças).", params: { ...cond } },
};

export const MONSTER_EFFECTS: Record<string, EffectSpec> = {
  bonusContra: {
    desc: "O monstro ganha bônus quando a condição vale para alguém do lado dos jogadores.",
    params: {
      ...cond,
      itemEquipado: { tipo: "texto", desc: "id de um item que, equipado, dá o bônus ao monstro" },
      montado: { tipo: "sim/nao", desc: "contra quem tem montaria" },
      perdeuNivelNaRodada: { tipo: "sim/nao", desc: "contra quem perdeu nível nesta rodada" },
      itensEquipadosMin: { tipo: "numero", desc: "contra quem tem pelo menos N itens equipados" },
      semFogo: { tipo: "sim/nao", desc: "só se ninguém causar dano de fogo" },
      porAjudante: { tipo: "sim/nao", desc: "o valor é somado para cada ajudante" },
      porNivelAcimaDe: { tipo: "numero", desc: "o valor é somado para cada nível do lutador acima deste" },
      porCartaNaMao: { tipo: "sim/nao", desc: "o valor é somado para cada carta na mão do lutador" },
      ...valor(),
    },
  },
  jogadoresGanham: {
    desc: "Cada jogador do lado dos jogadores que atende à condição ganha o valor.",
    params: {
      ...cond,
      armaDeImpacto: { tipo: "sim/nao", desc: "também vale para quem tem arma de impacto equipada" },
      soAjudante: { tipo: "sim/nao", desc: "vale só para o ajudante" },
      excetoClasses: { tipo: "lista", desc: "classes que ignoram este efeito" },
      ...valor(),
    },
  },
  fogoDaBonus: { desc: "Se alguém do lado dos jogadores causar dano de fogo, os jogadores ganham o valor.", params: valor() },
  anula: {
    desc: "Um tipo de item não soma bônus contra este monstro.",
    params: {
      alvo: {
        tipo: "texto",
        desc: "itensDeMao, metadeItensDeMao, itensGrandes, montarias, peitorais, aneis ou doisMaioresItens",
        obrigatorio: true,
        opcoes: ["itensDeMao", "metadeItensDeMao", "itensGrandes", "montarias", "peitorais", "aneis", "doisMaioresItens"],
      },
    },
  },
  naoPersegue: {
    desc: "O monstro não persegue (fuga automática) quem atende à condição.",
    params: {
      ...cond,
      nivelMinimo: { tipo: "numero", desc: "não persegue jogadores deste nível ou mais" },
      nivelMaximo: { tipo: "numero", desc: "não persegue jogadores deste nível ou menos" },
      semArmadura: { tipo: "sim/nao", desc: "não persegue quem não tem armadura" },
    },
  },
  dispensavel: {
    desc: "Quem luta e tem uma das raças/classes pode mandar o monstro embora.",
    params: {
      ...cond,
      descartar: { tipo: "numero", desc: "cartas a descartar para dispensar (0 ou 1)" },
      tesouros: { tipo: "numero", desc: "tesouros que ganha ao dispensar" },
      niveis: { tipo: "numero", desc: "níveis que ganha ao dispensar (nunca o 20)" },
    },
  },
  aoRevelar: {
    desc: "Ao aparecer, rola 1d6: com o valor indicado ou menos, aplica o efeito.",
    params: {
      dadoAte: { tipo: "numero", desc: "valor máximo do dado para o efeito valer", obrigatorio: true },
      jogadorGanha: { tipo: "numero", desc: "quanto o lutador ganha (negativo = perde)" },
      monstroGanha: { tipo: "numero", desc: "quanto o monstro ganha (negativo = perde)" },
    },
  },
  fugirIgnoradoPor: { desc: "Essas classes ignoram o modificador de Fugir do monstro.", params: { ...cond } },
  desejo: { desc: "Antes do combate, quem luta pode subir 1 nível; se aceitar, o monstro ganha o valor.", params: valor() },
  incendeiaVila: { desc: "Se ninguém o derrotar, todos os outros jogadores perdem níveis.", params: { niveis: { tipo: "numero", desc: "níveis perdidos", obrigatorio: true } } },
  filacteria: { desc: "Se for derrotado sem alguém dessas classes no combate, volta ao topo do baralho de Portas.", params: { ...cond } },
  tesouroExtraAjudante: { desc: "Cada ajudante que vencer compra tesouros extras.", params: qtd() },
  grito: { desc: "Ao aparecer, o jogador à esquerda pode pôr 1 monstro da mão no combate." },
  voltaAoFugir: { desc: "Se fugirem dele, volta ao topo do baralho de Portas." },
  semPedirAjuda: { desc: "Quem luta não pode pedir ajuda (outros podem se oferecer)." },
  paralisaAtivas: { desc: "Ninguém do lado dos jogadores usa habilidades ativas (Clérigos ignoram)." },
  drenoDeVida: { desc: "A Cura do Clérigo não devolve níveis perdidos para este monstro." },
  ajudanteSofre: { desc: "Quem ajudar também sofre as Coisas Ruins se perderem." },
  dobraPrimeiroBonus: { desc: "O primeiro bônus de monstro jogado a favor dele vale o dobro." },
  seduzAjudante: { desc: "O ajudante passa a lutar do lado do monstro." },
  imuneMagia: { desc: "Nenhuma habilidade ativa funciona neste combate." },
  semPocoes: { desc: "Ninguém pode usar poções neste combate." },
  escravizaMente: { desc: "O jogador com mais cartas na mão (fora quem luta) luta do lado do monstro." },
  maldicaoDoFarao: { desc: "Mesmo vencendo, quem lutou perde 1 item aleatório." },
  detectaMentiras: { desc: "Quem lançou maldição nesta rodada não pode ajudar nem atrapalhar." },
  explodeAoMorrer: { desc: "Mesmo vencendo, cada jogador do lado vencedor perde 1 item equipado à escolha." },
  venenoNoAjudante: { desc: "Cada ajudante perde 1 nível ao entrar no combate." },
  imbativel: { desc: "Nenhuma habilidade pode encantá-lo, convencê-lo, transformá-lo ou dispensá-lo." },
};

export const CURSE_EFFECTS: Record<string, EffectSpec> = {
  perderNiveis: {
    desc: "Perca níveis.",
    params: {
      ...qtd("níveis perdidos"),
      nivelMinimoParaExtra: { tipo: "numero", desc: "a partir deste nível perde a mais" },
      extra: { tipo: "numero", desc: "quantos níveis a mais" },
    },
  },
  perderSlot: {
    desc: "Perca os itens de um slot.",
    params: { slot: { tipo: "texto", desc: "capacete, peitoral, calcas, botas ou montaria", obrigatorio: true, opcoes: ["capacete", "peitoral", "calcas", "botas", "montaria"] } },
  },
  perderAneis: { desc: "Perca anéis à escolha de quem lançou.", params: qtd() },
  perderMelhorItem: { desc: "Perca o item equipado de maior bônus." },
  descartarCartas: { desc: "Descarte cartas aleatórias da mão.", params: qtd() },
  impostos: { desc: "Dê 1 carta aleatória da mão a cada jogador de nível menor." },
  trocaFeerica: { desc: "O jogador à esquerda troca 1 item equipado com você (mesmo slot, escolha dele)." },
  perderClasse: { desc: "Descarte sua classe." },
  virarRaca: { desc: "Descarte sua raça e vire outra.", params: { raca: { tipo: "texto", desc: "id da raça", obrigatorio: true } } },
  forcaNoCombate: {
    desc: "(De combate) Muda a força do alvo no combate.",
    params: { ...valor(), valorNivel11: { tipo: "numero", desc: "valor se o alvo tiver nível 11 ou mais" } },
  },
  naoPodeFugir: { desc: "(De combate) O alvo não pode fugir." },
  monstroGanha: { desc: "(De combate) O monstro ganha o valor.", params: valor() },
  ninguemAjuda: { desc: "(De combate) Ninguém pode ajudar o alvo." },
  semAtivas: { desc: "(De combate) O alvo não pode usar habilidades ativas." },
  chamadoDaHorda: { desc: "(De combate) Vira cartas de Porta até achar um monstro, que entra como Monstro Errante." },
  ajudanteTraidor: { desc: "(De combate) O ajudante do alvo passa para o lado do monstro." },
  forca: { desc: "(Contínua) Muda a força do alvo em todo combate.", params: valor() },
  menosNoDado: { desc: "(Contínua) Tira o valor de todas as rolagens de dado do alvo.", params: valor() },
  semItensDeMao: { desc: "(Contínua) Itens de mão não somam bônus." },
  semArmaduraEArmas: { desc: "(Contínua) Armaduras e armas não somam bônus." },
  naoPodeNegociar: { desc: "(Contínua) Não pode vender, trocar nem dar itens." },
  metadeTesouros: { desc: "(Contínua) Compra metade dos tesouros ao vencer." },
  pulaTurno: { desc: "(Contínua) Pula o próximo turno." },
  menosTesouros: { desc: "(Contínua) Compra menos tesouros ao vencer.", params: qtd() },
  descartaNoInicioDoTurno: { desc: "(Contínua) No início de cada turno, descarte 1 carta da mão." },
  ocupaUmaMao: { desc: "(Contínua) Ocupa 1 slot de mão." },
  semLendarios: { desc: "(Contínua) Não pode ter item Lendário equipado." },
  monstrosGanham: {
    desc: "(Contínua) Todo monstro que o alvo enfrentar ganha o valor.",
    params: { ...valor(), someAoDerrotarNivel: { tipo: "numero", desc: "some ao derrotar monstro deste nível ou mais" } },
  },
  acabaComBeijo: { desc: "Acaba se outro jogador descartar 1 carta para beijar o alvo." },
  removidaPorAguaBenta: { desc: "Pode ser removida com Água Benta." },
};

export const POTION_EFFECTS: Record<string, EffectSpec> = {
  bonusLado: {
    desc: "Soma o valor a um lado do combate.",
    params: { ...valor(), fogo: { tipo: "sim/nao", desc: "conta como dano de fogo" }, quemBebeFugir: { tipo: "numero", desc: "muda o Fugir de quem bebe" } },
  },
  menosEmAlvo: { desc: "Tira o valor do monstro ou de um jogador.", params: valor("quanto tira") },
  bonusFugir: { desc: "Soma ao Fugir de um jogador no combate.", params: valor() },
  contraMortosVivos: { desc: "Soma o valor contra Mortos-vivos e Demônios.", params: valor() },
  removePodridao: { desc: "Remove maldições marcadas com removidaPorAguaBenta." },
  devolveNivel: { desc: "Devolve níveis perdidos neste combate.", params: qtd() },
  forcaAjuda: { desc: "Obriga um jogador a ajudar você (sem tesouro)." },
  fugaAutomatica: { desc: "Foge automaticamente.", params: { excetoLendarios: { tipo: "sim/nao", desc: "não funciona contra Lendários" } } },
  subirNivel: { desc: "Sobe níveis (nunca para o 20).", params: qtd() },
};

export const RUNE_EFFECTS: Record<string, EffectSpec> = {
  bonusItem: { desc: "O item ganha bônus.", params: valor() },
  fugir: { desc: "Soma ao Fugir (conta no limite de +2 dos anéis se estiver num anel).", params: valor() },
  fogo: { desc: "O dano do item conta como fogo." },
  protegeAcido: { desc: "O item não pode ser perdido por ácido nem ferrugem." },
  naoRoubavel: { desc: "O item não pode ser roubado nem trocado." },
  rerrolaUm: { desc: "1x por rodada, refaz um resultado 1 no dado (automático)." },
  perdeNivelAoPerder: { desc: "Se perder um combate, perde níveis a mais.", params: qtd() },
  dobraItem: { desc: "Dobra o bônus do item." },
  contaComoLendario: { desc: "O item passa a contar como Lendário." },
};

export const MISC_EFFECTS: Record<string, EffectSpec> = {
  isca: { desc: "Jogue no combate de outro jogador: o monstro ganha o valor.", params: valor() },
  rerrolarFuga: { desc: "Refaça uma rolagem de Fugir sua (uso único)." },
  kitLadrao: {
    desc: "Bônus no Roubo, ou permite roubar sem ser Ladino.",
    params: { bonus: { tipo: "numero", desc: "bônus para Ladinos" }, sucessoSemLadino: { tipo: "numero", desc: "resultado mínimo para quem não é Ladino" } },
  },
  espelho: { desc: "Manda um Monstro Errante do seu combate para outro jogador enfrentar no próximo turno dele." },
  limiteMao: { desc: "(Permanente, na mesa) Aumenta o limite de mão.", params: qtd() },
  mapa: { desc: "Jogue no seu combate: ao vencer, compre tesouros a mais.", params: { tesouros: { tipo: "numero", desc: "tesouros a mais", obrigatorio: true } } },
  teletransporte: { desc: "Fuja de qualquer combate, até de Lendários." },
  vendaMultiplicador: { desc: "(Permanente, na mesa) Multiplica o ouro das suas vendas.", params: valor("multiplicador, ex.: 1.5") },
};

export const BAD_STUFF_TYPES: Record<string, EffectSpec> = {
  perderNiveis: { desc: "Perca níveis.", params: qtd() },
  perderSlot: {
    desc: "Perca os itens de um slot.",
    params: { slot: { tipo: "texto", desc: "capacete, peitoral, calcas, botas, montaria ou maos", obrigatorio: true, opcoes: ["capacete", "peitoral", "calcas", "botas", "montaria", "maos"] } },
  },
  perderAneis: { desc: "Perca anéis à sua escolha (use \"todos\" para todos).", params: { quantidade: { tipo: "texto", desc: "número ou \"todos\"", obrigatorio: true } } },
  perderCartasDaMao: { desc: "Perca cartas aleatórias da mão.", params: qtd() },
  morte: { desc: "Morte." },
  escolherItensParaPerder: { desc: "Perca itens equipados à sua escolha.", params: qtd() },
  perderItensAleatorios: { desc: "Perca itens equipados aleatórios.", params: qtd() },
  perderGrandeOuDoisItens: { desc: "Perca 1 item Grande; sem item Grande, perca 2 itens à sua escolha." },
  perderGrandeOuNiveis: { desc: "Perca 1 item Grande ou níveis (a vítima escolhe).", params: { niveis: { tipo: "numero", desc: "níveis", obrigatorio: true } } },
  podridaoDeMumia: { desc: "Fica com -2 em combate por 2 rodadas (conta como maldição)." },
  possessao: { desc: "O jogador à esquerda escolhe 1 item seu e fica com ele." },
  quimera: { desc: "Role 1d6 três vezes: perca 1 nível para cada resultado de 1 a 3." },
  virarVampirico: { desc: "Se morrer neste combate, sua raça vira Vampírico." },
  perderItensNaoEquipados: { desc: "Perca todos os itens que não estiverem equipados." },
  outrosPerdemNiveis: { desc: "Todos os outros jogadores perdem níveis.", params: qtd() },
};
