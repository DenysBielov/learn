"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RichContent } from "@/components/rich-content";
import {
  startStudySession,
  startCourseStudySession,
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
import { BookOpen } from "lucide-react";
import { CompletionNotes } from "@/components/completion-notes";

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
}

interface QuizPlayerProps {
  deckId: number;
  deckName: string;
  questions: Question[];
  courseId?: number;
}

interface AnswerResult {
  correct: boolean;
  userAnswer: string;
}

export function QuizPlayer({ deckId, deckName, questions, courseId }: QuizPlayerProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [skipping, setSkipping] = useState(false);

  // Initialize quiz session on mount
  useEffect(() => {
    const initSession = async () => {
      const session = courseId
        ? await startCourseStudySession(courseId, "quiz", "default")
        : await startStudySession(deckId, "quiz");
      setSessionId(session.id);
      setSessionNotes(session.notes ?? "");
    };
    initSession();
  }, [deckId, courseId]);

  const handleAnswer = async (isCorrect: boolean, userAnswer: string) => {
    if (!sessionId || answered) return;

    const timeSpentMs = Date.now() - startTime;
    setAnswered(true);
    setResult({ correct: isCorrect, userAnswer });

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

    const updatedResults = [...results, result];
    setResults(updatedResults);

    // Move to next question or complete
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswered(false);
      setResult(null);
      setStartTime(Date.now());
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
    } catch (error) {
      console.error("Error skipping question:", error);
    }

    const updatedResults = [...results, skipResult];
    setResults(updatedResults);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswered(false);
      setResult(null);
      setStartTime(Date.now());
    } else {
      if (sessionId) {
        await completeStudySession(sessionId);
      }
      setCompleted(true);
    }
    setSkipping(false);
  };

  if (completed) {
    const correctCount = results.filter((r) => r.correct).length;
    const incorrectCount = results.filter((r) => !r.correct).length;
    const percentage = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

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
                {correctCount} out of {results.length} correct
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

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex gap-0 h-[calc(100dvh-4rem)] md:h-dvh overflow-hidden">
      <div className="flex-1 min-w-0 flex justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-3xl space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
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
          {/* Question type component */}
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
