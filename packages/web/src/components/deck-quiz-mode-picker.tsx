"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shuffle, Sparkles, RotateCcw } from "lucide-react";

interface DeckQuizModePickerProps {
  deckId: number;
}

const modes = [
  { value: "all", label: "All Questions", description: "All questions, randomly shuffled", icon: Shuffle },
  { value: "new", label: "New Only", description: "Questions you haven't answered yet", icon: Sparkles },
  { value: "revision", label: "Revision", description: "Questions you got wrong most often", icon: RotateCcw },
];

export function DeckQuizModePicker({ deckId }: DeckQuizModePickerProps) {
  const router = useRouter();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <Card
            key={mode.value}
            className="cursor-pointer"
            onClick={() => router.push(`/quiz/${deckId}?mode=${mode.value}`)}
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
