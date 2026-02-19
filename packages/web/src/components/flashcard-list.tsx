"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteFlashcard } from "@/app/actions/flashcards";
import { RichContent } from "@/components/rich-content";
import { useState } from "react";

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

interface FlashcardListProps {
  flashcards: Flashcard[];
  deckId: number;
}

export function FlashcardList({ flashcards, deckId }: FlashcardListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this flashcard?")) return;

    setDeletingId(id);
    try {
      await deleteFlashcard(id, deckId);
    } catch (error) {
      console.error("Failed to delete flashcard:", error);
    } finally {
      setDeletingId(null);
    }
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No flashcards yet. Create your first flashcard to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flashcards.map((card) => (
        <Card key={card.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">FRONT</div>
                  <div className="text-sm"><RichContent content={card.front} /></div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">BACK</div>
                  <div className="text-sm"><RichContent content={card.back} /></div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(card.id)}
                disabled={deletingId === card.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
