// Ferramentas para quem edita as cartas.
//   npm run cartas:validar  → confere os arquivos da pasta /cartas e mostra os erros em português
//   npm run cartas:docs     → gera cartas/EFEITOS.md com todos os efeitos disponíveis
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import {
  ACTIONS,
  BAD_STUFF_TYPES,
  PLAYER_EFFECTS,
  CURSE_EFFECTS,
  type EffectSpec,
  ITEM_EFFECTS,
  MISC_EFFECTS,
  MONSTER_EFFECTS,
  POTION_EFFECTS,
  RUNE_EFFECTS,
} from "../src/game/catalog/effects.ts";
const cmd = process.argv[2];

/** Confere a sintaxe dos arquivos antes de carregar (mensagem com linha e coluna). */
function checkSyntax(): boolean {
  const dir = new URL("../cartas/", import.meta.url);
  let ok = true;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const raw = readFileSync(new URL(f, dir), "utf8");
    try {
      JSON.parse(raw);
    } catch (e) {
      ok = false;
      const m = /position (\d+)/.exec((e as Error).message);
      let where = "";
      if (m) {
        const pos = Number(m[1]);
        const before = raw.slice(0, pos);
        const line = before.split("\n").length;
        const col = pos - before.lastIndexOf("\n");
        where = ` (linha ${line}, coluna ${col}: "${raw.split("\n")[line - 1].trim()}")`;
      }
      console.error(`  • cartas/${f}: o arquivo não é um JSON válido${where}. Confira vírgulas, aspas e chaves nessa linha e na anterior.`);
    }
  }
  return ok;
}

if (cmd === "validar" || cmd === "docs") {
  if (!checkSyntax()) {
    console.error("\n❌ Corrija o(s) arquivo(s) acima e rode de novo: npm run cartas:validar\n");
    process.exit(1);
  }
}
const { loadCatalog } = await import("../src/game/catalog/load.ts");

if (cmd === "validar") {
  const c = loadCatalog();
  if (c.problems.length) {
    console.error(`\n❌ Encontrei ${c.problems.length} problema(s) nas cartas:\n`);
    for (const p of c.problems) console.error(`  • ${p}`);
    console.error("\nCorrija e rode de novo: npm run cartas:validar\n");
    process.exit(1);
  }
  const door = [...c.races, ...c.classes, ...c.monsters, ...c.curses, ...c.bonuses, ...c.wandering].reduce((a, x) => a + (x.copies ?? 1), 0);
  const treasure = [...c.items, ...c.potions, ...c.runes, ...c.misc, ...c.levelUps].reduce((a, x) => a + (x.copies ?? 1), 0);
  console.log(`\n✅ Tudo certo! ${door} cartas de Porta e ${treasure} de Tesouro.\n`);
} else if (cmd === "docs") {
  const section = (title: string, file: string, reg: Record<string, EffectSpec>) => {
    let out = `## ${title}\n\nUsados em \`${file}\`.\n\n`;
    for (const [tipo, spec] of Object.entries(reg)) {
      out += `### \`${tipo}\`\n\n${spec.desc}\n\n`;
      const params = Object.entries(spec.params ?? {});
      if (params.length) {
        out += "| Parâmetro | Tipo | Obrigatório | O que faz |\n|---|---|---|---|\n";
        for (const [k, p] of params) out += `| \`${k}\` | ${p.tipo} | ${p.obrigatorio ? "sim" : "não"} | ${p.desc} |\n`;
        out += "\n";
      }
      const example: Record<string, unknown> = { tipo };
      for (const [k, p] of params) {
        if (!p.obrigatorio && params.length > 2) continue;
        example[k] = p.opcoes ? p.opcoes[0] : p.tipo === "numero" ? 2 : p.tipo === "sim/nao" ? true : p.tipo === "lista" ? (k === "classes" ? ["mago"] : k === "tags" || k.endsWith("Tags") ? ["fogo"] : k === "slots" ? ["capacete"] : ["elfo"]) : "exemplo";
      }
      out += "```json\n" + JSON.stringify(example) + "\n```\n\n";
    }
    return out;
  };
  const cat = loadCatalog();
  const RACE_IDS: string[] = cat.raceIds;
  const CLASS_IDS: string[] = cat.classIds;
  let md = "# Referência de efeitos\n\n";
  md += "> Arquivo gerado automaticamente por `npm run cartas:docs`. Não edite à mão.\n\n";
  md += `Raças válidas (para \`racas\`): ${RACE_IDS.map((r) => `\`${r}\``).join(", ")}.\n\n`;
  md += `Classes válidas (para \`classes\`): ${CLASS_IDS.map((r) => `\`${r}\``).join(", ")}.\n\n`;
  md += "Tags de monstro (para `tags`): `morto-vivo`, `demonio`, `dragao`, `fogo`, `aquatico`, `animal`, `voador`, `sagrado`.\n\n";
  md += "## Desenhos disponíveis (imagens.json)\n\nUse no campo `\"imagem\"` das cartas. Para criar novos, veja o LEIA-ME.\n\n" + Object.keys(cat.art.desenhos).map((n) => "`" + n + "`").join(", ") + "\n\n";
  md += section("Passivas de raças e classes", "racas.json / classes.json (campo \"passiva.efeitos\")", PLAYER_EFFECTS);
  md += "## Ativas de raças e classes\n\nCada ativa (lista `\"ativas\"` em racas.json/classes.json) tem `id`, `nome`, `texto`, `acao` (um dos tipos abaixo), `limite` (`combate`, `rodada`, `turno` ou `turnoProprio`), opcionalmente `custo` (`{ \"descartar\": 2 }` ou `{ \"descartarMao\": 4 }`) e os parâmetros da ação. Qualquer número pode variar com o nível usando `<parametro>PorNivel`, ex.: `\"valor\": 2, \"valorPorNivel\": { \"11\": 4 }`.\n\n";
  md += section("Ações (tipos de ativa)", "racas.json / classes.json (campo \"ativas\", chave \"acao\")", ACTIONS).replace(/^## Ações[^\n]*\n\n[^\n]*\n\n/, "").replace(/"tipo":/g, '"acao":');
  md += section("Efeitos de itens", "itens.json", ITEM_EFFECTS);
  md += section("Efeitos de monstros", "monstros.json (campo \"efeitos\")", MONSTER_EFFECTS);
  md += section("Coisas Ruins de monstros", "monstros.json (campo \"coisasRuins\")", BAD_STUFF_TYPES);
  md += section("Efeitos de maldições", "maldicoes.json", CURSE_EFFECTS);
  md += section("Efeitos de poções", "pocoes.json", POTION_EFFECTS);
  md += section("Efeitos de runas", "runas.json", RUNE_EFFECTS);
  md += section("Efeitos de itens diversos", "diversos.json", MISC_EFFECTS);
  writeFileSync(new URL("../cartas/EFEITOS.md", import.meta.url), md);
  console.log("cartas/EFEITOS.md gerado.");
} else {
  console.log("Uso: npm run cartas:validar | npm run cartas:docs");
}
