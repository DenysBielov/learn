"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, HelpCircle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveSession } from "@/components/active-session-provider";
import { DiscardSessionDialog } from "@/components/discard-session-dialog";
import { getSessionQuickStats } from "@/app/actions/flashcards";

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SessionWidget() {
  const { session, currentActivity, endSession, refresh } = useActiveSession();
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({ cardsReviewed: 0, questionsAnswered: 0 });
  const [isEnding, setIsEnding] = useState(false);

  // Timer
  useEffect(() => {
    if (!session) return;
    const startTime = new Date(session.startedAt).getTime();
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!session) return;
    try {
      const s = await getSessionQuickStats(session.id);
      setStats(s);
    } catch {
      // ignore
    }
  }, [session]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, currentActivity]);

  useEffect(() => {
    if (expanded) fetchStats();
  }, [expanded, fetchStats]);

  async function handleEnd() {
    setIsEnding(true);
    try {
      await endSession();
    } finally {
      setIsEnding(false);
    }
  }

  if (!session) return null;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed right-4 bottom-20 md:bottom-6 z-50 flex items-center gap-3 bg-card border rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-shadow"
      >
        <span className="flex items-center gap-1 text-sm font-medium">
          <Timer className="h-4 w-4 text-muted-foreground" />
          {formatElapsed(elapsed)}
        </span>
        {stats.cardsReviewed > 0 && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            {stats.cardsReviewed}
          </span>
        )}
        {stats.questionsAnswered > 0 && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            {stats.questionsAnswered}
          </span>
        )}
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-20 md:bottom-6 z-50 w-72 bg-card border rounded-xl shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium truncate">
          {session.title || "Study Session"}
        </h3>
        <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-2xl font-mono font-semibold">
          <Timer className="h-5 w-5 text-muted-foreground" />
          {formatElapsed(elapsed)}
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {stats.cardsReviewed} cards
          </span>
          <span className="flex items-center gap-1">
            <HelpCircle className="h-4 w-4" />
            {stats.questionsAnswered} questions
          </span>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleEnd} disabled={isEnding} className="flex-1">
            {isEnding ? "Ending..." : "End Session"}
          </Button>
          <DiscardSessionDialog
            sessionId={session.id}
            onDiscarded={() => {
              refresh();
            }}
            trigger={
              <Button size="sm" variant="outline" className="text-destructive">
                Discard
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
