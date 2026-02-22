"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";
import { toggleStepComplete } from "@/app/actions/courses";

interface StepCompleteButtonProps {
  stepId: number;
  isCompleted: boolean;
}

export function StepCompleteButton({ stepId, isCompleted: initialCompleted }: StepCompleteButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const newState = !isCompleted;
    setIsCompleted(newState);
    startTransition(async () => {
      try {
        await toggleStepComplete(stepId, newState);
      } catch {
        setIsCompleted(!newState); // Revert on error
      }
    });
  };

  return (
    <Button
      variant={isCompleted ? "default" : "outline"}
      onClick={handleToggle}
      disabled={isPending}
      className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}
    >
      {isCompleted ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Completed
        </>
      ) : (
        <>
          <Circle className="mr-2 h-4 w-4" />
          Mark as Complete
        </>
      )}
    </Button>
  );
}
