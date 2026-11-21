import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrl } from "./dbUrl";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  // SQLite num arquivo da pasta prisma/ (veja src/lib/dbUrl.ts). Espera até 5 s se outro acesso estiver gravando.
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl(), timeout: 5000 });
  const client = new PrismaClient({ adapter });
  // WAL: leituras (stream das salas) não ficam bloqueadas enquanto uma jogada é gravada
  void client.$queryRawUnsafe("PRAGMA journal_mode = WAL").catch(() => {});
  return client;
}

/** Cliente Prisma criado sob demanda (nada de banco durante o build). */
export function db(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createClient();
  }
  return globalForPrisma.__prisma;
}
