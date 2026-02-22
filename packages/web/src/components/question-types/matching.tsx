"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/rich-content";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import {
  PointerSensor,
  KeyboardSensor,
  PointerActivationConstraints,
  Accessibility,
} from "@dnd-kit/dom";
import type { DragEndEvent } from "@dnd-kit/dom";
import { GripVertical, RotateCcw } from "lucide-react";

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
}

interface MatchPair {
  left: string;
  right: string;
}

interface MatchingProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

function DraggableChip({
  id,
  label,
  isSelected,
  onClick,
  disabled,
}: {
  id: string;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const { ref, isDragging } = useDraggable({ id, disabled });

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium
        transition-colors select-none cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-40" : ""}
        ${isSelected ? "border-primary ring-2 ring-primary/30 bg-primary/10" : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"}
        ${disabled ? "opacity-50 cursor-default" : ""}
      `}
    >
      {!disabled && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
      <RichContent content={label} className="inline [&>*]:inline" />
    </button>
  );
}

function DropZone({
  id,
  leftLabel,
  matchedRight,
  selectedItem,
  onClickZone,
  onUnmatch,
  disabled,
}: {
  id: string;
  leftLabel: string;
  matchedRight: string | undefined;
  selectedItem: string | null;
  onClickZone: () => void;
  onUnmatch: () => void;
  disabled: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id, disabled });

  return (
    <div
      ref={ref}
      onClick={!disabled && !matchedRight ? onClickZone : undefined}
      className={`
        flex items-center gap-3 rounded-lg border p-3 transition-colors
        ${isDropTarget ? "border-primary bg-primary/10 ring-1 ring-primary/30" : ""}
        ${matchedRight && isDropTarget ? "border-primary bg-primary/10 ring-1 ring-primary/30" : ""}
        ${!matchedRight && selectedItem && !disabled && !isDropTarget ? "border-dashed border-primary/40 cursor-pointer hover:bg-primary/5" : ""}
      `}
    >
      <div className="flex-1 font-medium min-w-0">
        <RichContent content={leftLabel} />
      </div>
      <div className="text-muted-foreground shrink-0">&rarr;</div>
      {matchedRight ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUnmatch(); }}
          disabled={disabled}
          className={`
            rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium
            transition-colors shrink-0
            ${disabled ? "cursor-default" : "cursor-pointer hover:bg-destructive/10 hover:border-destructive/30 hover:line-through"}
            ${isDropTarget ? "opacity-50" : ""}
          `}
        >
          <RichContent content={matchedRight} className="inline [&>*]:inline" />
        </button>
      ) : (
        <span className={`text-muted-foreground/50 text-sm italic shrink-0 ${selectedItem ? "text-primary/60" : ""}`}>
          {selectedItem ? "click to place" : "empty"}
        </span>
      )}
    </div>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\$(.*?)\$/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/#+\s/g, "")
    .trim();
}

export function Matching({ question, onAnswer, disabled }: MatchingProps) {
  const correctPairs = useMemo<MatchPair[]>(() => {
    if (!question.correctAnswer) return [];
    try {
      return JSON.parse(question.correctAnswer) as MatchPair[];
    } catch (error) {
      console.error("Error parsing matching pairs:", error);
      return [];
    }
  }, [question.correctAnswer]);

  const leftItems = useMemo(
    () => correctPairs.map((p) => p.left),
    [correctPairs]
  );
  const rightItems = useMemo(
    () => [...correctPairs.map((p) => p.right)].sort(() => Math.random() - 0.5),
    [correctPairs]
  );

  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const unmatchedRightItems = useMemo(
    () => {
      const matchedValues = new Set(Object.values(matches));
      return rightItems.filter((r) => !matchedValues.has(r));
    },
    [rightItems, matches]
  );

  const handleMatch = useCallback(
    (left: string, right: string) => {
      if (disabled) return;
      setMatches((prev) => {
        const next = { ...prev };
        const existingLeft = Object.keys(next).find((k) => next[k] === right);
        if (existingLeft) delete next[existingLeft];
        next[left] = right;
        return next;
      });
      setSelectedItem(null);
    },
    [disabled]
  );

  const handleUnmatch = useCallback(
    (left: string) => {
      if (disabled) return;
      setMatches((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
    },
    [disabled]
  );

  const handleReset = useCallback(() => {
    setMatches({});
    setSelectedItem(null);
  }, []);

  const handleChipClick = useCallback(
    (right: string) => {
      if (disabled) return;
      if (selectedItem === right) {
        setSelectedItem(null);
      } else {
        setSelectedItem(right);
      }
    },
    [disabled, selectedItem]
  );

  const handleDropZoneClick = useCallback(
    (left: string) => {
      if (disabled || !selectedItem) return;
      handleMatch(left, selectedItem);
    },
    [disabled, selectedItem, handleMatch]
  );

  const handleDragEnd = useCallback(
    (event: Parameters<DragEndEvent>[0]) => {
      const { operation } = event;
      if (event.canceled || !operation.source || !operation.target) return;

      const rightId = String(operation.source.id);
      const leftId = String(operation.target.id).replace("drop-", "");

      if (leftItems.includes(leftId)) {
        handleMatch(leftId, rightId);
      }
    },
    [leftItems, handleMatch]
  );

  const handleSubmit = () => {
    let correct = true;
    const userPairs: MatchPair[] = [];

    for (const pair of correctPairs) {
      const userRight = matches[pair.left];
      userPairs.push({ left: pair.left, right: userRight || "" });
      if (userRight !== pair.right) {
        correct = false;
      }
    }

    onAnswer(correct, JSON.stringify(userPairs));
  };

  const allMatched = leftItems.every((left) => matches[left]);
  const hasAnyMatch = Object.keys(matches).length > 0;

  if (disabled) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Correct matches:
          </p>
          {correctPairs.map((pair, index) => (
            <div
              key={index}
              className="rounded-lg border bg-green-500/10 p-2 text-sm"
            >
              <span className="font-medium">
                <RichContent content={pair.left} className="inline" />
              </span>{" "}
              →{" "}
              <RichContent content={pair.right} className="inline" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DragDropProvider
      sensors={[
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({
              value: 8,
            }),
          ],
        }),
        KeyboardSensor,
      ]}
      plugins={[
        Accessibility.configure({
          announcements: {
            dragstart(event: { operation: { source: { id: unknown } | null } }) {
              if (event.operation.source) {
                return `${stripMarkdown(String(event.operation.source.id))} picked up`;
              }
            },
            dragend(event: { operation: { source: { id: unknown } | null; target: { id: unknown } | null }; canceled: boolean }) {
              if (event.canceled && event.operation.source) {
                return `${stripMarkdown(String(event.operation.source.id))} returned to pool`;
              }
              if (event.operation.source && event.operation.target) {
                const leftId = String(event.operation.target.id).replace("drop-", "");
                return `${stripMarkdown(String(event.operation.source.id))} matched with ${stripMarkdown(leftId)}`;
              }
            },
          },
        }),
      ]}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Top bar: hint + reset */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            {isTouchDevice
              ? "Tap items to match, or long-press to drag"
              : "Drag items to match, or click to select"}
          </p>
          {hasAnyMatch && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 h-7 text-xs text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        {/* Drop zones */}
        <div className="space-y-2">
          {leftItems.map((left) => (
            <DropZone
              key={left}
              id={`drop-${left}`}
              leftLabel={left}
              matchedRight={matches[left]}
              selectedItem={selectedItem}
              onClickZone={() => handleDropZoneClick(left)}
              onUnmatch={() => handleUnmatch(left)}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Draggable pool at bottom */}
        {unmatchedRightItems.length > 0 && (
          <div>
            <p className="text-muted-foreground text-xs font-medium mb-2">
              Available items
            </p>
            <div className="flex flex-wrap gap-2">
              {unmatchedRightItems.map((right) => (
                <DraggableChip
                  key={right}
                  id={right}
                  label={right}
                  isSelected={selectedItem === right}
                  onClick={() => handleChipClick(right)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!allMatched} className="w-full">
          Submit Answer
        </Button>
      </div>

      <DragOverlay>
        {(source) =>
          source ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary bg-card px-3 py-2.5 text-sm font-medium shadow-lg">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <span>{stripMarkdown(String(source.id))}</span>
            </div>
          ) : null
        }
      </DragOverlay>
    </DragDropProvider>
  );
}
