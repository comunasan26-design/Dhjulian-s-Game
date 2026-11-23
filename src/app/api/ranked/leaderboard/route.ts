import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { leaderboard } from "@/lib/ranked";

export const dynamic = "force-dynamic";

/** Ranking público (top 50, quem já jogou pelo menos 1 ranqueada; "?" = rating provisório). */
export const GET = handle(async () => NextResponse.json({ rows: await leaderboard(50) }));
