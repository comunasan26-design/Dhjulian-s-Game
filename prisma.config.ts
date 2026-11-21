import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/lib/dbUrl";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Banco SQLite na própria pasta prisma/ (prisma/jogo.db), ou o arquivo de DATABASE_URL="file:..."
    url: databaseUrl(),
  },
});
