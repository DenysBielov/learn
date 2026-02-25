"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateMaterialNotes } from "@/app/actions/materials";
import { Button } from "@/components/ui/button";
import { Check, Save } from "lucide-react";

interface MaterialNotesProps {
  materialId: number;
  initialNotes: string | null;
}

export function MaterialNotes({ materialId, initialNotes }: MaterialNotesProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [dirty, setDirty] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes ?? "");
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const save = useCallback(
    async (text: string) => {
      if (text === lastSavedRef.current) return;
      setSaveStatus("saving");
      lastSavedRef.current = text;
      await updateMaterialNotes(materialId, text);
      setDirty(false);
      setSaveStatus("saved");
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
      savedIndicatorRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    },
    [materialId]
  );

  const handleManualSave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    save(notes);
  }, [notes, save]);

  // Debounced auto-save
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(notes), 1500);
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

  // Save on tab close via sendBeacon (unmount doesn't reliably fire on tab close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const text = notesRef.current;
      if (text !== lastSavedRef.current) {
        navigator.sendBeacon(
          "/api/material-notes",
          JSON.stringify({ materialId, notes: text })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [materialId]);

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
        onChange={(e) => {
          setNotes(e.target.value);
          setDirty(true);
        }}
        placeholder="Jot down notes as you read..."
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs cursor-pointer"
          onClick={handleManualSave}
          disabled={!dirty || saveStatus === "saving"}
        >
          <Save className="mr-1 h-3 w-3" />
          Save
        </Button>
        <div className="flex items-center h-5">
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
    </div>
  );
}
