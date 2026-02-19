import { getDueFlashcards, getAllFlashcards } from "@/app/actions/flashcards";
import { getDeck } from "@/app/actions/decks";
import { FlashcardStudy } from "@/components/flashcard-study";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { deckId: deckIdParam } = await params;
  const { mode } = await searchParams;
  const deckId = Number(deckIdParam);
  const studyAll = mode === "all";
  const [deck, cards] = await Promise.all([
    getDeck(deckId),
    studyAll ? getAllFlashcards(deckId) : getDueFlashcards(deckId),
  ]);

  if (!deck) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Deck not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Back to Decks</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>{studyAll ? "No cards in this deck" : "No cards due for review"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {studyAll
                ? `${deck.name} has no flashcards yet.`
                : `All cards in ${deck.name} are up to date. Come back later!`}
            </p>
            <div className="flex gap-3">
              {!studyAll && (
                <Link href={`/study/${deckId}?mode=all`}>
                  <Button variant="outline">Study All Cards</Button>
                </Link>
              )}
              <Link href={`/decks/${deckId}`}>
                <Button variant={studyAll ? "default" : "outline"}>Back to Deck</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <FlashcardStudy deckId={deckId} deckName={deck.name} cards={cards} />
    </div>
  );
}
