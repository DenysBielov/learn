"use client";

import { Clock, Layers, HelpCircle, FileText, Play } from "lucide-react";
import Link from "next/link";

type SessionCardProps = {
  session: {
    id: number;
    mode: string;
    startedAt: Date;
    completedAt: Date | null;
    summary: string | null;
    notes: string | null;
    courseName: string | null;
    deckName: string | null;
    cardsReviewed: number;
    questionsAnswered: number;
  };
};

export function SessionCard({ session }: SessionCardProps) {
  const duration = session.completedAt
    ? Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : null;
  const isActive = !session.completedAt;
  const noteWords = session.notes ? session.notes.split(/\s+/).filter(Boolean).length : 0;
  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <Link href={`/sessions/${session.id}`} className="block">
      <div className={`
        bg-card border rounded-[10px] p-4 transition-colors
        hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]
        ${isActive ? "border-blue-500/25 bg-blue-500/[0.04]" : ""}
      `}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold truncate">
            {session.summary || session.deckName || "Study Session"}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {duration !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground bg-muted/50 border rounded-full">
                <Clock className="h-3 w-3" />
                {duration}m
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
              isActive
                ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                : "text-green-400 bg-green-500/10 border-green-500/20"
            }`}>
              {isActive ? "Active" : "Completed"}
            </span>
          </div>
        </div>

        {/* Breadcrumb */}
        {session.courseName && (
          <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
            <span>{session.courseName}</span>
            {session.deckName && (
              <>
                <span className="text-muted-foreground/40">&rsaquo;</span>
                <span className="font-medium text-foreground/60">{session.deckName}</span>
              </>
            )}
          </div>
        )}

        {/* Date */}
        <div className="text-xs text-muted-foreground mb-3">{dateStr}</div>

        {/* Metrics pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {session.cardsReviewed > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-full bg-muted/30">
              <Layers className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-foreground/70">{session.cardsReviewed}</span>
              <span className="text-muted-foreground/60">cards</span>
            </span>
          )}
          {session.questionsAnswered > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-full bg-muted/30">
              <HelpCircle className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-foreground/70">{session.questionsAnswered}</span>
              <span className="text-muted-foreground/60">questions</span>
            </span>
          )}
          {noteWords > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-full bg-muted/30">
              <FileText className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-foreground/70">{noteWords}</span>
              <span className="text-muted-foreground/60">words</span>
            </span>
          )}
        </div>

        {/* Footer */}
        {isActive && (
          <div className="flex items-center text-xs">
            <span className="inline-flex items-center gap-1 text-foreground/60 hover:text-foreground/80">
              <Play className="h-3 w-3" /> Continue studying
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
