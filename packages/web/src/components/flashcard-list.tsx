"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { deleteFlashcard } from "@/app/actions/flashcards";
import { RichContent } from "@/components/rich-content";
import { TagBadge } from "@/components/tag-badge";
import { TagPopover } from "@/components/tag-popover";
import { useState } from "react";
import type { Tag } from "@/lib/tags";

interface FlashcardTag {
  tag: Tag;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
  tags?: FlashcardTag[];
}

interface FlashcardListProps {
  flashcards: Flashcard[];
  deckId: number;
  allTags?: Tag[];
  selectable?: boolean;
  selectedIds?: Set<number>;
  onSelectionChange?: (id: number) => void;
}

export function FlashcardList({
  flashcards,
  deckId,
  allTags = [],
  selectable = false,
  selectedIds,
  onSelectionChange,
}: FlashcardListProps) {
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
      {flashcards.map((card) => {
        const cardTags = card.tags?.map((t) => t.tag) ?? [];
        const isSelected = selectedIds?.has(card.id) ?? false;

        return (
          <Card key={card.id} className={isSelected ? "ring-2 ring-primary" : undefined}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {selectable && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelectionChange?.(card.id)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 space-y-2 min-w-0">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">FRONT</div>
                    <div className="text-sm"><RichContent content={card.front} /></div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">BACK</div>
                    <div className="text-sm"><RichContent content={card.back} /></div>
                  </div>
                  {(cardTags.length > 0 || allTags.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {cardTags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                      <TagPopover
                        mode="single"
                        allTags={allTags}
                        assignedTagIds={cardTags.map((t) => t.id)}
                        itemId={card.id}
                        itemType="flashcard"
                        deckId={deckId}
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(card.id)}
                  disabled={deletingId === card.id}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
