// Inicia o jogo em painéis de hospedagem (Pterodactyl e parecidos) que só deixam escolher o "arquivo principal".
// Compila o jogo quando o código muda, aplica as migrações do banco e sobe o Next.js na porta do painel.
// Uso: coloque "deploy/start.cjs" como arquivo principal (Main file). O banco SQLite fica em prisma/jogo.db.
/* eslint-disable @typescript-eslint/no-require-imports -- arquivo CommonJS executado direto pelo Node */
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
process.chdir(root);

const port = process.env.SERVER_PORT || process.env.PORT || "3000";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(cmd, args, fatal = true) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status === 0) return true;
  console.error(`Falhou: ${cmd} ${args.join(" ")} (código ${r.status ?? r.signal})`);
  if (fatal) process.exit(r.status || 1);
  return false;
}

// Versão do código: commit do git (ou a data do package.json, sem git)
function codeVersion() {
  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (git.status === 0 && git.stdout.trim()) return git.stdout.trim();
  return String(fs.statSync("package.json").mtimeMs);
}

const stampFile = path.join(".next", "deploy-version");
const version = codeVersion();
const built = fs.existsSync(path.join(".next", "BUILD_ID")) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, "utf8") === version;
if (!built) {
  // código novo pode trazer dependências novas
  run(npm, ["install", "--include=dev", "--no-audit", "--no-fund"]);
  run(npm, ["run", "build"]);
  fs.writeFileSync(stampFile, version);
} else console.log("\nCódigo sem mudanças: usando a compilação anterior.");

// cria/atualiza o banco SQLite (prisma/jogo.db); se falhar, o servidor sobe mesmo assim (o modo local funciona)
if (!run(npx, ["prisma", "migrate", "deploy"], false))
  console.warn("\n⚠️  Não deu para criar/atualizar o banco em prisma/. As salas online não vão funcionar.");

console.log(`\nIniciando na porta ${port}...`);
const next = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", port, "-H", "0.0.0.0"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill(sig));
next.on("exit", (code) => process.exit(code ?? 0));
