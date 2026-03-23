"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getNextStudyStep, resetCourseProgress } from "@/app/actions/courses";
import { useActiveSession } from "@/components/active-session-provider";
import { startActivity } from "@/app/actions/flashcards";
import { Play, RotateCcw, BookOpen } from "lucide-react";

interface CourseStudyButtonProps {
  courseId: number;
  publicId?: string;
  variant?: "default" | "sm";
}

export function CourseStudyButton({ courseId, publicId, variant = "default" }: CourseStudyButtonProps) {
  const courseUrl = publicId ? `/courses/${publicId}` : `/courses/${courseId}`;
  const router = useRouter();
  const { session, startSession, refresh } = useActiveSession();
  const [isLoading, setIsLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedState, setCompletedState] = useState<{ hasDecks: boolean }>({ hasDecks: false });

  async function startSessionAndNavigate(result: { stepType: string; materialId?: number | null; quizId?: number | null }) {
    const activeSession = session ?? await startSession(courseId);
    if (result.stepType === "material" && result.materialId) {
      await startActivity(activeSession.id, "reading", { materialId: result.materialId });
      await refresh();
      router.push(`/materials/${result.materialId}?studying=true`);
    } else if (result.stepType === "quiz" && result.quizId) {
      await startActivity(activeSession.id, "quiz_answer", { quizId: result.quizId });
      await refresh();
      router.push(`/quizzes/${result.quizId}/play`);
    }
  }

  async function handleStudy() {
    setIsLoading(true);
    try {
      const result = await getNextStudyStep(courseId);

      if (result.status === "continue") {
        await startSessionAndNavigate(result);
        return;
      }

      // All completed (or no steps)
      if (!result.hasSteps) {
        // No steps at all — go to flashcard study if there are decks
        if (result.hasDecks) {
          router.push(`${courseUrl}/study`);
        }
        return;
      }

      setCompletedState({ hasDecks: result.hasDecks });
      setShowCompleted(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartOver() {
    setIsLoading(true);
    try {
      await resetCourseProgress(courseId);
      setShowCompleted(false);
      const result = await getNextStudyStep(courseId);
      if (result.status === "continue") {
        await startSessionAndNavigate(result);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleReviewCards() {
    setShowCompleted(false);
    router.push(`${courseUrl}/study`);
  }

  const isSmall = variant === "sm";

  return (
    <>
      <Button
        onClick={handleStudy}
        disabled={isLoading}
        size={isSmall ? "sm" : "default"}
      >
        <Play className={`h-4 w-4 ${isSmall ? "mr-1" : "mr-2"}`} />
        {isLoading ? "Loading..." : "Study"}
      </Button>

      <Dialog open={showCompleted} onOpenChange={setShowCompleted}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Course completed!</DialogTitle>
            <DialogDescription>
              You&apos;ve finished all steps in this course. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleStartOver} disabled={isLoading} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              {isLoading ? "Resetting..." : "Start Over"}
            </Button>
            {completedState.hasDecks && (
              <Button onClick={handleReviewCards}>
                <BookOpen className="mr-2 h-4 w-4" />
                Review Flashcards
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
