"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichContent } from "@/components/rich-content";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
}

interface OrderingProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function Ordering({ question, onAnswer, disabled }: OrderingProps) {
  const correctOrder = useMemo<string[]>(() => {
    if (!question.correctAnswer) return [];
    try {
      return JSON.parse(question.correctAnswer) as string[];
    } catch (error) {
      console.error("Error parsing ordering:", error);
      return [];
    }
  }, [question.correctAnswer]);

  const [items, setItems] = useState<string[]>(() =>
    [...correctOrder].sort(() => Math.random() - 0.5)
  );

  const moveUp = (index: number) => {
    if (disabled || index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [
      newItems[index],
      newItems[index - 1],
    ];
    setItems(newItems);
  };

  const moveDown = (index: number) => {
    if (disabled || index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [
      newItems[index + 1],
      newItems[index],
    ];
    setItems(newItems);
  };

  const handleSubmit = () => {
    const isCorrect =
      JSON.stringify(items) === JSON.stringify(correctOrder);
    onAnswer(isCorrect, JSON.stringify(items));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Arrange the items in the correct order:
        </p>
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3",
              disabled &&
                items[index] === correctOrder[index] &&
                "border-green-500 bg-green-500/10",
              disabled &&
                items[index] !== correctOrder[index] &&
                "border-destructive bg-destructive/10"
            )}
          >
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => moveUp(index)}
                disabled={disabled || index === 0}
                className="h-5 w-5"
              >
                <ChevronUp className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => moveDown(index)}
                disabled={disabled || index === items.length - 1}
                className="h-5 w-5"
              >
                <ChevronDown className="size-3" />
              </Button>
            </div>
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {index + 1}
            </div>
            <div className="flex-1"><RichContent content={item} /></div>
          </div>
        ))}
      </div>

      {!disabled && (
        <Button onClick={handleSubmit} className="w-full">
          Submit Answer
        </Button>
      )}

      {disabled && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Correct order:
          </p>
          {correctOrder.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border bg-green-500/10 p-2 text-sm"
            >
              {index + 1}. <RichContent content={item} className="inline" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
