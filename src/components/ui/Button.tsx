"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

const styles: Record<Variant, string> = {
  primary: "bg-gold text-black hover:bg-gold-2 border-gold",
  secondary: "bg-panel-2 text-ink hover:bg-edge border-edge",
  danger: "bg-blood/90 text-white hover:bg-blood border-blood",
  success: "bg-moss/90 text-white hover:bg-moss border-moss",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-panel-2 border-transparent",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "px-2 py-1 text-xs" : size === "lg" ? "px-5 py-3 text-base" : "px-3 py-1.5 text-sm";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${sz} ${styles[variant]} ${className}`}
    />
  );
}
