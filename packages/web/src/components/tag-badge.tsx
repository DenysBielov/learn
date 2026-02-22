"use client";

import { X } from "lucide-react";
import { getContrastColor } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  tag: { id: number; name: string; color: string | null };
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  count?: number;
}

export function TagBadge({ tag, onRemove, onClick, active, className, count }: TagBadgeProps) {
  const bgColor = tag.color || "#8b5cf6";
  const textColor = getContrastColor(bgColor);

  const content = (
    <>
      <span>{tag.name}</span>
      {count !== undefined && (
        <span className="opacity-75">{count}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </>
  );

  const baseClasses = cn(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all",
    active && "ring-2 ring-offset-1 ring-current",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClasses, "cursor-pointer hover:opacity-80", !active && "opacity-60")}
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={baseClasses}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {content}
    </span>
  );
}
