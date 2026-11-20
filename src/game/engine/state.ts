// Estado completo do jogo (guardado como JSON no banco).
import type { Slot } from "../catalog/types";

export const MAX_LEVEL = 20;
export const START_HAND = 4;

/** Tempos (ms) das janelas de reação. */
export const TIMERS = {
  resolve: 60_000,
  badStuff: 25_000,
  prompt: 45_000,
  help: 35_000,
  loot: 30_000,
  trade: 60_000,
  afkSkip: 45_000,
};

export interface CardInst {
  id: string;
  defId: string;
  reforged?: boolean;
  runes?: string[];
  charges?: number;
  /** Criada por efeito (ex.: "você vira Humano"); some ao ser descartada. */
  virtual?: boolean;
  /** Monstro domado pelo Druida, usado como montaria. */
  tamed?: boolean;
  /** Equipado no slot extra do Artífice (metade do bônus). */
  artificeSecond?: boolean;
}

export interface ActiveCurse {
  id: string;
  /** defId da maldição, ou "special.sombria" / "special.mumia". */
  defId: string;
  /** Instância da carta (quando veio de uma carta). */
  cardId?: string;
  /** Turnos do alvo restantes (para maldições com duração). */
  remaining?: number;
  value?: number;
  casterId: string | null;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  level: number;
  hand: string[];
  equipped: string[];
  carried: string[];
  race: string | null;
  classes: string[];
  curses: ActiveCurse[];
  /** Maldições de combate esperando o próximo combate do alvo. */
  pendingCombatCurses: { cardId: string; casterId: string | null }[];
  /** Controle de "1x por rodada/turno/combate": chave -> marcador. */
  usage: Record<string, number>;
  streak: number;
  needsNewHand: boolean;
  hibernating: boolean;
  artificeSlots: Slot[];
  /** Níveis perdidos na rodada atual (para Cura, Gnoll). */
  lostRound: number;
  lostRoundAmount: number;
  lostRoundCorpoSeco: number;
  curseCastRound: number;
  /** Número global do turno em que o seu último turno começou. */
  lastTurnStart: number;
  /** Monstros que este jogador deve enfrentar no próximo turno (Espelho de Prata). */
  ambush: string[];
  ready: boolean;
  /** Jogador controlado pela IA. */
  bot?: boolean;
  /** Carta vista pelos Olhos da Noite (Owlin), aguardando decisão. */
  owlPeek: string | null;
}

export interface Mod {
  id: string;
  value: number;
  by: string | null;
  label: string;
  fire?: boolean;
  /** Se definido, o modificador vale só para esse jogador. */
  target?: string;
}

export interface CombatMonster {
  cardId: string;
  mods: Mod[];
  wandering: boolean;
  addedBy: string | null;
  ignoreSpecial: boolean;
  petrified?: boolean;
  ettinFight?: boolean;
  /** Efeito "aoRevelar": quanto o lutador / o monstro ganham. */
  revealPlayer?: number;
  revealMonster?: number;
  defeated?: boolean;
}

export interface HelpDeal {
  /** Quantos tesouros o ajudante leva. */
  count: number;
  /** random: sorteio; fighter: quem pediu escolhe; helper: ajudante escolhe primeiro. */
  mode: "random" | "fighter" | "helper";
}

export interface FleeResult {
  playerId: string;
  monsterCardId: string;
  roll: number;
  bonus: number;
  success: boolean;
  note?: string;
}

export interface CombatState {
  id: number;
  fighterId: string;
  helperId: string | null;
  helperDeal: HelpDeal | null;
  /** Ajudante forçado (Canto da Sereia/Amizade Duvidosa): não recebe tesouro. */
  helperForced: boolean;
  /** Ajudante passou para o lado do monstro (Naga / Ilusão Traidora). */
  helperTraitor: boolean;
  monsters: CombatMonster[];
  allies: { cardId: string; by: string }[];
  playerMods: Mod[];
  monsterSideMods: Mod[];
  /** Modificadores de Fugir por jogador (poções). */
  fleeMods: Mod[];
  stage: "fight" | "resolving" | "badstuff";
  resolveDeadline: number | null;
  passed: string[];
  flee: { results: FleeResult[]; deadline: number; confirmed: string[]; substitutes: Record<string, string> } | null;
  desafio: boolean;
  glabrezuAccepted: boolean;
  legendaryResistanceUsed: boolean;
  oniDoubled: boolean;
  /** Tesouros extras se vencer (Mapa do Tesouro). */
  mapa: number;
  pendingTraitor: boolean;
  isolated: string[];
  silenced: string[];
  cantFlee: string[];
  autoFlee: string[];
  infusions: string[];
  adaptations: { cardId: string; playerId: string }[];
  berserkDouble: string[];
  elfDouble: string[];
  screamerFor: string | null;
  bowUsedBy: string[];
  breathUsedBy: string[];
  /** Habilidades usadas neste combate: "playerId:chave". */
  used: string[];
  levelsLost: Record<string, number>;
  /** Fontes de rerrolagem já usadas (Cajado do Arquimago). */
  rerolled: string[];
  othersPenaltyApplied: boolean;
  /** Ameaças aceitas: quem ameaçou recebe tesouros se o lutador vencer. */
  bribes: { playerId: string; count: number }[];
}

