"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl ${wide ? "max-w-4xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="font-display text-lg text-gold-2">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="rounded px-2 text-muted hover:bg-panel-2 hover:text-ink" aria-label="Fechar">
              ✕
            </button>
          )}
        </div>
        <div className="scroll-thin max-h-[calc(92vh-56px)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
