"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag, BookOpen, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFlag, addFlagComment, getFlags } from "@/app/actions/flags";

type FlagType = "requires_review" | "requires_more_study";

interface FlagData {
  flagType: string;
  comment: string | null;
}

interface FlagButtonsProps {
  flashcardId?: number;
  questionId?: number;
}

export function FlagButtons({ flashcardId, questionId }: FlagButtonsProps) {
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [commentFor, setCommentFor] = useState<FlagType | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reviewFlag = flags.find(f => f.flagType === "requires_review");
  const studyFlag = flags.find(f => f.flagType === "requires_more_study");

  useEffect(() => {
    const load = async () => {
      const result = await getFlags(flashcardId, questionId);
      setFlags(result.map(f => ({ flagType: f.flagType, comment: f.comment })));
    };
    load();
  }, [flashcardId, questionId]);

  const handleToggle = async (flagType: FlagType) => {
    const isActive = flagType === "requires_review" ? reviewFlag : studyFlag;

    setSubmitting(true);
    try {
      await toggleFlag(flagType, flashcardId, questionId);
      if (isActive) {
        setFlags(prev => prev.filter(f => f.flagType !== flagType));
        if (commentFor === flagType) {
          setCommentFor(null);
          setComment("");
        }
      } else {
        setFlags(prev => [...prev, { flagType, comment: null }]);
        setCommentFor(flagType);
        setComment("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!comment.trim() || !commentFor) return;
    setSubmitting(true);
    try {
      await addFlagComment(commentFor, comment.trim(), flashcardId, questionId);
      setFlags(prev => prev.map(f =>
        f.flagType === commentFor ? { ...f, comment: comment.trim() } : f
      ));
      setComment("");
      setCommentFor(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={() => handleToggle("requires_review")}
          className={cn(
            "gap-1.5 text-xs",
            reviewFlag && "text-red-500 hover:text-red-600"
          )}
          title="Flag for review (incorrect/irrelevant content)"
        >
          <Flag className={cn("h-4 w-4", reviewFlag && "fill-current")} />
          Review
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={() => handleToggle("requires_more_study")}
          className={cn(
            "gap-1.5 text-xs",
            studyFlag && "text-amber-500 hover:text-amber-600"
          )}
          title="Needs more study (topic needs deeper coverage)"
        >
          <BookOpen className={cn("h-4 w-4", studyFlag && "fill-current")} />
          More Study
        </Button>
      </div>

      {/* Existing comments */}
      {(reviewFlag?.comment || studyFlag?.comment) && (
        <div className="space-y-1">
          {reviewFlag?.comment && (
            <p className="text-xs text-red-500/80 text-center italic">
              Review: {reviewFlag.comment}
            </p>
          )}
          {studyFlag?.comment && (
            <p className="text-xs text-amber-500/80 text-center italic">
              Study: {studyFlag.comment}
            </p>
          )}
        </div>
      )}

      {commentFor && (
        <div className="flex items-center gap-2">
          <Input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={`Add a note for ${commentFor === "requires_review" ? "review" : "more study"}...`}
            className="text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleComment();
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            disabled={submitting || !comment.trim()}
            onClick={handleComment}
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { setCommentFor(null); setComment(""); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
