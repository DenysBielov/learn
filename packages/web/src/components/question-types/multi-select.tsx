"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RichContent } from "@/components/rich-content";

interface QuestionOption {
  id: number;
  questionId: number;
  optionText: string;
  isCorrect: boolean;
}

interface Question {
  id: number;
  type: string;
  question: string;
  options: QuestionOption[];
}

interface MultiSelectProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function MultiSelect({
  question,
  onAnswer,
  disabled,
}: MultiSelectProps) {
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(
    new Set()
  );

  const handleSelect = (optionId: number) => {
    if (disabled) return;
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedOptions.size === 0) return;

    const correctOptionIds = new Set(
      question.options.filter((o) => o.isCorrect).map((o) => o.id)
    );

    const isCorrect =
      selectedOptions.size === correctOptionIds.size &&
      [...selectedOptions].every((id) => correctOptionIds.has(id));

    const selectedTexts = question.options
      .filter((o) => selectedOptions.has(o.id))
      .map((o) => o.optionText);

    onAnswer(isCorrect, JSON.stringify(selectedTexts));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select all that apply:
      </p>
      <div className="space-y-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-all",
              "hover:border-primary focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              selectedOptions.has(option.id) &&
                "border-primary bg-primary/10 font-medium",
              disabled && "cursor-not-allowed opacity-75",
              disabled && option.isCorrect && "border-green-500 bg-green-500/10",
              disabled &&
                selectedOptions.has(option.id) &&
                !option.isCorrect &&
                "border-destructive bg-destructive/10"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border-2",
                  selectedOptions.has(option.id)
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50"
                )}
              >
                {selectedOptions.has(option.id) && (
                  <svg
                    className="size-3 text-primary-foreground"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <RichContent content={option.optionText} className="flex-1" />
            </div>
          </button>
        ))}
      </div>

      {!disabled && (
        <Button
          onClick={handleSubmit}
          disabled={selectedOptions.size === 0}
          className="w-full"
        >
          Submit Answer
        </Button>
      )}
    </div>
  );
}
