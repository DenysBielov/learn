import { getCourse, getCourseBreadcrumbs } from "@/app/actions/courses";
import { getCourseQuizQuestions } from "@/app/actions/quiz";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StudyModePicker } from "@/components/study-mode-picker";
import { QuizPlayer } from "@/components/quiz-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

interface CourseQuizPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default async function CourseQuizPage({ params, searchParams }: CourseQuizPageProps) {
  const { id } = await params;
  const { mode } = await searchParams;
  const courseId = parseInt(id, 10);
  if (isNaN(courseId)) notFound();

  const [course, breadcrumbs] = await Promise.all([
    getCourse(courseId),
    getCourseBreadcrumbs(courseId),
  ]);

  if (!course) notFound();

  if (!mode || !["sequential", "random", "weakest_first"].includes(mode)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[...breadcrumbs, { id: 0, name: "Quiz" }]} />
        <h1 className="text-3xl font-bold tracking-tight">Quiz: {course.name}</h1>
        <p className="text-muted-foreground">Choose a quiz mode:</p>
        <StudyModePicker courseId={courseId} type="quiz" />
      </div>
    );
  }

  const subMode = mode as "sequential" | "random" | "weakest_first";
  let questions = await getCourseQuizQuestions(courseId, subMode);

  if (questions.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader><CardTitle>No questions available</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">No quiz questions found in this course tree.</p>
            <Link href={`/courses/${courseId}`}><Button>Back to Course</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subMode === "random") {
    questions = shuffle(questions);
  }

  return (
    <QuizPlayer
      deckId={0}
      deckName={course.name}
      questions={questions}
      courseId={courseId}
    />
  );
}
