// Arquivo de partida para painéis como o Pterodactyl: baixa (ou atualiza) o jogo do GitHub e inicia.
// Copie este arquivo para a raiz do servidor (ex.: /home/container/iniciar.cjs) e use "iniciar.cjs" como Main file.
// Usa as variáveis do painel GIT_ADDRESS (repositório) e BRANCH (branch); sem elas, usa o repositório oficial e o main.
/* eslint-disable @typescript-eslint/no-require-imports -- arquivo CommonJS executado direto pelo Node */
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

process.chdir(__dirname);
const repo = process.env.GIT_ADDRESS || "https://github.com/comunasan26-design/Dhjulian-s-Game";
const branch = process.env.BRANCH || "main";

function git(args) {
  console.log(`> git ${args.join(" ")}`);
  return spawnSync("git", args, { stdio: "inherit" }).status === 0;
}

if (!fs.existsSync(".git")) {
  console.log(`Baixando ${repo} (${branch})...`);
  git(["init", "-q"]);
  git(["remote", "add", "origin", repo]);
}
// sempre pega a versão mais nova do branch (arquivos locais como .env e este arquivo não são tocados)
if (git(["fetch", "--depth", "1", "origin", branch])) git(["reset", "--hard", "FETCH_HEAD"]);
else console.warn("⚠️  Não deu para atualizar pelo GitHub; usando os arquivos que já estão aqui.");

const start = path.join(__dirname, "deploy", "start.cjs");
if (!fs.existsSync(start)) {
  console.error(`Não encontrei ${start}. Confira o repositório (${repo}) e o branch (${branch}).`);
  process.exit(1);
}
const child = spawn(process.execPath, [start], { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
