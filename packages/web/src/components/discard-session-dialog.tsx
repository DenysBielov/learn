"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { discardSession } from "@/app/actions/flashcards";

interface DiscardSessionDialogProps {
  sessionId: number;
  trigger: React.ReactNode;
  onDiscarded?: () => void;
}

export function DiscardSessionDialog({ sessionId, trigger, onDiscarded }: DiscardSessionDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDiscard() {
    setIsSubmitting(true);
    try {
      await discardSession(sessionId);
      onDiscarded?.();
      router.refresh();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard session?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the session as discarded. It will be hidden from your stats and session list. Your flashcard progress will be kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDiscard} disabled={isSubmitting}>
            {isSubmitting ? "Discarding..." : "Discard"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
