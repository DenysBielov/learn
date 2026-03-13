"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StudyStartModal, startActivityAndNavigate } from "@/components/study-start-modal";
import { useActiveSession } from "@/components/active-session-provider";

interface DeckStudyButtonProps {
  deckId: number;
  studyUrl: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  courseId?: number;
}

export function DeckStudyButton({
  deckId,
  studyUrl,
  label,
  icon,
  variant = "default",
  size = "default",
  courseId,
}: DeckStudyButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { session, refresh } = useActiveSession();
  const router = useRouter();

  async function handleClick() {
    if (session) {
      setIsStarting(true);
      try {
        await startActivityAndNavigate(session.id, "flashcard_review", { deckId }, refresh);
        router.push(studyUrl);
      } finally {
        setIsStarting(false);
      }
    } else {
      setModalOpen(true);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={handleClick} disabled={isStarting}>
        {icon}
        {isStarting ? "Starting..." : label}
      </Button>
      <StudyStartModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        studyUrl={studyUrl}
        activityType="flashcard_review"
        sourceId={{ deckId }}
        courseId={courseId}
      />
    </>
  );
}
