"use client";

import Link from "next/link";
import { Layers, Brain, Globe, Video, FileText, BookOpen, Link as LinkIcon } from "lucide-react";

type Resource = {
  id: number;
  url: string;
  title: string | null;
  type: string;
};

interface MaterialDetailsTabProps {
  linkedDecks: Array<{ id: number; name: string; flashcardCount: number }>;
  linkedQuizzes: Array<{ id: number; title: string }>;
  resources: Resource[];
  externalUrl: string | null;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "";
  }
}

const typeIcons: Record<string, typeof Globe> = {
  video: Video,
  article: FileText,
  documentation: BookOpen,
  obsidian: FileText,
};

function ResourceCard({ resource }: { resource: Resource }) {
  const Icon = typeIcons[resource.type] || Globe;
  const hostname = getHostname(resource.url);
  const title = resource.title || hostname;
  const favicon = getFaviconUrl(resource.url);

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-[8px] border bg-card p-3 text-sm transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]"
    >
      {favicon ? (
        <img
          src={favicon}
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 shrink-0 rounded-sm"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{hostname}</p>
      </div>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
    </a>
  );
}

export function MaterialDetailsTab({
  linkedDecks,
  linkedQuizzes,
  resources,
  externalUrl,
}: MaterialDetailsTabProps) {
  // Combine legacy single externalUrl with resources array
  const allResources = [...resources];
  if (externalUrl && !allResources.some(r => r.url === externalUrl)) {
    allResources.unshift({ id: -1, url: externalUrl, title: null, type: "other" });
  }

  const hasContent = linkedDecks.length > 0 || linkedQuizzes.length > 0 || allResources.length > 0;

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
      {allResources.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {allResources.length === 1 ? "External Resource" : "External Resources"}
          </h3>
          <div className="space-y-2">
            {allResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
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
