"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CardView } from "./CardView";

export interface PickOption {
  value: string;
  label: string;
  sub?: string;
  card?: string;
  disabled?: boolean;
}

interface Req {
  title: string;
  description?: string;
  options: PickOption[];
  multi: boolean;
  count?: number;
  min?: number;
  resolve: (v: string[] | null) => void;
}

interface PickerApi {
  pick: (o: { title: string; description?: string; options: PickOption[] }) => Promise<string | null>;
  pickMany: (o: { title: string; description?: string; options: PickOption[]; count?: number; min?: number }) => Promise<string[] | null>;
  confirm: (title: string, description?: string) => Promise<boolean>;
}

const Ctx = createContext<PickerApi | null>(null);

export function usePicker(): PickerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("PickerProvider ausente");
  return c;
}

export function PickerProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const reqRef = useRef<Req | null>(null);

  const open = useCallback((r: Req) => {
    reqRef.current?.resolve(null);
    reqRef.current = r;
    setSel([]);
    setReq(r);
  }, []);

  const close = useCallback((v: string[] | null) => {
    const r = reqRef.current;
    reqRef.current = null;
    setReq(null);
    r?.resolve(v);
  }, []);

  const api: PickerApi = {
    pick: (o) =>
      new Promise((resolve) => {
        if (o.options.length === 0) return resolve(null);
        open({ ...o, multi: false, resolve: (v) => resolve(v ? v[0] : null) });
      }),
    pickMany: (o) =>
      new Promise((resolve) => {
        if (o.count === 0) return resolve([]);
        open({ ...o, multi: true, resolve });
      }),
    confirm: (title, description) =>
      new Promise((resolve) => {
        open({
          title,
          description,
          multi: false,
          options: [
            { value: "yes", label: "Confirmar" },
            { value: "no", label: "Cancelar" },
          ],
          resolve: (v) => resolve(!!v && v[0] === "yes"),
        });
      }),
  };

  const valid =
    req?.multi && (req.count !== undefined ? sel.length === req.count : sel.length >= (req.min ?? 1));

  return (
    <Ctx.Provider value={api}>
      {children}
      <Modal open={!!req} title={req?.title ?? ""} onClose={() => close(null)} wide={(req?.options.length ?? 0) > 6}>
        {req?.description && <p className="mb-3 text-sm text-muted">{req.description}</p>}
        {req?.multi && (
          <p className="mb-2 text-xs text-gold">
            Selecionadas: {sel.length}
            {req.count !== undefined ? ` / ${req.count}` : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {req?.options.map((o) => {
            const active = sel.includes(o.value);
            const onClick = () => {
              if (o.disabled) return;
              if (!req.multi) return close([o.value]);
              setSel((s) =>
                s.includes(o.value)
                  ? s.filter((x) => x !== o.value)
                  : req.count !== undefined && s.length >= req.count
                    ? s
                    : [...s, o.value],
              );
            };
            if (o.card) {
              return (
                <div key={o.value} className={o.disabled ? "opacity-40" : ""}>
                  <CardView id={o.card} onClick={onClick} selected={active} />
                </div>
              );
            }
            return (
              <button
                key={o.value}
                onClick={onClick}
                disabled={o.disabled}
                className={`min-w-[8rem] rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-40 ${
                  active ? "border-gold bg-gold/15" : "border-edge bg-panel-2 hover:border-gold/70"
                }`}
              >
                <div className="font-medium">{o.label}</div>
                {o.sub && <div className="text-xs text-muted">{o.sub}</div>}
              </button>
            );
          })}
        </div>
        {req?.multi && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => close(null)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!valid} onClick={() => close(sel)}>
              Confirmar
            </Button>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
