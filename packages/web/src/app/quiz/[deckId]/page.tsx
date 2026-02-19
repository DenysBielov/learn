import { getQuizQuestions, getNewQuizQuestions, getRevisionQuizQuestions } from "@/app/actions/quiz";
import { getDeck } from "@/app/actions/decks";
import { QuizPlayer } from "@/components/quiz-player";
import { DeckQuizModePicker } from "@/components/deck-quiz-mode-picker";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuizPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ mode?: string }>;
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
  const { mode } = await searchParams;
  const deckId = Number(deckIdParam);

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
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quiz: {deck.name}</h1>
        <p className="text-muted-foreground">Choose a quiz mode:</p>
        <DeckQuizModePicker deckId={deckId} />
      </div>
    );
  }

  let questions;
  if (mode === "new") {
    questions = await getNewQuizQuestions(deckId);
  } else if (mode === "revision") {
    questions = await getRevisionQuizQuestions(deckId);
  } else {
    questions = await getQuizQuestions(deckId);
  }

  if (questions.length === 0) {
    const emptyMessage = mode === "new"
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
          <CardContent>
            <p className="text-muted-foreground mb-4">{emptyMessage}</p>
            <div className="flex gap-3">
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
    <div className="py-8">
      <QuizPlayer
        deckId={deckId}
        deckName={deck.name}
        questions={finalQuestions}
      />
    </div>
  );
}
