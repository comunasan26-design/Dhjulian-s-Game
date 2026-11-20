import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Em produção (Vercel) use a URL "direta" (sem pooler) para migrações, se o provedor tiver uma.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
