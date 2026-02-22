import { getQuiz } from "@/app/actions/quizzes";
import { getQuizQuestionsForQuiz } from "@/app/actions/quiz";
import { QuizPlayer } from "@/components/quiz-player";
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
    <QuizPlayer
      quizId={quizId}
      deckId={0}
      deckName={quiz.title}
      questions={questions}
    />
  );
}
