"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TagFilter } from "@/components/tag-filter";
import Link from "next/link";
import type { Tag } from "@/lib/tags";

interface DueCard {
  id: number;
  deckId: number;
  front: string;
  back: string;
}

interface Deck {
  id: number;
  name: string;
}

interface ReviewPageClientProps {
  dueCards: DueCard[];
  decks: Deck[];
  tagMap: Record<string, Tag[]>;
}

export function ReviewPageClient({ dueCards, decks, tagMap }: ReviewPageClientProps) {
  const [activeTagIds, setActiveTagIds] = useState<number[]>([]);

  // Compute tag counts across all due cards
  const filterTags = useMemo(() => {
    const tagCountMap = new Map<number, { tag: Tag; count: number }>();
    for (const card of dueCards) {
      const cardTags = tagMap[`f_${card.id}`] ?? [];
      for (const tag of cardTags) {
        const existing = tagCountMap.get(tag.id);
        if (existing) {
          existing.count++;
        } else {
          tagCountMap.set(tag.id, { tag, count: 1 });
        }
      }
    }
    return Array.from(tagCountMap.values()).map(({ tag, count }) => ({
      ...tag,
      count,
    }));
  }, [dueCards, tagMap]);

  // Filter cards by active tags (AND logic)
  const filteredCards = useMemo(() => {
    if (activeTagIds.length === 0) return dueCards;
    return dueCards.filter((card) => {
      const cardTagIds = new Set((tagMap[`f_${card.id}`] ?? []).map((t) => t.id));
      return activeTagIds.every((id) => cardTagIds.has(id));
    });
  }, [dueCards, activeTagIds, tagMap]);

  const handleToggleTag = useCallback((tagId: number) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleClearFilters = useCallback(() => setActiveTagIds([]), []);

  // Group filtered cards by deck
  const deckMap = new Map(decks.map((d) => [d.id, d]));
  const cardsByDeck = filteredCards.reduce((acc, card) => {
    if (!acc.has(card.deckId)) acc.set(card.deckId, []);
    acc.get(card.deckId)!.push(card);
    return acc;
  }, new Map<number, typeof filteredCards>());

  const tagParam = activeTagIds.length > 0 ? `?tags=${activeTagIds.join(",")}` : "";

  return (
    <>
      <TagFilter
        tags={filterTags}
        activeTagIds={activeTagIds}
        onToggle={handleToggleTag}
        onClear={handleClearFilters}
        totalCount={dueCards.length}
        filteredCount={filteredCards.length}
      />

      {filteredCards.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-semibold mb-2">
                {activeTagIds.length > 0 ? "No matching cards" : "All caught up!"}
              </h2>
              <p className="text-muted-foreground">
                {activeTagIds.length > 0
                  ? "No due cards match the selected tags. Try clearing the filter."
                  : "No cards are due for review right now. Great job!"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Decks with due cards</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(cardsByDeck.entries()).map(([deckId, cards]) => {
              const deck = deckMap.get(deckId);
              if (!deck) return null;

              return (
                <Card key={deckId}>
                  <CardHeader>
                    <CardTitle>{deck.name}</CardTitle>
                    <CardDescription>
                      {cards.length} {cards.length === 1 ? "card" : "cards"} due
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <Link href={`/study/${deckId}${tagParam}`}>Start Review</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
