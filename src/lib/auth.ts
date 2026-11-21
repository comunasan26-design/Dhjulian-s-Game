import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "dg_session";
const SESSION_DAYS = 30;

export type CurrentUser = { id: string; username: string };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string") return "Usuário inválido.";
  const u = username.trim();
  if (u.length < 3 || u.length > 20) return "O usuário deve ter entre 3 e 20 caracteres.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return "Use apenas letras, números, ponto, hífen ou sublinhado.";
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Senha inválida.";
  if (password.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
  if (password.length > 100) return "Senha longa demais.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Cria uma sessão no banco e grava o cookie httpOnly. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db().session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // COOKIE_SECURE=false permite login por http://IP:porta (sem HTTPS), útil para testar em painéis de hospedagem
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db().session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Lê o usuário logado a partir do cookie de sessão (ou null). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db().session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}
