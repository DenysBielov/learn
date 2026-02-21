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

interface MultipleChoiceProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function MultipleChoice({
  question,
  onAnswer,
  disabled,
}: MultipleChoiceProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shuffledOptions] = useState(() => {
    const arr = [...question.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const handleSelect = (optionId: number) => {
    if (disabled) return;
    setSelectedOption(optionId);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;

    const option = question.options.find((o) => o.id === selectedOption);
    if (!option) return;

    onAnswer(option.isCorrect, option.optionText);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {shuffledOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-all",
              "hover:border-primary focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              selectedOption === option.id &&
                "border-primary bg-primary/10 font-medium",
              disabled && "cursor-not-allowed opacity-75",
              disabled && option.isCorrect && "border-green-500 bg-green-500/10",
              disabled &&
                selectedOption === option.id &&
                !option.isCorrect &&
                "border-destructive bg-destructive/10"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  selectedOption === option.id
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50"
                )}
              >
                {selectedOption === option.id && (
                  <div className="size-2 rounded-full bg-primary-foreground" />
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
          disabled={selectedOption === null}
          className="w-full"
        >
          Submit Answer
        </Button>
      )}
    </div>
  );
}
