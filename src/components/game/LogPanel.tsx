"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameContext";

const KIND_COLOR: Record<string, string> = {
  combat: "text-red-200",
  dice: "text-sky-200",
  curse: "text-purple-200",
  chat: "text-emerald-200",
  system: "text-gold-2",
  level: "text-amber-200",
  info: "text-ink/90",
};

export function LogPanel() {
  const api = useGame();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"all" | "chat">("all");
  const ref = useRef<HTMLDivElement>(null);
  const entries = api.view.log.filter((l) => tab === "all" || l.kind === "chat");
  const last = entries[entries.length - 1]?.id;
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [last]);
  return (
    <div className="flex h-full min-h-[16rem] flex-col rounded-xl border border-edge bg-panel">
      <div className="flex border-b border-edge text-sm">
        {(["all", "chat"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? "text-gold-2" : "text-muted"}`}>
            {t === "all" ? "Histórico" : "Chat"}
          </button>
        ))}
      </div>
      <div ref={ref} className="scroll-thin flex-1 space-y-1 overflow-y-auto p-2 text-xs">
        {entries.map((l) => (
          <p key={l.id} className={KIND_COLOR[l.kind] ?? "text-ink"}>
            {l.text}
          </p>
        ))}
      </div>
      <form
        className="flex gap-1 border-t border-edge p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void api.act({ type: "CHAT", text });
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Mensagem…"
          className="min-w-0 flex-1 rounded-md border border-edge bg-bg px-2 py-1 text-sm outline-none focus:border-gold"
        />
        <button className="rounded-md bg-panel-2 px-3 text-sm text-gold-2 hover:bg-edge">Enviar</button>
      </form>
    </div>
  );
}
