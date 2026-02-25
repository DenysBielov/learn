"use client";

import {
  BookOpen, Brain, Layers, ChevronRight, Check, Circle, FolderOpen, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TreeItem =
  | { type: "step"; id: number; stepType: "material" | "quiz"; title: string; materialId: number | null; quizId: number | null; isCompleted: boolean }
  | { type: "deck"; deckId: number; name: string; flashcardCount: number; dueCount: number }
  | { type: "subcourse"; id: number; name: string; color: string; isActive: boolean; totalDecks: number; dueCards: number; description: string | null; estimatedHours: number | null };

interface CourseTreeProps {
  items: TreeItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedChildren: Record<string, TreeItem[]>;
  loadingIds: Set<string>;
  onToggleExpand: (courseId: number) => void;
  depth?: number;
}

export function getItemId(item: TreeItem): string {
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

export function CourseTree({
  items,
  selectedId,
  onSelect,
  expandedChildren,
  loadingIds,
  onToggleExpand,
  depth = 0,
}: CourseTreeProps) {
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
        const indentPx = depth * 16;

        if (item.type === "subcourse") {
          const isLoading = loadingIds.has(itemId);
          const children = expandedChildren[itemId];
          const isExpanded = Boolean(children);

          return (
            <div key={itemId}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full",
                  isSelected
                    ? "bg-blue-500/[0.06] border border-blue-500/25 text-foreground"
                    : "hover:bg-[var(--card-hover)] border border-transparent text-muted-foreground hover:text-foreground"
                )}
                style={{ paddingLeft: `${indentPx + 12}px` }}
              >
                {/* Expand/collapse chevron on the left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(item.id);
                  }}
                  className="shrink-0 flex items-center justify-center h-5 w-5 rounded hover:bg-muted/50 transition-colors"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-150",
                        isExpanded && "rotate-90"
                      )}
                    />
                  )}
                </button>

                {/* Folder icon */}
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

                {/* Text content — clicking selects the item */}
                <button
                  onClick={() => onSelect(itemId)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    <span>{item.totalDecks} decks{item.dueCards > 0 && ` \u00b7 ${item.dueCards} due`}</span>
                  </div>
                </button>
              </div>

              {/* Recursively render children when expanded */}
              {isExpanded && children && children.length > 0 && (
                <CourseTree
                  items={children}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  expandedChildren={expandedChildren}
                  loadingIds={loadingIds}
                  onToggleExpand={onToggleExpand}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

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
            style={{ paddingLeft: `${indentPx + 12}px` }}
          >
            {/* Icon for all item types */}
            {item.type === "step" ? (
              <div className="shrink-0 relative">
                <Icon className={cn("h-4 w-4", item.isCompleted ? "text-green-400" : "text-muted-foreground")} />
                {item.isCompleted && (
                  <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 border border-background flex items-center justify-center">
                    <Check className="h-1.5 w-1.5 text-white" />
                  </div>
                )}
              </div>
            ) : (
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}

            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {item.type === "step" ? item.title : item.name}
              </div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">
                {item.type === "step" && (
                  <span className="capitalize">{item.stepType}</span>
                )}
                {item.type === "deck" && (
                  <span>{item.flashcardCount} cards{item.dueCount > 0 && ` \u00b7 ${item.dueCount} due`}</span>
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
