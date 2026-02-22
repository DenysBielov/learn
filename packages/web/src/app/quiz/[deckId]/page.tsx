import { getQuizQuestions, getNewQuizQuestions, getRevisionQuizQuestions } from "@/app/actions/quiz";
import { getDeck } from "@/app/actions/decks";
import { getTags } from "@/app/actions/tags";
import { QuizPlayer } from "@/components/quiz-player";
import { DeckQuizModePicker } from "@/components/deck-quiz-mode-picker";
import { TagBadge } from "@/components/tag-badge";
import { parseTagIdsFromUrl } from "@/lib/tags";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuizPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ mode?: string; tags?: string }>;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default async function QuizPage({ params, searchParams }: QuizPageProps) {
  const { deckId: deckIdParam } = await params;
  const { mode, tags: tagsParam } = await searchParams;
  const deckId = Number(deckIdParam);
  const tagIds = parseTagIdsFromUrl(tagsParam);

  const deck = await getDeck(deckId);

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

  if (!mode || !["all", "new", "revision"].includes(mode)) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6 max-w-7xl space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quiz: {deck.name}</h1>
        <p className="text-muted-foreground">Choose a quiz mode:</p>
        <DeckQuizModePicker deckId={deckId} />
      </div>
    );
  }

  const tagIdsOrUndefined = tagIds.length > 0 ? tagIds : undefined;
  let questions;
  if (mode === "new") {
    questions = await getNewQuizQuestions(deckId, tagIdsOrUndefined);
  } else if (mode === "revision") {
    questions = await getRevisionQuizQuestions(deckId, tagIdsOrUndefined);
  } else {
    questions = await getQuizQuestions(deckId, tagIdsOrUndefined);
  }

  // Fetch active tag names for display
  let activeFilterTags: { id: number; name: string; color: string | null }[] = [];
  if (tagIds.length > 0) {
    const allTags = await getTags();
    const tagIdSet = new Set(tagIds);
    activeFilterTags = allTags.filter((t) => tagIdSet.has(t.id));
  }

  const hasFilter = tagIds.length > 0;

  if (questions.length === 0) {
    const emptyMessage = hasFilter
      ? "No questions match the selected tags."
      : mode === "new"
        ? "All questions in this deck have been answered at least once."
        : mode === "revision"
          ? "No questions need revision yet. Answer some questions first."
          : "This deck doesn't have any quiz questions yet.";

    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>No questions available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{emptyMessage}</p>
            {hasFilter && activeFilterTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {activeFilterTags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
            <div className="flex gap-3">
              {hasFilter && (
                <Link href={`/quiz/${deckId}?mode=${mode}`}>
                  <Button variant="outline">Clear Filters</Button>
                </Link>
              )}
              <Link href={`/quiz/${deckId}`}>
                <Button variant="outline">Choose Another Mode</Button>
              </Link>
              <Link href={`/decks/${deckId}`}>
                <Button>Back to Deck</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Shuffle all and new modes; revision keeps its error-rate ordering
  const finalQuestions = mode === "revision" ? questions : shuffle(questions);

  return (
    <QuizPlayer
      deckId={deckId}
      deckName={deck.name}
      questions={finalQuestions}
      activeFilterTags={activeFilterTags}
    />
  );
}
