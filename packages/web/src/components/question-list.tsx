"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { deleteQuizQuestion } from "@/app/actions/quiz";
import { RichContent } from "@/components/rich-content";
import { useState } from "react";

interface QuestionOption {
  id: number;
  optionText: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  type: string;
  options: QuestionOption[];
}

interface QuestionListProps {
  questions: QuizQuestion[];
  deckId: number;
}

export function QuestionList({ questions, deckId }: QuestionListProps) {
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
      {questions.map((question) => (
        <Card key={question.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
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
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(question.id)}
                disabled={deletingId === question.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
