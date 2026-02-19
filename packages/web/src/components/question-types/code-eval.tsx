"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichContent } from "@/components/rich-content";
import { Loader2 } from "lucide-react";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
  explanation: string | null;
}

interface CodeEvalProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

interface AutoModeData {
  code: string;
  language: string;
  mode: "auto";
  accepted: string[];
}

interface AiModeData {
  code: string;
  language: string;
  mode: "ai";
  referenceAnswer: string;
}

type CodeEvalData = AutoModeData | AiModeData;

export function CodeEval({ question, onAnswer, disabled }: CodeEvalProps) {
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  let data: CodeEvalData | null = null;
  try {
    if (question.correctAnswer) {
      data = JSON.parse(question.correctAnswer) as CodeEvalData;
    }
  } catch (error) {
    console.error("Error parsing correctAnswer:", error);
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Invalid question data.</p>;
  }

  const codeBlock = `\`\`\`${data.language}\n${data.code}\n\`\`\``;

  const handleAutoSubmit = () => {
    if (!answer.trim() || data?.mode !== "auto") return;

    const normalizedAnswer = answer.trim().toLowerCase();
    const acceptedAnswers = data.accepted.map((a) => a.trim().toLowerCase());
    const isCorrect = acceptedAnswers.includes(normalizedAnswer);
    onAnswer(isCorrect, answer.trim());
  };

  const handleAiSubmit = async () => {
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
        const errData = await res.json();
        throw new Error(errData.error ?? "Evaluation failed");
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

  const handleSubmit = () => {
    if (data?.mode === "auto") {
      handleAutoSubmit();
    } else {
      handleAiSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !disabled) {
      handleAutoSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <RichContent content={codeBlock} />

      {data.mode === "auto" ? (
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
      ) : (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write your answer..."
          disabled={disabled || evaluating}
          rows={4}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          autoFocus
        />
      )}

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

      {disabled && data.mode === "auto" && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="font-medium">Your answer:</span> <RichContent content={answer} className="inline" />
          </p>
        </div>
      )}

      {feedback && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm font-medium mb-1">AI Feedback:</p>
          <p className="text-sm text-muted-foreground">{feedback}</p>
        </div>
      )}

      {disabled && data.mode === "ai" && !feedback && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="font-medium">Your answer:</span> {answer}
          </p>
        </div>
      )}
    </div>
  );
}
