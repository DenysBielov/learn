"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteDeck } from "@/app/actions/decks";
import { Trash2 } from "lucide-react";

interface DeleteDeckButtonProps {
  deckId: number;
}

export function DeleteDeckButton({ deckId }: DeleteDeckButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this deck? All flashcards and quiz questions in it will also be deleted.")) return;

    setIsDeleting(true);
    try {
      await deleteDeck(deckId);
      router.push("/");
    } catch (error) {
      console.error("Failed to delete deck:", error);
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
