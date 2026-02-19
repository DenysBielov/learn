"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface TrueFalseProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function TrueFalse({ question, onAnswer, disabled }: TrueFalseProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const handleSelect = (answer: string) => {
    if (disabled) return;

    setSelectedAnswer(answer);
    const option = question.options.find((o) => o.optionText === answer);
    if (option) {
      onAnswer(option.isCorrect, answer);
    }
  };

  const correctAnswer = question.options.find((o) => o.isCorrect)?.optionText;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        variant="outline"
        size="lg"
        onClick={() => handleSelect("True")}
        disabled={disabled}
        className={cn(
          "h-24 text-lg font-semibold",
          selectedAnswer === "True" && "border-primary bg-primary/10",
          disabled && correctAnswer === "True" && "border-green-500 bg-green-500/10",
          disabled &&
            selectedAnswer === "True" &&
            correctAnswer !== "True" &&
            "border-destructive bg-destructive/10"
        )}
      >
        True
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => handleSelect("False")}
        disabled={disabled}
        className={cn(
          "h-24 text-lg font-semibold",
          selectedAnswer === "False" && "border-primary bg-primary/10",
          disabled &&
            correctAnswer === "False" &&
            "border-green-500 bg-green-500/10",
          disabled &&
            selectedAnswer === "False" &&
            correctAnswer !== "False" &&
            "border-destructive bg-destructive/10"
        )}
      >
        False
      </Button>
    </div>
  );
}
