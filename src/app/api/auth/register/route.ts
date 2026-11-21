import { NextResponse } from "next/server";
import { createSession, findUserByName, hashPassword, validatePassword, validateUsername } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, handle, readJson } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const usernameError = validateUsername(body.username);
  if (usernameError) throw new HttpError(400, usernameError);
  const passwordError = validatePassword(body.password);
  if (passwordError) throw new HttpError(400, passwordError);
  const username = String(body.username).trim();

  const existing = await findUserByName(username);
  if (existing) throw new HttpError(409, "Esse nome de usuário já está em uso.");

  const user = await db().user.create({
    data: { username, passwordHash: await hashPassword(String(body.password)) },
    select: { id: true, username: true },
  });
  await createSession(user.id);
  return NextResponse.json({ user });
});
