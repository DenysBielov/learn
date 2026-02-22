"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RichContent } from "@/components/rich-content";
import { LearningMaterials } from "@/components/learning-materials";
import { SessionPanel } from "@/components/session-panel";
import { FlagButtons } from "@/components/flag-buttons";
import {
  reviewFlashcard,
  startStudySession,
  startCourseStudySession,
  completeStudySession,
} from "@/app/actions/flashcards";
import { toggleFlag } from "@/app/actions/flags";
import { BookOpen, ChevronLeft } from "lucide-react";
import type { Sm2Rating } from "@/lib/sm2";
import { CompletionNotes } from "@/components/completion-notes";

interface Flashcard {
  id: number;
  deckId: number;
  front: string;
  back: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  createdAt: Date;
  learningMaterials?: { id: number; url: string; title: string | null; type: string }[];
}

interface FlashcardStudyProps {
  deckId: number;
  deckName: string;
  cards: Flashcard[];
  courseId?: number;
  subMode?: string;
}

export function FlashcardStudy({
  deckId,
  deckName,
  cards,
  courseId,
  subMode,
}: FlashcardStudyProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [results, setResults] = useState<Array<{ rating: Sm2Rating | "skipped" }>>([]);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(384); // min h-96
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Measure both sides and use the taller one
  useEffect(() => {
    const measure = () => {
      const frontH = frontRef.current?.scrollHeight ?? 0;
      const backH = backRef.current?.scrollHeight ?? 0;
      setCardHeight(Math.max(384, frontH, backH));
    };
    measure();
    // Re-measure after fonts/KaTeX load
    const timer = setTimeout(measure, 200);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  // Initialize study session on mount
  useEffect(() => {
    const initSession = async () => {
      const session = courseId
        ? await startCourseStudySession(courseId, "flashcard", subMode ?? "review_due")
        : await startStudySession(deckId, "flashcard");
      setSessionId(session.id);
      setSessionNotes(session.notes ?? "");
    };
    initSession();
  }, [deckId, courseId, subMode]);

  const handleFlip = useCallback(() => {
    if (!isSubmitting && !window.getSelection()?.toString()) {
      setIsFlipped(prev => !prev);
    }
  }, [isSubmitting]);

  const goBack = useCallback(() => {
    if (currentIndex > 0 && !isSubmitting && !skipping) {
      setCurrentIndex(currentIndex - 1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setIsFlipped(false);
      setStartTime(Date.now());
    }
  }, [currentIndex, isSubmitting, skipping]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isSubmitting || completed) return;

      // Don't intercept keys when user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      // Left arrow to go back
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        goBack();
        return;
      }

      // Space to flip/unflip
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped(prev => !prev);
        return;
      }

      // Rating shortcuts (only after flipping)
      if (isFlipped) {
        if (e.code === "Digit1") {
          e.preventDefault();
          handleRating("again");
        } else if (e.code === "Digit2") {
          e.preventDefault();
          handleRating("hard");
        } else if (e.code === "Digit3") {
          e.preventDefault();
          handleRating("good");
        } else if (e.code === "Digit4") {
          e.preventDefault();
          handleRating("easy");
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isFlipped, isSubmitting, completed, goBack]);

  const handleRating = async (rating: Sm2Rating) => {
    if (!sessionId || isSubmitting) return;

    setIsSubmitting(true);
    const timeSpentMs = Date.now() - startTime;

    try {
      await reviewFlashcard(cards[currentIndex].id, sessionId, rating, timeSpentMs);

      setResults([...results, { rating }]);

      // Move to next card or complete
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        setIsFlipped(false);
        setStartTime(Date.now());
      } else {
        // Session complete
        await completeStudySession(sessionId);
        setCompleted(true);
      }
    } catch (error) {
      console.error("Error submitting review:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!sessionId || isSubmitting || skipping) return;

    setSkipping(true);
    const timeSpentMs = Date.now() - startTime;

    try {
      await Promise.all([
        reviewFlashcard(cards[currentIndex].id, sessionId, "again", timeSpentMs),
        toggleFlag("requires_more_study", cards[currentIndex].id),
      ]);

      setResults([...results, { rating: "skipped" }]);

      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        setIsFlipped(false);
        setStartTime(Date.now());
      } else {
        await completeStudySession(sessionId);
        setCompleted(true);
      }
    } catch (error) {
      console.error("Error skipping card:", error);
    } finally {
      setSkipping(false);
    }
  };

  if (completed) {
    const skippedCount = results.filter((r) => r.rating === "skipped").length;
    const againCount = results.filter((r) => r.rating === "again").length;
    const hardCount = results.filter((r) => r.rating === "hard").length;
    const goodCount = results.filter((r) => r.rating === "good").length;
    const easyCount = results.filter((r) => r.rating === "easy").length;

    return (
      <div className="max-w-4xl mx-auto pt-6">
        <Card>
          <CardHeader>
            <CardTitle>Study Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-muted-foreground mb-4">
                You reviewed {cards.length} card{cards.length !== 1 ? "s" : ""} in {deckName}.
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {skippedCount > 0 && (
                  <div className="rounded-lg border bg-amber-500/10 p-4 text-center">
                    <div className="text-2xl font-bold">{skippedCount}</div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                )}
                <div className="rounded-lg border bg-destructive/10 p-4 text-center">
                  <div className="text-2xl font-bold">{againCount}</div>
                  <div className="text-sm text-muted-foreground">Again</div>
                </div>
                <div className="rounded-lg border bg-orange-500/10 p-4 text-center">
                  <div className="text-2xl font-bold">{hardCount}</div>
                  <div className="text-sm text-muted-foreground">Hard</div>
                </div>
                <div className="rounded-lg border bg-blue-500/10 p-4 text-center">
                  <div className="text-2xl font-bold">{goodCount}</div>
                  <div className="text-sm text-muted-foreground">Good</div>
                </div>
                <div className="rounded-lg border bg-green-500/10 p-4 text-center">
                  <div className="text-2xl font-bold">{easyCount}</div>
                  <div className="text-sm text-muted-foreground">Easy</div>
                </div>
              </div>
            </div>

            {sessionId && <CompletionNotes sessionId={sessionId} />}

            <div className="flex gap-3">
              <Button onClick={() => router.push(courseId ? `/courses/${courseId}` : `/decks/${deckId}`)}>
                {courseId ? "Back to Course" : "Back to Deck"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="flex gap-0 h-[calc(100dvh-4rem)] md:h-dvh overflow-hidden">
      <div ref={scrollContainerRef} className="flex-1 min-w-0 flex justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-3xl space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={goBack}
                disabled={isSubmitting || skipping}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-muted-foreground">
              Card {currentIndex + 1} of {cards.length}
            </span>
          </div>
          <span className="text-muted-foreground">
            {deckName}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard */}
      <div
        className="perspective-1000 cursor-pointer"
        onClick={handleFlip}
      >
        <div
          className={cn(
            "relative w-full transition-transform duration-500",
            "transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{ height: cardHeight }}
        >
          {/* Front */}
          <Card
            ref={frontRef}
            className="backface-hidden absolute inset-0 flex items-center justify-center"
          >
            <CardContent className="flex flex-col items-center justify-center p-4 sm:p-8 text-center">
              <Badge variant="outline" className="mb-4">
                Front
              </Badge>
              <RichContent content={currentCard.front} className="text-xl sm:text-2xl font-medium" />
              {!isFlipped && (
                <p className="text-muted-foreground mt-6 text-sm">
                  Press Space or click to reveal
                </p>
              )}
            </CardContent>
          </Card>

          {/* Back */}
          <Card
            ref={backRef}
            className="backface-hidden rotate-y-180 absolute inset-0 overflow-y-auto"
          >
            <CardContent className="p-4 sm:p-8">
              <div className="mb-4 text-center">
                <Badge variant="outline">Back</Badge>
              </div>
              <RichContent content={currentCard.back} className="text-base" />
              {currentCard.learningMaterials && currentCard.learningMaterials.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <LearningMaterials materials={currentCard.learningMaterials} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Flag buttons */}
      {isFlipped && (
        <FlagButtons flashcardId={currentCard.id} key={`flags-${currentCard.id}`} />
      )}

      {results[currentIndex] ? (
        /* Already reviewed — show previous rating */
        <div className="text-center text-sm text-muted-foreground">
          Rated: <span className="font-medium capitalize">{results[currentIndex].rating}</span>
        </div>
      ) : (
        <>
          {/* Rating buttons */}
          {isFlipped && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Button
                variant="destructive"
                onClick={() => handleRating("again")}
                disabled={isSubmitting}
                className="flex flex-col gap-1 h-auto py-4"
              >
                <span className="text-lg font-bold">Again</span>
                <span className="text-xs opacity-80">Press 1</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRating("hard")}
                disabled={isSubmitting}
                className="flex flex-col gap-1 h-auto py-4 border-orange-500 text-orange-600 hover:bg-orange-500/10"
              >
                <span className="text-lg font-bold">Hard</span>
                <span className="text-xs opacity-80">Press 2</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRating("good")}
                disabled={isSubmitting}
                className="flex flex-col gap-1 h-auto py-4 border-blue-500 text-blue-600 hover:bg-blue-500/10"
              >
                <span className="text-lg font-bold">Good</span>
                <span className="text-xs opacity-80">Press 3</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRating("easy")}
                disabled={isSubmitting}
                className="flex flex-col gap-1 h-auto py-4 border-green-500 text-green-600 hover:bg-green-500/10"
              >
                <span className="text-lg font-bold">Easy</span>
                <span className="text-xs opacity-80">Press 4</span>
              </Button>
            </div>
          )}

          {/* Skip button (before flipping) */}
          {!isFlipped && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={isSubmitting || skipping}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                {skipping ? "Skipping..." : "Skip — I need to learn this first"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-center text-xs text-muted-foreground">
        {!isFlipped
          ? "Press Space to flip the card"
          : "Rate your recall: 1 (Again) | 2 (Hard) | 3 (Good) | 4 (Easy)"}
      </div>

      </div>
      </div>

      {/* Chat sidebar */}
      {sessionId && (
        <SessionPanel
          sessionId={sessionId}
          currentFlashcardId={currentCard.id}
          initialNotes={sessionNotes}
        />
      )}
    </div>
  );
}
