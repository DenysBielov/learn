"use client";

import { BookOpen, Brain, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface GraphNodeProps {
  title: string;
  stepType: "material" | "quiz";
  status: "completed" | "current" | "pending" | "locked";
  x: number;
  y: number;
  onHover?: (hovered: boolean) => void;
}

export function GraphNode({ title, stepType, status, x, y, onHover }: GraphNodeProps) {
  const Icon = stepType === "material" ? BookOpen : Brain;

  return (
    <div
      className={cn(
        "absolute w-[180px] bg-card border rounded-[10px] p-3 transition-colors cursor-default",
        status === "completed" && "border-green-500/30",
        status === "current" && "border-blue-500/30 bg-blue-500/[0.04]",
        status === "pending" && "",
        status === "locked" && "opacity-50",
      )}
      style={{
        left: x,
        top: y,
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div className="flex items-center gap-2 mb-1">
        {status === "completed" ? (
          <div className="h-5 w-5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-green-400" />
          </div>
        ) : status === "locked" ? (
          <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs truncate font-medium">{title}</span>
      </div>
      <div className="text-[10px] text-muted-foreground capitalize">{stepType}</div>
    </div>
  );
}
