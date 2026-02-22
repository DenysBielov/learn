"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, Brain, Check, Circle } from "lucide-react";
import { toggleStepComplete } from "@/app/actions/courses";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  position: number;
  stepType: string;
  materialId: number | null;
  quizId: number | null;
  materialTitle: string | null;
  quizTitle: string | null;
}

interface LearningJourneyProps {
  courseId: number;
  steps: Step[];
  completedStepIds: Set<number>;
}

function getStepUrl(step: Step) {
  if (step.stepType === "material" && step.materialId) return `/materials/${step.materialId}`;
  if (step.stepType === "quiz" && step.quizId) return `/quizzes/${step.quizId}`;
  return "#";
}

function StepCheckbox({ stepId, initialCompleted }: { stepId: number; initialCompleted: boolean }) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !isCompleted;
    setIsCompleted(newState);
    startTransition(async () => {
      try {
        await toggleStepComplete(stepId, newState);
      } catch {
        setIsCompleted(!newState);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
        isCompleted
          ? "border-green-500 bg-green-500 text-white"
          : "border-muted-foreground/30 hover:border-muted-foreground/60"
      )}
    >
      {isCompleted && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

export function LearningJourney({ courseId, steps, completedStepIds }: LearningJourneyProps) {
  const firstIncomplete = steps.find(s => !completedStepIds.has(s.id));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Learning Journey</h2>
        {firstIncomplete && (
          <Link
            href={getStepUrl(firstIncomplete)}
            className="text-sm text-primary hover:underline"
          >
            Continue where you left off
          </Link>
        )}
      </div>

      <div className="space-y-1">
        {steps.map((step, index) => {
          const title = step.stepType === "material" ? step.materialTitle : step.quizTitle;
          const isCompleted = completedStepIds.has(step.id);

          return (
            <Link
              key={step.id}
              href={getStepUrl(step)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
                isCompleted && "bg-muted/30"
              )}
            >
              <StepCheckbox stepId={step.id} initialCompleted={isCompleted} />

              <span className="text-sm font-medium text-muted-foreground w-6 text-center shrink-0">
                {index + 1}
              </span>

              {step.stepType === "material" ? (
                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              <span className={cn(
                "text-sm font-medium truncate",
                isCompleted && "text-muted-foreground line-through"
              )}>
                {title || "Untitled"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
