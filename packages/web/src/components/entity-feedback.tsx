"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  toggleFeedback,
  addFeedbackComment,
  getEntityFeedback,
  type EntityType,
  type EntityFeedbackData,
} from "@/app/actions/feedback";

interface EntityFeedbackProps {
  entityType: EntityType;
  entityId: number;
  /** Pre-fetched data from server component. When provided, skips the useEffect fetch. */
  initialData?: EntityFeedbackData;
}

export function EntityFeedback({ entityType, entityId, initialData }: EntityFeedbackProps) {
  const [userVote, setUserVote] = useState<1 | -1 | null>(initialData?.userVote ?? null);
  const [positiveCount, setPositiveCount] = useState(initialData?.positiveCount ?? 0);
  const [negativeCount, setNegativeCount] = useState(initialData?.negativeCount ?? 0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState(initialData?.userComment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) return; // Skip fetch when server-provided data is available
    getEntityFeedback(entityType, entityId).then((data) => {
      setUserVote(data.userVote);
      setPositiveCount(data.positiveCount);
      setNegativeCount(data.negativeCount);
      setComment(data.userComment ?? "");
    });
  }, [entityType, entityId, initialData]);

  const handleVote = useCallback(async (vote: 1 | -1) => {
    setSubmitting(true);
    try {
      const prev = userVote;
      // Optimistic update
      if (prev === vote) {
        // Retract
        setUserVote(null);
        if (vote === 1) setPositiveCount((c) => c - 1);
        else setNegativeCount((c) => c - 1);
        setComment("");
        setCommentOpen(false);
      } else {
        setUserVote(vote);
        if (vote === 1) {
          setPositiveCount((c) => c + 1);
          if (prev === -1) setNegativeCount((c) => c - 1);
        } else {
          setNegativeCount((c) => c + 1);
          if (prev === 1) setPositiveCount((c) => c - 1);
        }
        if (prev !== null) setComment("");
        setCommentOpen(true);
      }

      const result = await toggleFeedback(entityType, entityId, vote);
      // If retracted, close popover
      if (result.userVote === null) {
        setCommentOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }, [entityType, entityId, userVote]);

  const handleSaveComment = useCallback(async () => {
    if (!comment.trim()) {
      setCommentOpen(false);
      return;
    }
    await addFeedbackComment(entityType, entityId, comment.trim());
    setCommentOpen(false);
  }, [entityType, entityId, comment]);

  return (
    <div className="flex items-center gap-1">
      <Popover open={commentOpen && userVote === 1} onOpenChange={(open) => { if (!open) setCommentOpen(false); }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVote(1)}
            disabled={submitting}
            className={`h-7 gap-1 px-2 ${userVote === 1 ? "text-green-500 bg-green-500/10" : "text-muted-foreground"}`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {positiveCount > 0 && <span className="text-xs">{positiveCount}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex gap-1.5">
            <Input
              ref={commentInputRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveComment()}
              placeholder="Why? (optional)"
              className="h-8 text-xs"
              autoFocus
            />
            <Button size="sm" className="h-8 px-2 text-xs" onClick={handleSaveComment}>
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={commentOpen && userVote === -1} onOpenChange={(open) => { if (!open) setCommentOpen(false); }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVote(-1)}
            disabled={submitting}
            className={`h-7 gap-1 px-2 ${userVote === -1 ? "text-red-500 bg-red-500/10" : "text-muted-foreground"}`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            {negativeCount > 0 && <span className="text-xs">{negativeCount}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex gap-1.5">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveComment()}
              placeholder="Why? (optional)"
              className="h-8 text-xs"
              autoFocus
            />
            <Button size="sm" className="h-8 px-2 text-xs" onClick={handleSaveComment}>
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
