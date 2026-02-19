"use client";

import { useTransition } from "react";
import { toggleCourseActive } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import { Star, StarOff } from "lucide-react";

interface ToggleActiveButtonProps {
  courseId: number;
  isActive: boolean;
  variant?: "card" | "header";
}

export function ToggleActiveButton({ courseId, isActive, variant = "card" }: ToggleActiveButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => toggleCourseActive(courseId, !isActive));
  }

  if (variant === "header") {
    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isActive ? <Star className="mr-2 h-4 w-4 fill-current" /> : <StarOff className="mr-2 h-4 w-4" />}
        {isActive ? "Active" : "Inactive"}
      </Button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="p-1 rounded-full hover:bg-muted transition-colors"
      title={isActive ? "Mark inactive" : "Mark active"}
    >
      {isActive ? (
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
      ) : (
        <StarOff className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
