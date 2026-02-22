import { getQuiz } from "@/app/actions/quizzes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brain, ChevronLeft, ChevronRight, Clock, Trophy } from "lucide-react";
import { StepCompleteButton } from "@/components/step-complete-button";

interface QuizPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { id } = await params;
  const quizId = parseInt(id, 10);
  if (isNaN(quizId)) notFound();

  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();

  function getStepUrl(step: { stepType: string; materialId: number | null; quizId: number | null }) {
    if (step.stepType === "material" && step.materialId) return `/materials/${step.materialId}`;
    if (step.stepType === "quiz" && step.quizId) return `/quizzes/${step.quizId}`;
    return "#";
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-4xl space-y-6">
      {/* Breadcrumbs */}
      {quiz.step && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href={`/courses/${quiz.step.courseId}`} className="hover:text-foreground">
            {quiz.step.courseName}
          </Link>
          <span>/</span>
          <span className="text-foreground">{quiz.title}</span>
        </nav>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-muted-foreground shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{quiz.title}</h1>
        </div>
        {quiz.description && (
          <p className="text-muted-foreground mt-2 ml-9">{quiz.description}</p>
        )}
      </div>

      {/* Quiz Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{quiz.questions.length}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{quiz.pastScores.length}</div>
              <div className="text-sm text-muted-foreground">Attempts</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Start Quiz */}
      <Button asChild size="lg" className="w-full" disabled={quiz.questions.length === 0}>
        <Link href={`/quizzes/${quizId}/play`}>
          <Brain className="mr-2 h-5 w-5" />
          {quiz.questions.length === 0 ? "No questions yet" : "Start Quiz"}
        </Link>
      </Button>

      {/* Past Scores */}
      {quiz.pastScores.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Attempts</h2>
          <div className="space-y-2">
            {quiz.pastScores.map((score) => (
              <div key={score.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {score.totalCount > 0
                        ? `${Math.round((score.correctCount / score.totalCount) * 100)}%`
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {score.correctCount}/{score.totalCount} correct
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {score.startedAt.toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completion & Navigation */}
      {quiz.step && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <StepCompleteButton
            stepId={quiz.step.id}
            isCompleted={quiz.step.isCompleted}
          />

          <div className="flex gap-3">
            {quiz.prevStep && (
              <Button variant="outline" asChild>
                <Link href={getStepUrl(quiz.prevStep)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Link>
              </Button>
            )}
            {quiz.nextStep && (
              <Button asChild>
                <Link href={getStepUrl(quiz.nextStep)}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
