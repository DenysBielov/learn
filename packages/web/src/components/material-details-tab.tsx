"use client";

import Link from "next/link";
import { Layers, Brain, ExternalLink } from "lucide-react";

interface MaterialDetailsTabProps {
  linkedDecks: Array<{ id: number; name: string; flashcardCount: number }>;
  linkedQuizzes: Array<{ id: number; title: string }>;
  externalUrl: string | null;
}

export function MaterialDetailsTab({
  linkedDecks,
  linkedQuizzes,
  externalUrl,
}: MaterialDetailsTabProps) {
  const hasContent = linkedDecks.length > 0 || linkedQuizzes.length > 0 || externalUrl;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <p className="text-sm text-muted-foreground text-center">
          No linked resources for this material.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      {externalUrl && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            External Resource
          </h3>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{externalUrl}</span>
          </a>
        </div>
      )}

      {linkedDecks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Flashcard Decks
          </h3>
          <div className="space-y-2">
            {linkedDecks.map((deck) => (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="flex items-center justify-between rounded-[8px] border bg-card p-3 text-sm transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{deck.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {deck.flashcardCount} cards
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {linkedQuizzes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quizzes
          </h3>
          <div className="space-y-2">
            {linkedQuizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/quizzes/${quiz.id}`}
                className="flex items-center gap-2 rounded-[8px] border bg-card p-3 text-sm transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]"
              >
                <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{quiz.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
