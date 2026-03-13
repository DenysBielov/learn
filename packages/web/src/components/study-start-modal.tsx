"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useActiveSession } from "@/components/active-session-provider";
import { startActivity } from "@/app/actions/flashcards";

interface StudyStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyUrl: string;
  activityType: "flashcard_review" | "quiz_answer" | "reading";
  sourceId: { deckId?: number; quizId?: number; materialId?: number };
  courseId?: number;
  onStudyStart?: () => void;
}

export function StudyStartModal({
  open, onOpenChange, studyUrl, activityType, sourceId, courseId, onStudyStart,
}: StudyStartModalProps) {
  const router = useRouter();
  const { session, startSession, refresh } = useActiveSession();
  const [isStarting, setIsStarting] = useState(false);

  async function handleStartWithSession() {
    setIsStarting(true);
    try {
      const activeSession = session ?? await startSession(courseId);
      await startActivity(activeSession.id, activityType, sourceId);
      await refresh();
      if (onStudyStart) {
        onStudyStart();
      } else {
        router.push(studyUrl);
      }
    } finally {
      setIsStarting(false);
      onOpenChange(false);
    }
  }

  function handleStudyWithout() {
    if (onStudyStart) {
      onStudyStart();
    } else {
      router.push(studyUrl);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start studying</DialogTitle>
          <DialogDescription>
            Would you like to track this in a study session?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={handleStartWithSession} disabled={isStarting}>
            {isStarting ? "Starting..." : "Start session & study"}
          </Button>
          <Button variant="outline" onClick={handleStudyWithout}>
            Study without session
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Start activity in current session and navigate. Use instead of opening the modal when session is active. */
export async function startActivityAndNavigate(
  sessionId: number,
  activityType: "flashcard_review" | "quiz_answer" | "reading",
  sourceId: { deckId?: number; quizId?: number; materialId?: number },
  refresh: () => Promise<void>,
) {
  await startActivity(sessionId, activityType, sourceId);
  await refresh();
}
