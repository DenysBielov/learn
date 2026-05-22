"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const LABELS = ["Guess", "Unsure", "OK", "Confident", "Certain"] as const;

interface Props {
  value: 1 | 2 | 3 | 4 | 5 | null;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

export function ConfidenceScale({ value, onChange, disabled }: Props) {
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        onChange(n as 1 | 2 | 3 | 4 | 5);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onChange, disabled]);

  return (
    <div role="radiogroup" aria-label="How sure are you?" className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">How sure are you?</span>
      <div className="grid grid-cols-5 gap-2">
        {LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4 | 5;
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              <span className="block font-medium">{n}</span>
              <span className="block text-xs opacity-80">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
