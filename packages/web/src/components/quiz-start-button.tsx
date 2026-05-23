"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startActivityAndNavigate } from "@/components/study-start-modal";
import { useActiveSession } from "@/components/active-session-provider";
import { Brain, BookOpen } from "lucide-react";

interface QuizStartButtonProps {
  quizId: number;
  questionCount: number;
  courseId?: number;
}

export function QuizStartButton({ quizId, questionCount, courseId }: QuizStartButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const { session, startSession, currentActivity, refresh } = useActiveSession();
  const router = useRouter();

  const isQuizInProgress = !!(currentActivity && currentActivity.type === "quiz_answer" && currentActivity.quizId === quizId);

  // If quiz is already in progress in the current session, redirect to play
  useEffect(() => {
    if (isQuizInProgress) {
      router.replace(`/quizzes/${quizId}/play`);
    }
  }, [isQuizInProgress, quizId, router]);

  if (questionCount === 0) {
    return (
      <Button size="lg" className="w-full" disabled>
        <Brain className="mr-2 h-5 w-5" />
        No questions yet
      </Button>
    );
  }

  async function handleStartWithSession() {
    setIsStarting(true);
    try {
      const activeSession = session ?? await startSession(courseId);
      await startActivityAndNavigate(activeSession.id, "quiz_answer", { quizId }, refresh);
      // Navigation is handled by the isQuizInProgress effect once refresh()
      // updates currentActivity. Calling router.push here too caused two
      // concurrent RSC fetches for /play which Next 16 sometimes hangs on.
    } finally {
      setIsStarting(false);
    }
  }

  function handleStartWithout() {
    router.push(`/quizzes/${quizId}/play`);
  }

  if (session) {
    return (
      <Button size="lg" className="w-full" onClick={handleStartWithSession} disabled={isStarting || isQuizInProgress}>
        <Brain className="mr-2 h-5 w-5" />
        {isStarting || isQuizInProgress ? "Starting..." : "Take Quiz"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={handleStartWithSession} disabled={isStarting}>
        <BookOpen className="mr-2 h-5 w-5" />
        {isStarting ? "Starting..." : "Start Study Session & Take Quiz"}
      </Button>
      <Button size="lg" variant="outline" className="w-full" onClick={handleStartWithout}>
        <Brain className="mr-2 h-5 w-5" />
        Take Quiz Without Session
      </Button>
    </div>
  );
}
