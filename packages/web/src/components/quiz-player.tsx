"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RichContent } from "@/components/rich-content";
import {
  startStudySession,
  startCourseStudySession,
  startQuizStudySession,
  completeStudySession,
} from "@/app/actions/flashcards";
import { submitQuizAnswer } from "@/app/actions/quiz";
import { MultipleChoice } from "@/components/question-types/multiple-choice";
import { TrueFalse } from "@/components/question-types/true-false";
import { FreeText } from "@/components/question-types/free-text";
import { Matching } from "@/components/question-types/matching";
import { Ordering } from "@/components/question-types/ordering";
import { SessionPanel } from "@/components/session-panel";
import { FlagButtons } from "@/components/flag-buttons";
import { OpenEnded } from "@/components/question-types/open-ended";
import { Cloze } from "@/components/question-types/cloze";
import { MultiSelect } from "@/components/question-types/multi-select";
import { CodeEval } from "@/components/question-types/code-eval";
import { toggleFlag } from "@/app/actions/flags";
import { BookOpen, ChevronLeft } from "lucide-react";
import { TagBadge } from "@/components/tag-badge";
import { CompletionNotes } from "@/components/completion-notes";
import { LearningMaterials } from "@/components/learning-materials";

interface QuestionOption {
  id: number;
  questionId: number;
  optionText: string;
  isCorrect: boolean;
}

interface Question {
  id: number;
  deckId: number;
  type: "multiple_choice" | "true_false" | "free_text" | "matching" | "ordering" | "open_ended" | "cloze" | "multi_select" | "code_eval";
  question: string;
  explanation: string | null;
  correctAnswer: string | null;
  options: QuestionOption[];
  learningMaterials?: { id: number; url: string; title: string | null; type: string }[];
}

interface ActiveFilterTag {
  id: number;
  name: string;
  color: string | null;
}

interface QuizPlayerProps {
  quizId?: number;
  deckId: number;
  deckName: string;
  questions: Question[];
  courseId?: number;
  activeFilterTags?: ActiveFilterTag[];
}

interface AnswerResult {
  correct: boolean;
  userAnswer: string;
}

