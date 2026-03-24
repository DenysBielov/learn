"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Brain, Layers, FolderOpen, ExternalLink, Play, Clock, Loader2 } from "lucide-react";
import { stripMarkdown } from "@/lib/route-utils";
import { Button } from "@/components/ui/button";
import { StepCompleteButton } from "@/components/step-complete-button";
import { CourseStudyButton } from "@/components/course-study-button";
import { DeckStudyButton } from "@/components/deck-study-button";
import { getMaterialForPanel } from "@/app/actions/materials";
import type { TreeItem } from "@/components/course-tree";

interface CourseDetailPanelProps {
  item: TreeItem | null;
}

type MaterialPanelData = Awaited<ReturnType<typeof getMaterialForPanel>>;

function MaterialStepPanel({ item }: { item: Extract<TreeItem, { type: "step" }> }) {
  const [material, setMaterial] = useState<MaterialPanelData>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item.stepType !== "material" || !item.materialId) return;
    setLoading(true);
    getMaterialForPanel(item.materialId)
      .then(setMaterial)
      .finally(() => setLoading(false));
  }, [item.materialId, item.stepType]);

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

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild size="sm">
          <Link href={href}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {item.stepType === "material" ? "Open Material" : "Take Quiz"}
          </Link>
        </Button>
        {material?.step && (
          <StepCompleteButton stepId={material.step.id} isCompleted={material.step.isCompleted} />
        )}
      </div>

      {/* Material content */}
      {item.stepType === "material" && item.materialId && loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {item.stepType === "material" && item.materialId && !loading && material && (
        <>
          {material.description ? (
            <p className="text-sm text-muted-foreground">{material.description}</p>
          ) : material.content ? (
            <p className="text-sm text-muted-foreground">
              {stripMarkdown(material.content).slice(0, 200)}
              {material.content.length > 200 ? "..." : ""}
            </p>
          ) : null}

          {/* Linked decks */}
          {material.linkedDecks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flashcard Decks</h3>
              {material.linkedDecks.map((deck) => (
                <Link key={deck.id} href={`/study/${deck.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{deck.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{deck.flashcardCount} cards</span>
                </Link>
              ))}
            </div>
          )}

          {/* Linked quizzes */}
          {material.linkedQuizzes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quizzes</h3>
              {material.linkedQuizzes.map((quiz) => (
                <Link key={quiz.id} href={`/quizzes/${quiz.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{quiz.title}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Quiz step - just show status + link */}
      {item.stepType === "quiz" && (
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
            item.isCompleted
              ? "text-green-400 bg-green-500/10 border-green-500/20"
              : "text-muted-foreground bg-muted/30 border-muted-foreground/20"
          }`}>
            {item.isCompleted ? "Completed" : "Not started"}
          </span>
        </div>
      )}
    </div>
  );
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
    return <MaterialStepPanel item={item} />;
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

        <div className="flex gap-2">
          <DeckStudyButton
            deckId={item.deckId}
            studyUrl={`/study/${item.deckId}`}
            label="Study"
            icon={<Play className="mr-2 h-4 w-4" />}
            size="sm"
          />
          <Button asChild variant="secondary" size="sm">
            <Link href={`/decks/${item.deckId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Deck
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-[10px] p-3 text-center">
            <div className="text-lg font-bold">{item.flashcardCount}</div>
            <div className="text-xs text-muted-foreground">Cards</div>
          </div>
          <div className="bg-card border rounded-[10px] p-3 text-center">
            <div className="text-lg font-bold text-orange-400">{item.dueCount}</div>
            <div className="text-xs text-muted-foreground">Due</div>
          </div>
        </div>
      </div>
    );
  }

  // Subcourse
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-[10px] bg-muted/50 border border-border flex items-center justify-center">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{item.name}</h2>
          <span className="text-xs text-muted-foreground">Sub-Course</span>
        </div>
      </div>

      <div className="flex gap-2">
        <CourseStudyButton courseId={item.id} publicId={item.publicId} variant="sm" />
        <Button asChild variant="outline" size="sm">
          <Link href={`/courses/${item.publicId}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open
          </Link>
        </Button>
      </div>

      {item.description && (
        <p className="text-sm text-muted-foreground">{item.description}</p>
      )}

      {item.estimatedHours != null && item.estimatedHours > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{item.estimatedHours}h estimated</span>
        </div>
      )}

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
    </div>
  );
}
