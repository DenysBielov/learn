"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78716c",
];

interface ColorPickerProps {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
}

export function ColorPicker({ name, defaultValue = "#6366f1", disabled }: ColorPickerProps) {
  const [color, setColor] = useState(defaultValue);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          >
            {color === c && <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          disabled={disabled}
          onChange={(e) => setColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
        />
        <span className="text-xs text-muted-foreground">Custom</span>
      </div>
      <input type="hidden" name={name} value={color} />
    </div>
  );
}
