"use client";

import { useMemo, useState } from "react";
import { ALL_CARDS, type CardDef } from "@/game/catalog";
import { KIND_LABEL, KIND_STYLE, fullText, shortInfo } from "@/game/display";
import { openZoom } from "./art/zoom";
import { CardView } from "./game/CardView";

const KINDS = Object.keys(KIND_LABEL) as CardDef["kind"][];

export function CardBrowser() {
  const [kind, setKind] = useState<CardDef["kind"] | "all">("all");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"cartas" | "lista">("cartas");
  const list = useMemo(
    () =>
      ALL_CARDS.filter((c) => (kind === "all" || c.kind === kind) && (q === "" || c.name.toLowerCase().includes(q.toLowerCase()))),
    [kind, q],
  );
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar carta…"
          className="rounded-md border border-edge bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as CardDef["kind"] | "all")} className="rounded-md border border-edge bg-bg px-2 text-sm">
          <option value="all">Todos os tipos</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-muted">{list.length} carta(s)</span>
        <div className="ml-auto flex overflow-hidden rounded-md border border-edge text-xs">
          {(["cartas", "lista"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 ${mode === m ? "bg-panel-2 text-gold-2" : "text-muted"}`}>
              {m === "cartas" ? "Cartas" : "Lista"}
            </button>
          ))}
        </div>
      </div>
      {mode === "cartas" && (
        <>
          <p className="mt-2 text-xs text-muted">Toque numa carta para erguer; toque de novo para virar e ler o que ela faz.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
            {list.map((c) => (
              <CardView key={c.id} defId={c.id} onClick={() => openZoom({ defId: c.id })} />
            ))}
          </div>
        </>
      )}
      <div className={`mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${mode === "lista" ? "" : "hidden"}`}>
        {list.map((c) => (
          <div key={c.id} className={`rounded-lg border-2 p-2 text-sm ${KIND_STYLE[c.kind]}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {KIND_LABEL[c.kind]} · {shortInfo(c)}
              {(c.copies ?? 1) > 1 ? ` · ${c.copies} cópias` : ""}
            </p>
            <p className="font-display text-base">{c.name}</p>
            {fullText(c).map((t, i) => (
              <p key={i} className="mt-1 text-xs text-ink/85">
                {t}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
