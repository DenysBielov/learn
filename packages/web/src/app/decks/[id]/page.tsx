import { getDeck } from "@/app/actions/decks";
import { getTags } from "@/app/actions/tags";
import { DeckPageClient } from "@/components/deck-page-client";
import { notFound } from "next/navigation";
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

  const [deck, allTags] = await Promise.all([getDeck(deckId), getTags()]);

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

      <DeckPageClient deck={deck} allTags={allTags} />

      <SessionHistory deckId={deckId} />
    </div>
  );
}
