"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichContent } from "@/components/rich-content";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
}

interface FreeTextProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function FreeText({ question, onAnswer, disabled }: FreeTextProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (!answer.trim()) return;

    const normalizedAnswer = answer.trim().toLowerCase();
    let acceptedAnswers: string[] = [];

    if (question.correctAnswer) {
      try {
        const parsed = JSON.parse(question.correctAnswer) as {
          accepted: string[];
        };
        acceptedAnswers = parsed.accepted.map((a) => a.toLowerCase());
      } catch (error) {
        console.error("Error parsing correct answer:", error);
      }
    }

    const isCorrect = acceptedAnswers.includes(normalizedAnswer);
    onAnswer(isCorrect, answer.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !disabled) {
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Input
          type="text"
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full"
          autoFocus
        />
      </div>

      {!disabled && (
        <Button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="w-full"
        >
          Submit Answer
        </Button>
      )}

      {disabled && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="font-medium">Your answer:</span> <RichContent content={answer} className="inline" />
          </p>
        </div>
      )}
    </div>
  );
}