export function QuizPlayer({ quizId, deckId, deckName, questions, courseId, activeFilterTags }: QuizPlayerProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<(AnswerResult | null)[]>(() => Array(questions.length).fill(null));
  const [skipping, setSkipping] = useState(false);
  const [reviewingPrevious, setReviewingPrevious] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const navigateToQuestion = useCallback((index: number) => {
    setCurrentIndex(index);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    const storedResult = results[index];
    if (storedResult && storedResult.userAnswer !== "[skipped]") {
      // Previously answered — show read-only
      setAnswered(true);
      setResult(storedResult);
      setReviewingPrevious(true);
    } else {
      // New question or previously skipped — allow answering
      setAnswered(false);
      setResult(null);
      setReviewingPrevious(false);
    }
    setStartTime(Date.now());
  }, [results]);

  const goBack = useCallback(() => {
    if (currentIndex > 0 && !skipping) {
      navigateToQuestion(currentIndex - 1);
    }
  }, [currentIndex, skipping, navigateToQuestion]);

  // Initialize quiz session on mount
  useEffect(() => {
    const initSession = async () => {
      let session;
      if (quizId) {
        session = await startQuizStudySession(quizId);
      } else if (courseId) {
        session = await startCourseStudySession(courseId, "quiz", "default");
      } else {
        session = await startStudySession(deckId, "quiz");
      }
      setSessionId(session.id);
      setSessionNotes(session.notes ?? "");
    };
    initSession();
  }, [quizId, deckId, courseId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (completed || skipping) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [completed, skipping, goBack]);

  const handleAnswer = async (isCorrect: boolean, userAnswer: string) => {
    if (!sessionId || answered) return;

    const timeSpentMs = Date.now() - startTime;
    const newResult = { correct: isCorrect, userAnswer };
    setAnswered(true);
    setResult(newResult);
    setReviewingPrevious(false);

    // Store result at current index
    setResults(prev => {
      const updated = [...prev];
      updated[currentIndex] = newResult;
      return updated;
    });

    try {
      await submitQuizAnswer(
        sessionId,
        questions[currentIndex].id,
        isCorrect,
        userAnswer,
        timeSpentMs
      );
    } catch (error) {
      console.error("Error submitting answer:", error);
    }
  };

  const handleNext = async () => {
    if (!result) return;

    if (currentIndex < questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    } else {
      // Quiz complete
      if (sessionId) {
        await completeStudySession(sessionId);
      }
      setCompleted(true);
    }
  };

  const handleSkip = async () => {
    if (!sessionId || answered || skipping) return;

    setSkipping(true);
    const timeSpentMs = Date.now() - startTime;
    const skipResult: AnswerResult = { correct: false, userAnswer: "[skipped]" };

    try {
      await Promise.all([
        submitQuizAnswer(sessionId, questions[currentIndex].id, false, "[skipped]", timeSpentMs),
        toggleFlag("requires_more_study", undefined, questions[currentIndex].id),
      ]);

      setResults(prev => {
        const updated = [...prev];
        updated[currentIndex] = skipResult;
        return updated;
      });

      if (currentIndex < questions.length - 1) {
        navigateToQuestion(currentIndex + 1);
      } else {
        await completeStudySession(sessionId);
        setCompleted(true);
      }
    } catch (error) {
      console.error("Error skipping question:", error);
    } finally {
      setSkipping(false);
    }
  };

  if (completed) {
    const answeredResults = results.filter((r): r is AnswerResult => r !== null);
    const correctCount = answeredResults.filter((r) => r.correct).length;
    const incorrectCount = answeredResults.filter((r) => !r.correct).length;
    const percentage = answeredResults.length > 0 ? Math.round((correctCount / answeredResults.length) * 100) : 0;

    return (
      <div className="max-w-4xl mx-auto">
        <Card>
        <CardHeader>
          <CardTitle>Quiz Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-4">
              You completed the quiz for {deckName}.
            </p>

            <div className="mb-6 rounded-lg border bg-primary/10 p-6 text-center">
              <div className="text-4xl font-bold">{percentage}%</div>
              <div className="text-muted-foreground mt-2">
                {correctCount} out of {answeredResults.length} correct
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-green-500/10 p-4 text-center">
                <div className="text-2xl font-bold">{correctCount}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div className="rounded-lg border bg-destructive/10 p-4 text-center">
                <div className="text-2xl font-bold">{incorrectCount}</div>
                <div className="text-sm text-muted-foreground">Incorrect</div>
              </div>
            </div>
          </div>

          {sessionId && <CompletionNotes sessionId={sessionId} />}

          <div className="flex gap-3">
            <Button onClick={() => router.push(quizId ? `/quizzes/${quizId}` : courseId ? `/courses/${courseId}` : `/decks/${deckId}`)}>
              {quizId ? "Back to Quiz" : courseId ? "Back to Course" : "Back to Deck"}
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

  const currentQuestion = questions[currentIndex];

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
                disabled={skipping}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
            {activeFilterTags && activeFilterTags.length > 0 && (
              <div className="flex gap-1 ml-2">
                {activeFilterTags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>
          <span className="text-muted-foreground">{deckName}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 text-lg font-semibold leading-none tracking-tight">
              <RichContent content={currentQuestion.question} />
            </div>
            <Badge variant="outline" className="ml-4">
              {currentQuestion.type.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question type component or review summary */}
          {reviewingPrevious && result ? (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm">
                <span className="font-medium">Your answer:</span>{" "}
                {result.userAnswer}
              </p>
            </div>
          ) : (
            <>
              {currentQuestion.type === "multiple_choice" && (
                <MultipleChoice
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "true_false" && (
                <TrueFalse
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "free_text" && (
                <FreeText
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "matching" && (
                <Matching
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "ordering" && (
                <Ordering
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "open_ended" && (
                <OpenEnded
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "cloze" && (
                <Cloze
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "multi_select" && (
                <MultiSelect
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
              {currentQuestion.type === "code_eval" && (
                <CodeEval
                  key={currentQuestion.id}
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  disabled={answered}
                />
              )}
            </>
          )}

          {/* Skip button */}
          {!answered && (
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={skipping}
              className="w-full text-muted-foreground"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              {skipping ? "Skipping..." : "Skip — I need to learn this first"}
            </Button>
          )}

          {/* Feedback */}
          {answered && result && (
            <div
              className={`rounded-lg border p-4 ${
                result.correct
                  ? "border-green-500 bg-green-500/10"
                  : "border-destructive bg-destructive/10"
              }`}
            >
              <div className="mb-2 font-semibold">
                {result.correct ? "Correct!" : "Incorrect"}
              </div>
              {currentQuestion.explanation && (
                <div className="text-muted-foreground text-sm">
                  <RichContent content={currentQuestion.explanation} />
                </div>
              )}
              {currentQuestion.learningMaterials && currentQuestion.learningMaterials.length > 0 && (
                <div className="mt-3 pt-3 border-t border-current/20">
                  <LearningMaterials materials={currentQuestion.learningMaterials} />
                </div>
              )}
            </div>
          )}

          {/* Flag buttons */}
          {answered && (
            <FlagButtons questionId={currentQuestion.id} key={`flags-${currentQuestion.id}`} />
          )}

          {/* Next button */}
          {answered && (
            <Button onClick={handleNext} className="w-full">
              {currentIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
            </Button>
          )}

        </CardContent>
        </Card>
      </div>
      </div>

      {/* Chat sidebar */}
      {sessionId && (
        <SessionPanel
          sessionId={sessionId}
          currentQuestionId={currentQuestion.id}
          currentUserAnswer={result?.userAnswer}
          initialNotes={sessionNotes}
        />
      )}
    </div>
  );
}
