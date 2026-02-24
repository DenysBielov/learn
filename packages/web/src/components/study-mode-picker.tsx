"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Shuffle, ArrowDown, ListOrdered } from "lucide-react";

interface StudyModePickerProps {
  courseId: number;
  type: "flashcard" | "quiz";
}

const flashcardModes = [
  { value: "review_due", label: "Review Due", description: "Cards due for review, shuffled", icon: Clock },
  { value: "sequential", label: "Sequential", description: "Work through decks in order", icon: ListOrdered },
  { value: "random", label: "Random", description: "All cards, randomly shuffled", icon: Shuffle },
  { value: "weakest_first", label: "Weakest First", description: "Cards you get wrong most often", icon: ArrowDown },
];

const quizModes = [
  { value: "sequential", label: "Sequential", description: "Work through decks in order", icon: ListOrdered },
  { value: "random", label: "Random", description: "All questions, randomly shuffled", icon: Shuffle },
  { value: "weakest_first", label: "Weakest First", description: "Questions you get wrong most often", icon: ArrowDown },
];

export function StudyModePicker({ courseId, type }: StudyModePickerProps) {
  const router = useRouter();
  const modes = type === "flashcard" ? flashcardModes : quizModes;
  const basePath = type === "flashcard"
    ? `/courses/${courseId}/study`
    : `/courses/${courseId}/quiz`;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <Card
            key={mode.value}
            className="cursor-pointer"
            onClick={() => router.push(`${basePath}?mode=${mode.value}`)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{mode.label}</CardTitle>
                  <CardDescription>{mode.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
