import { getDueFlashcards, getDueFlashcardsForActiveCourses } from "@/app/actions/flashcards";
import { getDecks } from "@/app/actions/decks";
import { getTagsForItems } from "@/app/actions/tags";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { ReviewPageClient } from "@/components/review-page-client";

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

  const tagMap = dueCards.length > 0
    ? await getTagsForItems(dueCards.map((c) => c.id), [])
    : {};

  const totalDue = dueCards.length;

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-7xl space-y-6">
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

      <ReviewPageClient dueCards={dueCards} decks={decks} tagMap={tagMap} />
    </div>
  );
}
