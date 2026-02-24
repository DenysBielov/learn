"use client";

import Link from "next/link";
import { BookOpen, Brain, Layers, FolderOpen, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TreeItem } from "@/components/course-tree";

interface CourseDetailPanelProps {
  item: TreeItem | null;
}

export function CourseDetailPanel({ item }: CourseDetailPanelProps) {
  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select an item from the tree to view details
      </div>
    );
  }

  if (item.type === "step") {
    const href = item.stepType === "material" && item.materialId
      ? `/materials/${item.materialId}`
      : item.stepType === "quiz" && item.quizId
        ? `/quizzes/${item.quizId}`
        : "#";
    const Icon = item.stepType === "material" ? BookOpen : Brain;

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Icon className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <span className="text-xs text-muted-foreground capitalize">{item.stepType}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
            item.isCompleted
              ? "text-green-400 bg-green-500/10 border-green-500/20"
              : "text-muted-foreground bg-muted/30 border-muted-foreground/20"
          }`}>
            {item.isCompleted ? "Completed" : "Not started"}
          </span>
        </div>

        <div className="pt-2">
          <Button asChild size="sm">
            <Link href={href}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {item.stepType === "material" ? "Open Material" : "Take Quiz"}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (item.type === "deck") {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Layers className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <span className="text-xs text-muted-foreground">Deck</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-[10px] p-3 text-center">
            <div className="text-lg font-bold">{item.flashcardCount}</div>
            <div className="text-xs text-muted-foreground">Cards</div>
          </div>
          <div className="bg-card border rounded-[10px] p-3 text-center">
            <div className="text-lg font-bold">{item.questionCount}</div>
            <div className="text-xs text-muted-foreground">Questions</div>
          </div>
          <div className="bg-card border rounded-[10px] p-3 text-center">
            <div className="text-lg font-bold text-orange-400">{item.dueCount}</div>
            <div className="text-xs text-muted-foreground">Due</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={`/study/${item.deckId}`}>
              <Play className="mr-2 h-4 w-4" />
              Study
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/decks/${item.deckId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Deck
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Subcourse
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, border: `1px solid ${item.color}40` }}>
          <FolderOpen className="h-5 w-5" style={{ color: item.color }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{item.name}</h2>
          <span className="text-xs text-muted-foreground">Sub-Course</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border rounded-[10px] p-3 text-center">
          <div className="text-lg font-bold">{item.totalDecks}</div>
          <div className="text-xs text-muted-foreground">Decks</div>
        </div>
        <div className="bg-card border rounded-[10px] p-3 text-center">
          <div className="text-lg font-bold text-orange-400">{item.dueCards}</div>
          <div className="text-xs text-muted-foreground">Due Cards</div>
        </div>
      </div>

      <Button asChild size="sm">
        <Link href={`/courses/${item.id}`}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Course
        </Link>
      </Button>
    </div>
  );
}
