"use client";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { updateQuizAnswer } from "@/app/actions/quiz";

interface Props {
  answerId: number | null;
  priorNote?: string | null;
  initialNote?: string | null;
  onSaved?: (note: string | null) => void;
}

export function AnswerNote({ answerId, priorNote, initialNote, onSaved }: Props) {
  const [expanded, setExpanded] = useState(Boolean(initialNote));
  const [value, setValue] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(Boolean(initialNote));

  useEffect(() => {
    const hasInitial = Boolean(initialNote);
    setExpanded(hasInitial);
    setValue(initialNote ?? "");
    setSaved(hasInitial);
  }, [answerId, initialNote]);

  const save = async () => {
    if (!answerId) return;
    const next = value.length === 0 ? null : value;
    await updateQuizAnswer(answerId, { note: next });
    setSaved(true);
    onSaved?.(next);
  };

  if (answerId === null) return null;

  return (
    <div className="mt-3 space-y-2">
      {priorNote && (
        <p className="text-xs text-muted-foreground italic">From your last attempt: {priorNote}</p>
      )}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline cursor-pointer"
        >
          Add a note for next time…
        </button>
      ) : (
        <div>
          <Textarea
            autoFocus
            value={value}
            onChange={e => { setValue(e.target.value); setSaved(false); }}
            onBlur={save}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder="What were you thinking? Where did it click — or break?"
            className="min-h-20"
          />
          <p className="text-xs text-muted-foreground mt-1" aria-live="polite">
            {saved ? "Saved." : "Saves on blur or ⌘/Ctrl+Enter."}
          </p>
        </div>
      )}
    </div>
  );
}
