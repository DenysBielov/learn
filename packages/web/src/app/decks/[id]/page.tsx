import { getDeck } from "@/app/actions/decks";
import { getEntityFeedbackData } from "@/lib/feedback-data";
import { getTags } from "@/app/actions/tags";
import { DeckPageClient } from "@/components/deck-page-client";
import { EntityFeedback } from "@/components/entity-feedback";
import { PublicHeader } from "@/components/public-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDeckButton } from "@/components/delete-deck-button";
import { SessionHistory } from "@/components/session-history";
import { getOptionalUser } from "@/lib/auth";
import { getDb } from "@flashcards/database";

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

  const { isPublicView } = deck;
  const user = await getOptionalUser();
  const feedbackData = user ? getEntityFeedbackData(getDb(), user.userId, "deck", deckId) : undefined;
  const allTags = isPublicView ? [] : await getTags();

  return (
    <>
      {isPublicView && <PublicHeader />}
      <div className="container mx-auto px-4 py-4 sm:p-6 max-w-7xl space-y-6">
        {isPublicView && deck.courseContext && (
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/explore" className="hover:text-foreground">Explore</Link>
            <span>/</span>
            <Link href={`/courses/${deck.courseContext.coursePublicId}`} className="hover:text-foreground">
              {deck.courseContext.courseName}
            </Link>
            <span>/</span>
            <span className="text-foreground truncate">{deck.name}</span>
          </nav>
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{deck.name}</h1>
            {!isPublicView && (
              <EntityFeedback entityType="deck" entityId={deckId} initialData={feedbackData} />
            )}
            {!isPublicView && <DeleteDeckButton deckId={deckId} />}
          </div>
          {deck.description && (
            <p className="text-muted-foreground mt-2">{deck.description}</p>
          )}
        </div>

        <DeckPageClient deck={deck} allTags={allTags} isPublicView={isPublicView} />

        {!isPublicView && <SessionHistory deckId={deckId} />}
      </div>
    </>
  );
}