export interface RewardState {
  cards: string[];
  fighterId: string;
  helperId: string | null;
  deal: HelpDeal | null;
  faceUp: boolean;
  bardo: boolean;
  helperExtra: number;
  bribes?: { playerId: string; count: number }[];
}

export type PromptKind =
  | "helpRequest"
  | "helpOffer"
  | "fairySwap"
  | "chooseLoss"
  | "bigOrLevels"
  | "distribute"
  | "bardo"
  | "loot"
  | "charity"
  | "trade"
  | "fairyCurse"
  | "possession"
  | "slipperyFingers"
  | "debt"
  | "threat";

export interface Prompt {
  id: string;
  kind: PromptKind;
  playerId: string;
  deadline: number;
  /** Bloqueia o fim do turno / próxima porta enquanto existir. */
  blocking: boolean;
  data: Record<string, unknown>;
}

export interface Notice {
  id: string;
  playerId: string;
  text: string;
  cards: string[];
  kind?: "owl";
}

export interface LogEntry {
  id: number;
  t: number;
  text: string;
  kind: "info" | "combat" | "dice" | "curse" | "chat" | "system" | "level";
  by?: string;
}

export type TurnPhase = "KICK" | "AFTER_DOOR" | "COMBAT" | "END";

export interface GameState {
  phase: "SETUP" | "PLAYING" | "FINISHED";
  players: PlayerState[];
  /** Ordem dos turnos (ids). */
  order: string[];
  currentIdx: number;
  round: number;
  turnSerial: number;
  turnPhase: TurnPhase;
  turn: {
    fought: boolean;
    lastResult: "won" | "fled" | "lost" | "ended" | null;
    revealed: string | null;
    owlStartDone: boolean;
    owlEndDone: boolean;
    ending: boolean;
    wonCombat: boolean;
    /** Níveis perdidos no último combate (Poção de Cura). */
    lastCombatLost: Record<string, number>;
  };
  decks: { door: string[]; treasure: string[]; doorDiscard: string[]; treasureDiscard: string[] };
  cards: Record<string, CardInst>;
  nextCardId: number;
  combat: CombatState | null;
  combatCounter: number;
  reward: RewardState | null;
  prompts: Prompt[];
  notices: Notice[];
  log: LogEntry[];
  logCounter: number;
  idCounter: number;
  winnerId: string | null;
  initialRolls: Record<string, number>;
  /** Últimos tesouros abertos (para o Goblin roubar). */
  lastFaceUp: { ownerId: string; cards: string[]; turnSerial: number } | null;
  /** Último item descartado por outro jogador (para o Catador do Goblin). */
  lastItemDiscard: { cardId: string; by: string; tried: string[] } | null;
  hostId: string;
  lastActionAt: number;
  /** Próximo momento em que um bot pode agir (ritmo dos bots). */
  botNextAt?: number;
  /** Tréguas: quem aceitou suborno não pode atrapalhar o protegido nesta rodada. */
  truces?: { by: string; protects: string; round: number }[];
  /** Jogadores que desistiram. */
  leftPlayers?: { id: string; name: string }[];
  /** Todos os humanos desistiram: a sala deve ser fechada. */
  closed?: boolean;
  /** Memória dos bots (pedidos já feitos, trocas tentadas…). */
  botMemory?: Record<string, number>;
}

export interface Rng {
  /** Inteiro em [0, max). */
  int(max: number): number;
}

export interface Ctx {
  now: number;
  rng: Rng;
  /** Jogadores atualmente desconectados. */
  offline?: Set<string>;
}

export class GameError extends Error {
  readonly isGameError = true;
}

export function fail(msg: string): never {
  throw new GameError(msg);
}
