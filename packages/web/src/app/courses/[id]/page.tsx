import { getCourse, getCourseBreadcrumbs, getCourseJourney } from "@/app/actions/courses";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CourseCard } from "@/components/course-card";
import { DeckCard } from "@/components/deck-card";
import { CreateCourseDialog } from "@/components/create-course-dialog";
import { AddDeckToCourseDialog } from "@/components/add-deck-to-course-dialog";
import { EditCourseDialog } from "@/components/edit-course-dialog";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { LearningJourney } from "@/components/learning-journey";
import { AddStepDialog } from "@/components/add-step-dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionHistory } from "@/components/session-history";
import { BookOpen, Brain } from "lucide-react";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const courseId = parseInt(id, 10);
  if (isNaN(courseId)) notFound();

  const [course, breadcrumbs, journey] = await Promise.all([
    getCourse(courseId),
    getCourseBreadcrumbs(courseId),
    getCourseJourney(courseId).catch(() => []),
  ]);

  if (!course) notFound();

  const completedStepIds = new Set(
    journey.filter(s => s.isCompleted).map(s => s.id)
  );

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-7xl space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      <div>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-2 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{course.name}</h1>
          <ToggleActiveButton courseId={course.id} isActive={course.isActive} variant="header" />
          <EditCourseDialog course={{ id: course.id, name: course.name, description: course.description, color: course.color }} />
        </div>
        {course.description && (
          <p className="text-muted-foreground mt-2 ml-5">{course.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/courses/${courseId}/study`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Study Flashcards
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/courses/${courseId}/quiz`}>
            <Brain className="mr-2 h-4 w-4" />
            Take Quiz
          </Link>
        </Button>
        <CreateCourseDialog parentId={courseId} triggerLabel="Add Sub-Course" />
        <AddDeckToCourseDialog courseId={courseId} />
        <AddStepDialog courseId={courseId} />
      </div>

      {course.steps.length > 0 && (
        <LearningJourney
          courseId={courseId}
          steps={course.steps}
          completedStepIds={completedStepIds}
        />
      )}

      {course.children.length > 0 && (() => {
        const activeChildren = course.children.filter(c => c.isActive);
        const inactiveChildren = course.children.filter(c => !c.isActive);
        return (
          <>
            {activeChildren.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Active Sub-Courses</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeChildren.map((child) => (
                    <CourseCard
                      key={child.id}
                      id={child.id}
                      name={child.name}
                      description={child.description}
                      color={child.color}
                      totalDecks={child.totalDecks}
                      dueCards={child.dueCards}
                      isActive={child.isActive}
                    />
                  ))}
                </div>
              </section>
            )}
            {inactiveChildren.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">
                  {activeChildren.length > 0 ? "Other Sub-Courses" : "Sub-Courses"}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {inactiveChildren.map((child) => (
                    <CourseCard
                      key={child.id}
                      id={child.id}
                      name={child.name}
                      description={child.description}
                      color={child.color}
                      totalDecks={child.totalDecks}
                      dueCards={child.dueCards}
                      isActive={child.isActive}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        );
      })()}


      {course.decks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Decks</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {course.decks.map((deck) => (
              <DeckCard
                key={deck.deckId}
                id={deck.deckId}
                name={deck.name}
                description={deck.description ?? ""}
                flashcardCount={deck.flashcardCount}
                questionCount={deck.questionCount}
                dueCount={deck.dueCount}
              />
            ))}
          </div>
        </section>
      )}

      <SessionHistory courseId={courseId} />

      {course.children.length === 0 && course.decks.length === 0 && course.steps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            This course is empty. Add sub-courses, link existing decks, or add learning steps to get started.
          </p>
        </div>
      )}
    </div>
  );
}
