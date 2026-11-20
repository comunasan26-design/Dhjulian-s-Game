import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Você precisa estar logado.");
  return user;
}

/** Envolve um handler para converter erros em respostas JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.status, err.message);
      if (err instanceof Error && "isGameError" in err) {
        return jsonError(400, err.message);
      }
      console.error(err);
      return jsonError(500, "Erro interno do servidor.");
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    // corpo inválido
  }
  throw new HttpError(400, "Corpo da requisição inválido.");
}
