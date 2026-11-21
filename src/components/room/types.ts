import type { GameView } from "@/game/engine";

export interface RoomInfo {
  code: string;
  name: string;
  status: "LOBBY" | "PLAYING" | "FINISHED";
  hostId: string;
  maxPlayers: number;
  bots: number;
  /** Dificuldade dos bots (1 a 30). */
  botSkill: number;
  /** Partida do modo ranqueado. */
  ranked: boolean;
  version: number;
  players: { id: string; username: string; seat: number; online: boolean }[];
}

export interface RoomPayload {
  room: RoomInfo;
  game: GameView | null;
}
