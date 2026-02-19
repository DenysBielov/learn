"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichContent } from "@/components/rich-content";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
}

interface MatchPair {
  left: string;
  right: string;
}

interface MatchingProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function Matching({ question, onAnswer, disabled }: MatchingProps) {
  const correctPairs = useMemo<MatchPair[]>(() => {
    if (!question.correctAnswer) return [];
    try {
      return JSON.parse(question.correctAnswer) as MatchPair[];
    } catch (error) {
      console.error("Error parsing matching pairs:", error);
      return [];
    }
  }, [question.correctAnswer]);

  const leftItems = useMemo(
    () => correctPairs.map((p) => p.left),
    [correctPairs]
  );
  const rightItems = useMemo(
    () => [...correctPairs.map((p) => p.right)].sort(() => Math.random() - 0.5),
    [correctPairs]
  );

  const [matches, setMatches] = useState<Record<string, string>>({});

  const handleMatch = (left: string, right: string) => {
    if (disabled) return;
    setMatches({ ...matches, [left]: right });
  };

  const handleSubmit = () => {
    let correct = true;
    const userPairs: MatchPair[] = [];

    for (const pair of correctPairs) {
      const userRight = matches[pair.left];
      userPairs.push({ left: pair.left, right: userRight || "" });
      if (userRight !== pair.right) {
        correct = false;
      }
    }

    onAnswer(correct, JSON.stringify(userPairs));
  };

  const allMatched = leftItems.every((left) => matches[left]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {leftItems.map((left, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border p-3"
          >
            <div className="flex-1 font-medium"><RichContent content={left} /></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm hidden sm:inline">matches</span>
              <Select
                value={matches[left] || ""}
                onValueChange={(value) => handleMatch(left, value)}
                disabled={disabled}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select match..." />
                </SelectTrigger>
                <SelectContent>
                  {rightItems.map((right, idx) => (
                    <SelectItem key={idx} value={right}>
                      <RichContent content={right} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {!disabled && (
        <Button onClick={handleSubmit} disabled={!allMatched} className="w-full">
          Submit Answer
        </Button>
      )}

      {disabled && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Correct matches:
          </p>
          {correctPairs.map((pair, index) => (
            <div
              key={index}
              className="rounded-lg border bg-green-500/10 p-2 text-sm"
            >
              <span className="font-medium"><RichContent content={pair.left} className="inline" /></span> → <RichContent content={pair.right} className="inline" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
