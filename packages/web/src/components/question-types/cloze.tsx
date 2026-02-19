"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
}

interface ClozeProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

interface ClozeBlank {
  index: number;
  group: number;
  answer: string;
  hint?: string;
  fullMatch: string;
}

interface TextSegment {
  type: "text" | "blank" | "revealed";
  content: string;
  blankIndex?: number;
  hint?: string;
  answer?: string;
}

function parseClozeText(text: string): ClozeBlank[] {
  const blanks: ClozeBlank[] = [];
  const regex = /\{\{c(\d+)::([^}]*?)\}\}/g;
  let match: RegExpMatchArray | null;
  let index = 0;

  for (match of text.matchAll(regex)) {
    const group = parseInt(match[1], 10);
    const inner = match[2];
    const parts = inner.split("::");
    const answer = parts[0];
    const hint = parts.length > 1 ? parts[1] : undefined;

    blanks.push({
      index,
      group,
      answer,
      hint,
      fullMatch: match[0],
    });
    index++;
  }

  return blanks;
}

function getGroups(blanks: ClozeBlank[]): number[] {
  const groupSet = new Set(blanks.map((b) => b.group));
  return Array.from(groupSet).sort((a, b) => a - b);
}

function buildSegments(
  text: string,
  blanks: ClozeBlank[],
  activeGroup: number,
  checkedGroups: Set<number>
): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\{\{c(\d+)::([^}]*?)\}\}/g;
  let lastIndex = 0;
  let blankIdx = 0;

  for (const match of text.matchAll(regex)) {
    const matchStart = match.index;

    // Add preceding text
    if (matchStart > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, matchStart),
      });
    }

    const blank = blanks[blankIdx];

    if (blank.group === activeGroup) {
      segments.push({
        type: "blank",
        content: "",
        blankIndex: blank.index,
        hint: blank.hint,
        answer: blank.answer,
      });
    } else if (checkedGroups.has(blank.group)) {
      // Already answered group — reveal the answer
      segments.push({
        type: "revealed",
        content: blank.answer,
      });
    } else {
      // Future group — show as plain text (the answer)
      segments.push({
        type: "revealed",
        content: blank.answer,
      });
    }

    lastIndex = matchStart + match[0].length;
    blankIdx++;
  }

  // Add trailing text
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

export function Cloze({ question, onAnswer, disabled }: ClozeProps) {
  const clozeData = useMemo(() => {
    if (!question.correctAnswer) return null;
    try {
      return JSON.parse(question.correctAnswer) as { text: string };
    } catch {
      return null;
    }
  }, [question.correctAnswer]);

  const clozeText = clozeData?.text ?? "";

  const blanks = useMemo(() => parseClozeText(clozeText), [clozeText]);
  const groups = useMemo(() => getGroups(blanks), [blanks]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [checkedGroups, setCheckedGroups] = useState<Set<number>>(new Set());
  const [blankResults, setBlankResults] = useState<
    Record<number, boolean>
  >({});
  const [allGroupsDone, setAllGroupsDone] = useState(false);
  const [groupChecked, setGroupChecked] = useState(false);

  const activeGroup = groups[currentGroupIdx] ?? 1;
  const activeBlanks = blanks.filter((b) => b.group === activeGroup);

  const segments = useMemo(
    () => buildSegments(clozeText, blanks, activeGroup, checkedGroups),
    [clozeText, blanks, activeGroup, checkedGroups]
  );

  const handleInputChange = useCallback(
    (blankIndex: number, value: string) => {
      setUserInputs((prev) => ({ ...prev, [blankIndex]: value }));
    },
    []
  );

  const handleCheckGroup = () => {
    const newResults: Record<number, boolean> = { ...blankResults };

    for (const blank of activeBlanks) {
      const userVal = (userInputs[blank.index] ?? "").trim().toLowerCase();
      const correctVal = blank.answer.trim().toLowerCase();
      newResults[blank.index] = userVal === correctVal;
    }

    setBlankResults(newResults);
    setGroupChecked(true);
    setCheckedGroups((prev) => new Set([...prev, activeGroup]));
  };

  const handleNextGroup = () => {
    const nextIdx = currentGroupIdx + 1;

    if (nextIdx >= groups.length) {
      // All groups done
      setAllGroupsDone(true);
      const allCorrect = blanks.every((b) => blankResults[b.index] === true);
      const userAnswer = blanks
        .map(
          (b) =>
            `c${b.group}: ${(userInputs[b.index] ?? "").trim() || "(empty)"}`
        )
        .join(", ");
      onAnswer(allCorrect, userAnswer);
    } else {
      setCurrentGroupIdx(nextIdx);
      setGroupChecked(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !disabled && !groupChecked) {
      const allFilled = activeBlanks.every(
        (b) => (userInputs[b.index] ?? "").trim() !== ""
      );
      if (allFilled) {
        handleCheckGroup();
      }
    }
  };

  const allActiveFilled = activeBlanks.every(
    (b) => (userInputs[b.index] ?? "").trim() !== ""
  );

  if (!clozeData) {
    return (
      <div className="text-muted-foreground text-sm">
        Invalid cloze question data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Group progress */}
      {groups.length > 1 && (
        <p className="text-muted-foreground text-sm">
          Group {currentGroupIdx + 1} of {groups.length}
        </p>
      )}

      {/* Cloze text container */}
      <div className="rounded-lg border p-4 leading-relaxed text-base">
        {segments.map((seg, i) => {
          if (seg.type === "text") {
            return <span key={i}>{seg.content}</span>;
          }

          if (seg.type === "revealed") {
            return (
              <span key={i} className="font-medium">
                {seg.content}
              </span>
            );
          }

          // seg.type === "blank"
          const blankIndex = seg.blankIndex!;
          const checked = groupChecked && blankResults[blankIndex] !== undefined;
          const isCorrect = blankResults[blankIndex];

          return (
            <span key={i} className="inline-flex items-baseline gap-1">
              <Input
                type="text"
                value={userInputs[blankIndex] ?? ""}
                onChange={(e) => handleInputChange(blankIndex, e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled || groupChecked}
                placeholder={seg.hint ?? "..."}
                className={cn(
                  "inline-block h-8 w-32 text-center text-sm",
                  checked &&
                    isCorrect &&
                    "border-green-500 bg-green-500/10",
                  checked &&
                    !isCorrect &&
                    "border-destructive bg-destructive/10"
                )}
              />
              {checked && !isCorrect && (
                <span className="text-sm text-muted-foreground">
                  ({seg.answer})
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Action buttons */}
      {!disabled && !allGroupsDone && (
        <>
          {!groupChecked && (
            <Button
              onClick={handleCheckGroup}
              disabled={!allActiveFilled}
              className="w-full"
            >
              Check Answers
            </Button>
          )}

          {groupChecked && (
            <Button onClick={handleNextGroup} className="w-full">
              {currentGroupIdx + 1 < groups.length
                ? "Next Group"
                : "Submit"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
