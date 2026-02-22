"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { deleteQuizQuestion } from "@/app/actions/quiz";
import { RichContent } from "@/components/rich-content";
import { TagBadge } from "@/components/tag-badge";
import { TagPopover } from "@/components/tag-popover";
import { useState } from "react";
import type { Tag } from "@/lib/tags";

interface QuestionOption {
  id: number;
  optionText: string;
  isCorrect: boolean;
}

interface QuestionTag {
  tag: Tag;
}

interface QuizQuestion {
  id: number;
  question: string;
  type: string;
  options: QuestionOption[];
  correctAnswer?: string | null;
  tags?: QuestionTag[];
}

interface QuestionListProps {
  questions: QuizQuestion[];
  deckId: number;
  allTags?: Tag[];
  selectable?: boolean;
  selectedIds?: Set<number>;
  onSelectionChange?: (id: number) => void;
}

export function QuestionList({
  questions,
  deckId,
  allTags = [],
  selectable = false,
  selectedIds,
  onSelectionChange,
}: QuestionListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this question?")) return;

    setDeletingId(id);
    try {
      await deleteQuizQuestion(id, deckId);
    } catch (error) {
      console.error("Failed to delete question:", error);
    } finally {
      setDeletingId(null);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No quiz questions yet. Create your first question to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => {
        const questionTags = question.tags?.map((t) => t.tag) ?? [];
        const isSelected = selectedIds?.has(question.id) ?? false;

        return (
          <Card key={question.id} className={isSelected ? "ring-2 ring-primary" : undefined}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {selectable && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelectionChange?.(question.id)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 space-y-3 min-w-0">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="capitalize">
                      {question.type.replace("_", " ")}
                    </Badge>
                    {question.options.length > 0 && (
                      <Badge variant="secondary">
                        {question.options.length} option{question.options.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm font-medium"><RichContent content={question.question} /></div>
                  {question.options.length > 0 && (
                    <div className="space-y-1">
                      {question.options.map((option) => (
                        <div
                          key={option.id}
                          className={`text-xs px-2 py-1 rounded ${
                            option.isCorrect ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-muted"
                          }`}
                        >
                          {option.isCorrect && "✓ "}
                          <RichContent content={option.optionText} className="inline" />
                        </div>
                      ))}
                    </div>
                  )}
                  {question.type === "cloze" && question.correctAnswer && (
                    <div className="text-xs px-2 py-1 rounded bg-muted">
                      {(() => {
                        try {
                          const data = JSON.parse(question.correctAnswer);
                          return data.text?.replace(/\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/g, '[___]') || "";
                        } catch { return ""; }
                      })()}
                    </div>
                  )}
                  {question.type === "code_eval" && question.correctAnswer && (
                    <div className="text-xs px-2 py-1 rounded bg-muted font-mono">
                      {(() => {
                        try {
                          const data = JSON.parse(question.correctAnswer);
                          return `${data.language || "code"} (${data.mode})`;
                        } catch { return "code"; }
                      })()}
                    </div>
                  )}
                  {(questionTags.length > 0 || allTags.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {questionTags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                      <TagPopover
                        mode="single"
                        allTags={allTags}
                        assignedTagIds={questionTags.map((t) => t.id)}
                        itemId={question.id}
                        itemType="question"
                        deckId={deckId}
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(question.id)}
                  disabled={deletingId === question.id}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
