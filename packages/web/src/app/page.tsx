import { getTopLevelCourses, getUngroupedDecks } from "@/app/actions/courses";
import { DeckCard } from "@/components/deck-card";
import { CourseCard } from "@/components/course-card";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { CreateCourseDialog } from "@/components/create-course-dialog";

export default async function DashboardPage() {
  const [allCourses, ungroupedDecks] = await Promise.all([
    getTopLevelCourses(),
    getUngroupedDecks(),
  ]);

  const activeCourses = allCourses.filter(c => c.isActive || c.isEffectivelyActive);
  const otherCourses = allCourses.filter(c => !c.isActive && !c.isEffectivelyActive);

  const isEmpty = allCourses.length === 0 && ungroupedDecks.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex gap-2">
          <CreateCourseDialog />
          <CreateDeckDialog />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">No content yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create a course to organize your learning, or start with a standalone deck.
          </p>
          <div className="flex gap-2">
            <CreateCourseDialog />
            <CreateDeckDialog />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {activeCourses.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Active Courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    name={course.name}
                    description={course.description}
                    color={course.color}
                    totalDecks={course.totalDecks}
                    dueCards={course.dueCards}
                    isActive={course.isActive}
                  />
                ))}
              </div>
            </section>
          )}

          {activeCourses.length === 0 && allCourses.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Active Courses</h2>
              <p className="text-sm text-muted-foreground">
                No active courses yet. Mark courses you&apos;re currently studying as active to see them here.
              </p>
            </section>
          )}

          {otherCourses.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Other Courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    name={course.name}
                    description={course.description}
                    color={course.color}
                    totalDecks={course.totalDecks}
                    dueCards={course.dueCards}
                    isActive={course.isActive}
                  />
                ))}
              </div>
            </section>
          )}

          {ungroupedDecks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Decks</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ungroupedDecks.map((deck) => (
                  <DeckCard
                    key={deck.id}
                    id={deck.id}
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
        </div>
      )}
    </div>
  );
}
