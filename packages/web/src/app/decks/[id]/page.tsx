import { getDeck } from "@/app/actions/decks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashcardList } from "@/components/flashcard-list";
import { QuestionList } from "@/components/question-list";
import { CreateFlashcardDialog } from "@/components/create-flashcard-dialog";
import { CreateQuestionDialog } from "@/components/create-question-dialog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Brain, RotateCcw } from "lucide-react";
import { DeleteDeckButton } from "@/components/delete-deck-button";
import { SessionHistory } from "@/components/session-history";

interface DeckPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeckPage({ params }: DeckPageProps) {
  const { id } = await params;
  const deckId = parseInt(id, 10);

  if (isNaN(deckId)) {
    notFound();
  }

  const deck = await getDeck(deckId);

  if (!deck) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{deck.name}</h1>
          <DeleteDeckButton deckId={deckId} />
        </div>
        {deck.description && (
          <p className="text-muted-foreground mt-2">{deck.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/study/${deckId}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Study Due
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/study/${deckId}?mode=all`}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Study All
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/quiz/${deckId}`}>
            <Brain className="mr-2 h-4 w-4" />
            Take Quiz
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="flashcards" className="w-full">
        <TabsList>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="questions">Quiz Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="flashcards" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Flashcards ({deck.flashcards.length})
            </h2>
            <CreateFlashcardDialog deckId={deckId} />
          </div>
          <FlashcardList flashcards={deck.flashcards} deckId={deckId} />
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Quiz Questions ({deck.quizQuestions.length})
            </h2>
            <CreateQuestionDialog deckId={deckId} />
          </div>
          <QuestionList questions={deck.quizQuestions} deckId={deckId} />
        </TabsContent>
      </Tabs>

      <SessionHistory deckId={deckId} />
    </div>
  );
}
