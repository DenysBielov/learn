import { getDueFlashcards, getDueFlashcardsForActiveCourses } from "@/app/actions/flashcards";
import { getDecks } from "@/app/actions/decks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock } from "lucide-react";

interface ReviewPageProps {
  searchParams: Promise<{ active?: string }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const { active } = await searchParams;
  const showActiveOnly = active === "true";

  const [dueCards, decks] = await Promise.all([
    showActiveOnly ? getDueFlashcardsForActiveCourses() : getDueFlashcards(),
    getDecks(),
  ]);

  // Group due cards by deck
  const deckMap = new Map(decks.map(d => [d.id, d]));
  const cardsByDeck = dueCards.reduce((acc, card) => {
    if (!acc.has(card.deckId)) {
      acc.set(card.deckId, []);
    }
    acc.get(card.deckId)!.push(card);
    return acc;
  }, new Map<number, typeof dueCards>());

  const totalDue = dueCards.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Review Queue</h1>
        <p className="text-muted-foreground mt-2">
          Practice your flashcards with spaced repetition
        </p>
      </div>

      {/* Total due count */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total cards due</p>
              <p className="text-4xl font-bold mt-1">{totalDue}</p>
            </div>
            <Clock className="h-12 w-12 text-primary opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {totalDue === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-semibold mb-2">All caught up!</h2>
              <p className="text-muted-foreground">
                No cards are due for review right now. Great job!
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
                      <Link href={`/study/${deckId}`}>Start Review</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
