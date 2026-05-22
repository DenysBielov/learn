"use client";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { updateQuizAnswer } from "@/app/actions/quiz";

interface Props {
  answerId: number | null;
  priorNote?: string | null;
}

export function AnswerNote({ answerId, priorNote }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setValue("");
    setSaved(false);
  }, [answerId]);

  const save = async () => {
    if (!answerId) return;
    await updateQuizAnswer(answerId, { note: value.length === 0 ? null : value });
    setSaved(true);
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
