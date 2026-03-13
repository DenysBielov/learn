"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StudyStartModal, startActivityAndNavigate } from "@/components/study-start-modal";
import { useActiveSession } from "@/components/active-session-provider";
import { Brain } from "lucide-react";

interface QuizStartButtonProps {
  quizId: number;
  questionCount: number;
  courseId?: number;
}

export function QuizStartButton({ quizId, questionCount, courseId }: QuizStartButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { session, currentActivity, refresh } = useActiveSession();
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

  async function handleClick() {
    if (session) {
      setIsStarting(true);
      try {
        await startActivityAndNavigate(session.id, "quiz_answer", { quizId }, refresh);
        router.push(`/quizzes/${quizId}/play`);
      } finally {
        setIsStarting(false);
      }
    } else {
      setModalOpen(true);
    }
  }

  return (
    <>
      <Button size="lg" className="w-full" onClick={handleClick} disabled={isStarting || isQuizInProgress}>
        <Brain className="mr-2 h-5 w-5" />
        {isStarting || isQuizInProgress ? "Starting..." : "Start Quiz"}
      </Button>
      <StudyStartModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        studyUrl={`/quizzes/${quizId}/play`}
        activityType="quiz_answer"
        sourceId={{ quizId }}
        courseId={courseId}
      />
    </>
  );
}
