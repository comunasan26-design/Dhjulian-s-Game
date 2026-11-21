import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrl } from "./dbUrl";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

/**
 * Deixa o arquivo pronto antes do Prisma abrir: tudo é gravado direto em prisma/jogo.db (modo "DELETE"),
 * sem os arquivos -wal/-shm ao lado. Se eles existirem (versão anterior), o conteúdo volta para o jogo.db e eles somem.
 */
function prepareFile(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  try {
    sqlite.pragma("journal_mode = DELETE");
  } finally {
    sqlite.close();
  }
}

function createClient(): PrismaClient {
  const url = databaseUrl();
  prepareFile(url.replace(/^file:/, ""));
  // SQLite num arquivo da pasta prisma/ (veja src/lib/dbUrl.ts). Espera até 5 s se outro acesso estiver gravando.
  const adapter = new PrismaBetterSqlite3({ url, timeout: 5000 });
  return new PrismaClient({ adapter });
}

/** Cliente Prisma criado sob demanda (nada de banco durante o build). */
export function db(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createClient();
  }
  return globalForPrisma.__prisma;
}
