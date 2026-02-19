"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateSessionSummary } from "@/app/actions/session-summary";
import { updateSessionNotes } from "@/app/actions/flashcards";

interface CompletionNotesProps {
  sessionId: number;
}

export function CompletionNotes({ sessionId }: CompletionNotesProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef("");
  const hasFired = useRef(false);

  useEffect(() => {
    // Prevent double invocation in React strict mode
    if (hasFired.current) return;
    hasFired.current = true;

    const load = async () => {
      const result = await generateSessionSummary(sessionId);
      const text = result ?? "";
      setNotes(text);
      lastSavedRef.current = text;
      setLoading(false);
    };
    load();
  }, [sessionId]);

  const save = useCallback(async (text: string) => {
    if (text === lastSavedRef.current) return;
    lastSavedRef.current = text;
    await updateSessionNotes(sessionId, text);
  }, [sessionId]);

  useEffect(() => {
    if (loading) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(notes), 500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [notes, save, loading]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Generating session summary...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Session Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this session..."
        rows={6}
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <p className="text-xs text-muted-foreground">Notes auto-save as you type.</p>
    </div>
  );
}
