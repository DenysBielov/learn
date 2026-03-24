import { getQuiz } from "@/app/actions/quizzes";
import { getQuizQuestionsForQuiz } from "@/app/actions/quiz";
import { PublicHeader } from "@/components/public-header";
import { QuizPlayer } from "@/components/quiz-player";
import Link from "next/link";
import { notFound } from "next/navigation";

interface QuizPlayPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizPlayPage({ params }: QuizPlayPageProps) {
  const { id } = await params;
  const quizId = parseInt(id, 10);
  if (isNaN(quizId)) notFound();

  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();

  const questions = await getQuizQuestionsForQuiz(quizId);
  if (questions.length === 0) notFound();

  return (
    <>
      {quiz.isPublicView && <PublicHeader />}
      {quiz.step && (
        <nav className="container mx-auto max-w-4xl px-4 pt-4 sm:px-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={quiz.isPublicView ? "/explore" : "/dashboard"} className="hover:text-foreground">
            {quiz.isPublicView ? "Explore" : "Home"}
          </Link>
          <span>/</span>
          <Link href={`/courses/${quiz.step.coursePublicId}`} className="hover:text-foreground">
            {quiz.step.courseName}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{quiz.title}</span>
        </nav>
      )}
      <QuizPlayer
        quizId={quizId}
        deckName={quiz.title}
        questions={questions}
        courseId={quiz.step?.courseId}
        coursePublicId={quiz.step?.coursePublicId}
      />
    </>
  );
}
