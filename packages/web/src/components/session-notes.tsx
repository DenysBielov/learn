"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateSessionNotes } from "@/app/actions/flashcards";
import { Check } from "lucide-react";

interface SessionNotesProps {
  sessionId: number;
  initialNotes?: string;
}

export function SessionNotes({ sessionId, initialNotes = "" }: SessionNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const save = useCallback(async (text: string) => {
    if (text === lastSavedRef.current) return;
    setSaveStatus("saving");
    lastSavedRef.current = text;
    await updateSessionNotes(sessionId, text);
    setSaveStatus("saved");
    if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
    savedIndicatorRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
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

  // Cleanup saved indicator on unmount
  useEffect(() => {
    return () => {
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col p-3 gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Jot down notes as you study..."
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-end h-5">
        {saveStatus === "saving" && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
