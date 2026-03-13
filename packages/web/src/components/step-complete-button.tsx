"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";
import { toggleStepComplete } from "@/app/actions/courses";

interface StepCompleteButtonProps {
  stepId: number;
  isCompleted: boolean;
  onChange?: (completed: boolean) => void;
  variant?: "default" | "icon";
}

export function StepCompleteButton({ stepId, isCompleted: initialCompleted, onChange, variant = "default" }: StepCompleteButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setIsCompleted(initialCompleted); }, [initialCompleted]);

  const handleToggle = () => {
    const newState = !isCompleted;
    setIsCompleted(newState);
    startTransition(async () => {
      try {
        await toggleStepComplete(stepId, newState);
        onChange?.(newState);
        window.dispatchEvent(new CustomEvent("step-complete-changed"));
      } catch {
        setIsCompleted(!newState);
      }
    });
  };

  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant={isCompleted ? "default" : "outline"}
        onClick={handleToggle}
        disabled={isPending}
        className={`min-w-[44px] min-h-[44px] ${isCompleted ? "bg-green-600 hover:bg-green-700" : ""}`}
        aria-label="Mark step as complete"
      >
        {isCompleted ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </Button>
    );
  }

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
