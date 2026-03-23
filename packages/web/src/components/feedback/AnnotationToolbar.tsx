"use client";

import { Button } from "@/components/ui/button";
import { Pencil, MoveRight, Type, Undo2, Redo2, Trash2, Keyboard, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { AnnotationTool } from "./types";

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const SHORTCUTS = [
  { keys: "1 / M", action: "Marker tool" },
  { keys: "2 / A", action: "Arrow tool" },
  { keys: "3 / T", action: "Text tool" },
  { keys: "Ctrl+Z", action: "Undo" },
  { keys: "Ctrl+Y", action: "Redo" },
  { keys: "Ctrl+Shift+X", action: "Clear all" },
] as const;

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: AnnotationToolbarProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  const tools: { id: AnnotationTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: "marker", icon: <Pencil className="size-4" />, label: "Marker", shortcut: "1" },
    { id: "arrow", icon: <MoveRight className="size-4" />, label: "Arrow", shortcut: "2" },
    { id: "text", icon: <Type className="size-4" />, label: "Text", shortcut: "3" },
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={activeTool === tool.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`gap-1.5 ${activeTool !== tool.id ? "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10" : ""}`}
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </Button>
        ))}

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 disabled:text-muted-foreground/40"
        >
          <Undo2 className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 disabled:text-muted-foreground/40"
        >
          <Redo2 className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!canUndo}
          title="Clear all (Ctrl+Shift+X)"
          className="text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 disabled:text-muted-foreground/40"
        >
          <Trash2 className="size-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowShortcuts((v) => !v)}
          title="Keyboard shortcuts"
          className={`text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 gap-1 ${showShortcuts ? "bg-muted-foreground/10 text-foreground" : ""}`}
        >
          <Keyboard className="size-4" />
          <ChevronDown className={`size-3 transition-transform ${showShortcuts ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {showShortcuts && (
        <div className="bg-muted rounded-lg px-3 py-2 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            {SHORTCUTS.map((s) => (
              <div key={s.action} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{s.action}</span>
                <kbd className="text-[10px] text-muted-foreground border border-border bg-background px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
