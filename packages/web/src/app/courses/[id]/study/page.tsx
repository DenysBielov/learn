import { getCourse, getCourseBreadcrumbs } from "@/app/actions/courses";
import { getCourseFlashcards } from "@/app/actions/flashcards";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StudyModePicker } from "@/components/study-mode-picker";
import { FlashcardStudy } from "@/components/flashcard-study";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

interface CourseStudyPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default async function CourseStudyPage({ params, searchParams }: CourseStudyPageProps) {
  const { id } = await params;
  const { mode } = await searchParams;
  const courseId = parseInt(id, 10);
  if (isNaN(courseId)) notFound();

  const [course, breadcrumbs] = await Promise.all([
    getCourse(courseId),
    getCourseBreadcrumbs(courseId),
  ]);

  if (!course) notFound();

  // No mode selected — show picker
  if (!mode || !["review_due", "sequential", "random", "weakest_first"].includes(mode)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[...breadcrumbs, { id: 0, name: "Study" }]} />
        <h1 className="text-3xl font-bold tracking-tight">Study {course.name}</h1>
        <p className="text-muted-foreground">Choose a study mode:</p>
        <StudyModePicker courseId={courseId} type="flashcard" />
      </div>
    );
  }

  const subMode = mode as "review_due" | "sequential" | "random" | "weakest_first";
  let cards = await getCourseFlashcards(courseId, subMode);

  if (cards.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>No cards available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {subMode === "review_due"
                ? "No cards are due for review in this course."
                : "No flashcards found in this course tree."}
            </p>
            <Link href={`/courses/${courseId}`}>
              <Button>Back to Course</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Apply Fisher-Yates shuffle for random and review_due modes
  if (subMode === "random" || subMode === "review_due") {
    cards = shuffle(cards);
  }

  return (
    <FlashcardStudy
      deckId={0}
      deckName={course.name}
      cards={cards}
      courseId={courseId}
      subMode={subMode}
    />
  );
}
