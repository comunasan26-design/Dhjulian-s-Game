// Onde fica o banco SQLite. Usado pelo app (src/lib/db.ts) e pelo Prisma CLI (prisma.config.ts).
// Padrão: prisma/jogo.db na pasta do projeto. DATABASE_URL="file:caminho" troca o arquivo
// (caminhos relativos partem da pasta do projeto). URLs que não são "file:" são ignoradas.
import path from "node:path";

export function databaseUrl(root = process.cwd()): string {
  const env = (process.env.DATABASE_URL ?? "").trim();
  if (env.startsWith("file:")) {
    const file = env.slice("file:".length);
    return "file:" + (path.isAbsolute(file) ? file : path.resolve(root, file));
  }
  if (env) console.warn("⚠️  DATABASE_URL não aponta para um arquivo SQLite (file:...); usando prisma/jogo.db.");
  return "file:" + path.join(root, "prisma", "jogo.db");
}
