import { getDueFlashcards, getAllFlashcards } from "@/app/actions/flashcards";
import { getDeck } from "@/app/actions/decks";
import { getTags } from "@/app/actions/tags";
import { FlashcardStudy } from "@/components/flashcard-study";
import { TagBadge } from "@/components/tag-badge";
import { parseTagIdsFromUrl } from "@/lib/tags";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ mode?: string; tags?: string }>;
}) {
  const { deckId: deckIdParam } = await params;
  const { mode, tags: tagsParam } = await searchParams;
  const deckId = Number(deckIdParam);
  const studyAll = mode === "all";
  const tagIds = parseTagIdsFromUrl(tagsParam);

  const [deck, cards] = await Promise.all([
    getDeck(deckId),
    studyAll
      ? getAllFlashcards(deckId, tagIds.length > 0 ? tagIds : undefined)
      : getDueFlashcards(deckId, tagIds.length > 0 ? tagIds : undefined),
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

  // Fetch active tag names for display
  let activeFilterTags: { id: number; name: string; color: string | null }[] = [];
  if (tagIds.length > 0) {
    const allTags = await getTags();
    const tagIdSet = new Set(tagIds);
    activeFilterTags = allTags.filter((t) => tagIdSet.has(t.id));
  }

  // Get total count without filter for comparison
  const hasFilter = tagIds.length > 0;

  if (cards.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              {hasFilter
                ? "No matching cards"
                : studyAll
                  ? "No cards in this deck"
                  : "No cards due for review"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {hasFilter
                ? "No cards match the selected tags."
                : studyAll
                  ? `${deck.name} has no flashcards yet.`
                  : `All cards in ${deck.name} are up to date. Come back later!`}
            </p>
            {hasFilter && activeFilterTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {activeFilterTags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
            <div className="flex gap-3">
              {hasFilter && (
                <Link href={`/study/${deckId}${studyAll ? "?mode=all" : ""}`}>
                  <Button variant="outline">Clear Filters</Button>
                </Link>
              )}
              {!studyAll && !hasFilter && (
                <Link href={`/study/${deckId}?mode=all`}>
                  <Button variant="outline">Study All Cards</Button>
                </Link>
              )}
              <Link href={`/decks/${deckId}`}>
                <Button variant={studyAll && !hasFilter ? "default" : "outline"}>Back to Deck</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FlashcardStudy
      deckId={deckId}
      deckName={deck.name}
      cards={cards}
      activeFilterTags={activeFilterTags}
    />
  );
}
