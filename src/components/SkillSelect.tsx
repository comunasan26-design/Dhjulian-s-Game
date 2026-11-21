"use client";

/** Nome da faixa de dificuldade dos bots (1 a 30). */
export function skillName(skill: number): string {
  if (skill <= 5) return "Iniciante";
  if (skill <= 10) return "Fácil";
  if (skill <= 15) return "Médio";
  if (skill <= 20) return "Difícil";
  if (skill <= 25) return "Mestre";
  return "Psicopata";
}

/** Seletor da dificuldade dos bots (1 a 30). */
export function SkillSelect({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-muted ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <span>Dificuldade dos bots</span>
        <span className="text-ink">
          {value} · <span className="text-gold-2">{skillName(value)}</span>
        </span>
      </span>
      <input
        type="range"
        min={1}
        max={30}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-gold)]"
        aria-label="Dificuldade dos bots"
      />
    </label>
  );
}
