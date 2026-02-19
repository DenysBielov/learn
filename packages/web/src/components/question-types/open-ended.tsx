"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
  explanation: string | null;
}

interface OpenEndedProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

export function OpenEnded({ question, onAnswer, disabled }: OpenEndedProps) {
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!answer.trim() || evaluating) return;

    setEvaluating(true);

    try {
      const res = await fetch("/api/chat/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          userAnswer: answer.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Evaluation failed");
      }

      const result = await res.json();
      setFeedback(result.feedback);
      onAnswer(result.correct, answer.trim());
    } catch (error) {
      console.error("Evaluation error:", error);
      setFeedback("Could not evaluate your answer. Please review manually.");
      onAnswer(false, answer.trim());
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer..."
        disabled={disabled || evaluating}
        rows={4}
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        autoFocus
      />

      {!disabled && !evaluating && (
        <Button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="w-full"
        >
          Submit Answer
        </Button>
      )}

      {evaluating && (
        <Button disabled className="w-full">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          AI is evaluating your answer...
        </Button>
      )}

      {feedback && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm font-medium mb-1">AI Feedback:</p>
          <p className="text-sm text-muted-foreground">{feedback}</p>
        </div>
      )}

      {disabled && !feedback && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="font-medium">Your answer:</span> {answer}
          </p>
        </div>
      )}
    </div>
  );
}
