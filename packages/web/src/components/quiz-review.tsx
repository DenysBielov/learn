"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActivityResults, updateQuizAnswer } from "@/app/actions/quiz";
import { ConfidenceScale } from "@/components/confidence-scale";

type Row = Awaited<ReturnType<typeof getActivityResults>>[number];

function status(r: Row): "correct" | "wrong" | "skipped" {
  if (r.skipped) return "skipped";
  return r.correct ? "correct" : "wrong";
}

function sortKey(r: Row): number {
  // wrong first, then lucky-correct (correct + confidence <= 2), then the rest. Skipped are rendered in their own section.
  const s = status(r);
  if (s === "wrong") return 0;
  if (s === "correct" && (r.confidence ?? 0) > 0 && (r.confidence ?? 0) <= 2) return 1;
  return 2;
}

export function QuizReview({ activityId }: { activityId: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    getActivityResults(activityId).then(setRows);
  }, [activityId]);

  if (!rows) return <p className="text-muted-foreground">Loading review…</p>;

  const answered = rows.filter(r => status(r) !== "skipped").sort((a, b) => sortKey(a) - sortKey(b));
  const skipped = rows.filter(r => status(r) === "skipped");

  const renderCard = (r: Row) => {
    const s = status(r);
    return (
      <Card key={r.id}>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-base">{r.questionText}</CardTitle>
          <Badge variant={s === "correct" ? "default" : s === "wrong" ? "destructive" : "secondary"}>
            {s}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1 text-sm">
            {r.selectedOptionText && (
              <div><span className="text-muted-foreground">You picked:</span> {r.selectedOptionText}</div>
            )}
            {r.correctOptionText && !r.correct && (
              <div><span className="text-muted-foreground">Correct:</span> {r.correctOptionText}</div>
            )}
          </div>
          <ConfidenceScale
            value={(r.confidence as 1|2|3|4|5|null) ?? null}
            onChange={async v => {
              await updateQuizAnswer(r.id, { confidence: v });
              setRows(prev => prev?.map(x => x.id === r.id ? { ...x, confidence: v } : x) ?? null);
            }}
          />
          <InlineNote answerId={r.id} initial={r.note ?? ""} />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {answered.length > 0 && (
        <section className="space-y-4">
          {answered.map(renderCard)}
        </section>
      )}
      {skipped.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Skipped
            </h3>
            <span className="text-xs text-muted-foreground">
              {skipped.length} question{skipped.length === 1 ? "" : "s"} you chose to learn first
            </span>
          </div>
          <div className="space-y-4">
            {skipped.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}

function InlineNote({ answerId, initial }: { answerId: number; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  return (
    <div>
      <textarea
        className="w-full rounded-md border bg-background p-2 text-sm min-h-16"
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false); }}
        onBlur={async () => {
          await updateQuizAnswer(answerId, { note: value.length === 0 ? null : value });
          setSaved(true);
        }}
        placeholder="Add a note…"
      />
      <p className="text-xs text-muted-foreground mt-1" aria-live="polite">{saved ? "Saved." : "Unsaved"}</p>
    </div>
  );
}
