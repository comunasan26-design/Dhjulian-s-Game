import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { leaderboard } from "@/lib/ranked";

export const dynamic = "force-dynamic";

/** Ranking público (top 50, só quem já terminou as partidas de colocação). */
export const GET = handle(async () => NextResponse.json({ rows: await leaderboard(50) }));
