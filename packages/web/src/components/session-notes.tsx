"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateSessionNotes } from "@/app/actions/flashcards";

interface SessionNotesProps {
  sessionId: number;
  initialNotes?: string;
}

export function SessionNotes({ sessionId, initialNotes = "" }: SessionNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const save = useCallback(async (text: string) => {
    if (text === lastSavedRef.current) return;
    lastSavedRef.current = text;
    await updateSessionNotes(sessionId, text);
  }, [sessionId]);

  // Debounced auto-save
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(notes), 500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [notes, save]);

  // Save on unmount — use notesRef to get the latest value, not the stale closure
  useEffect(() => {
    return () => {
      save(notesRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col p-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Jot down notes as you study..."
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}
