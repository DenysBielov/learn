"use client";

import {
  BookOpen, Brain, Layers, ChevronRight, Check, Circle, FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TreeItem =
  | { type: "step"; id: number; stepType: "material" | "quiz"; title: string; materialId: number | null; quizId: number | null; isCompleted: boolean }
  | { type: "deck"; deckId: number; name: string; flashcardCount: number; questionCount: number; dueCount: number }
  | { type: "subcourse"; id: number; name: string; color: string; isActive: boolean; totalDecks: number; dueCards: number };

interface CourseTreeProps {
  items: TreeItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function getItemId(item: TreeItem): string {
  if (item.type === "step") return `step-${item.id}`;
  if (item.type === "deck") return `deck-${item.deckId}`;
  return `course-${item.id}`;
}

function getItemIcon(item: TreeItem) {
  if (item.type === "step") {
    return item.stepType === "material" ? BookOpen : Brain;
  }
  if (item.type === "deck") return Layers;
  return FolderOpen;
}

export function CourseTree({ items, selectedId, onSelect }: CourseTreeProps) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        No items in this course yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {items.map((item) => {
        const itemId = getItemId(item);
        const isSelected = selectedId === itemId;
        const Icon = getItemIcon(item);

        return (
          <button
            key={itemId}
            onClick={() => onSelect(itemId)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors w-full",
              isSelected
                ? "bg-blue-500/[0.06] border border-blue-500/25 text-foreground"
                : "hover:bg-[var(--card-hover)] border border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {/* Status indicator for steps */}
            {item.type === "step" && (
              <div className="shrink-0">
                {item.isCompleted ? (
                  <div className="h-5 w-5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-400" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted/30 border border-muted-foreground/20 flex items-center justify-center">
                    <Circle className="h-2.5 w-2.5 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            )}

            {item.type !== "step" && (
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}

            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {item.type === "step" ? item.title : item.type === "deck" ? item.name : item.name}
              </div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">
                {item.type === "step" && (
                  <span className="capitalize">{item.stepType}</span>
                )}
                {item.type === "deck" && (
                  <span>{item.flashcardCount} cards{item.dueCount > 0 && ` \u00b7 ${item.dueCount} due`}</span>
                )}
                {item.type === "subcourse" && (
                  <span>{item.totalDecks} decks{item.dueCards > 0 && ` \u00b7 ${item.dueCards} due`}</span>
                )}
              </div>
            </div>

            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          </button>
        );
      })}
    </div>
  );
}
