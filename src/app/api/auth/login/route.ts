import { NextResponse } from "next/server";
import { createSession, findUserByName, verifyPassword } from "@/lib/auth";
import { HttpError, handle, readJson } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) throw new HttpError(400, "Informe usuário e senha.");

  const user = await findUserByName(username);
  // (o cadastro já diz quais nomes existem, então dizer qual dos dois errou não expõe nada a mais)
  if (!user) throw new HttpError(401, `Não existe conta "${username}" neste servidor. Use "Criar conta".`);
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, "Senha incorreta.");
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, username: user.username } });
});
