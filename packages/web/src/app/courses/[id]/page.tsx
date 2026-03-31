import { getPublicCourse, getCourseBreadcrumbs, getCourseJourney } from "@/app/actions/courses";
import { getEntityFeedbackData } from "@/lib/feedback-data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EditCourseDialog } from "@/components/edit-course-dialog";
import { EntityFeedback } from "@/components/entity-feedback";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { CourseAddMenu } from "@/components/course-add-menu";
import { CourseSplitLayout } from "@/components/course-split-layout";
import type { TreeItem } from "@/components/course-tree";
import { CourseStudyButton } from "@/components/course-study-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionHistory } from "@/components/session-history";
import { VisibilitySelect } from "@/components/visibility-select";
import { GitBranch, BookOpen, Brain, FolderOpen, UserPlus } from "lucide-react";
import { ForkCourseButton } from "@/components/fork-course-button";
import { PublicHeader } from "@/components/public-header";
import { getOptionalUser } from "@/lib/auth";
import { getDb } from "@flashcards/database";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id: publicId } = await params;

  const course = await getPublicCourse(publicId);
  if (!course) notFound();

  const user = await getOptionalUser();
  const feedbackData = user ? getEntityFeedbackData(getDb(), user.userId, "course", course.id) : undefined;

  if (course.isOwner) {
    // Owner view: full edit/study experience
    const [breadcrumbs, journey] = await Promise.all([
      getCourseBreadcrumbs(course.id),
      getCourseJourney(course.id).catch(() => []),
    ]);

    const treeItems: TreeItem[] = [
      ...course.children.map(c => ({
        type: "subcourse" as const,
        id: c.id,
        publicId: c.publicId,
        name: c.name,
        color: c.color,
        isActive: c.isActive,
        totalDecks: c.totalDecks,
        dueCards: c.dueCards ?? 0,
        description: c.description ?? null,
        estimatedHours: c.estimatedHours ?? null,
      })),
      ...journey.map(s => ({
        type: "step" as const,
        id: s.id,
        stepType: s.stepType,
        title: s.title,
        materialId: s.materialId,
        quizId: s.quizId,
        isCompleted: s.isCompleted,
      })),
      ...course.decks.map(d => ({
        type: "deck" as const,
        deckId: d.deckId,
        name: d.name,
        flashcardCount: d.flashcardCount,
        dueCount: d.dueCount ?? 0,
      })),
    ];

    return (
      <div className="container mx-auto px-4 py-4 sm:p-6 max-w-7xl space-y-6">
        <Breadcrumbs items={breadcrumbs} />

        <div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-2 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{course.name}</h1>
            <EntityFeedback entityType="course" entityId={course.id} initialData={feedbackData} />
            <ToggleActiveButton courseId={course.id} isActive={course.isActive} variant="header" />
            <EditCourseDialog course={{ id: course.id, name: course.name, description: course.description, color: course.color }} />
            {course.parentId === null && (
              <VisibilitySelect courseId={course.id} visibility={course.visibility} />
            )}
          </div>
          {course.description && (
            <p className="text-muted-foreground mt-2 ml-5">{course.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <CourseStudyButton courseId={course.id} publicId={publicId} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/courses/${publicId}/graph`}>
              <GitBranch className="mr-2 h-4 w-4" />
              Graph
            </Link>
          </Button>
          <CourseAddMenu courseId={course.id} />
        </div>

        {treeItems.length > 0 ? (
          <CourseSplitLayout items={treeItems} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              This course is empty. Add sub-courses, link existing decks, or add learning steps to get started.
            </p>
          </div>
        )}

        <SessionHistory courseId={course.id} />
      </div>
    );
  }

  // Public view: read-only for non-owners

  return (
    <>
    <PublicHeader />
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-4xl space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/explore" className="hover:text-foreground">Explore</Link>
        {course.ancestors.map((a) => (
          <span key={a.publicId} className="flex items-center gap-2">
            <span>/</span>
            <Link href={`/courses/${a.publicId}`} className="hover:text-foreground">{a.name}</Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-foreground truncate">{course.name}</span>
      </nav>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-2 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{course.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-2 ml-5">
          by {course.authorName}
        </p>
        {course.description && (
          <p className="text-muted-foreground mt-2 ml-5">{course.description}</p>
        )}
        {course.forkedFromName && (
          <p className="text-sm text-muted-foreground mt-1 ml-5 italic">
            Forked from {course.forkedFromName}
            {course.forkedFromAuthorName && ` by ${course.forkedFromAuthorName}`}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-wrap gap-3">
        {course.isAuthenticated ? (
          course.canFork && (
            <ForkCourseButton publicId={publicId} />
          )
        ) : (
          <Button asChild>
            <Link href="/register">
              <UserPlus className="mr-2 h-4 w-4" />
              Sign up to start learning
            </Link>
          </Button>
        )}
      </div>

      {/* Course content list */}
      {(course.children.length > 0 || course.steps.length > 0 || course.decks.length > 0) ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Course Content</h2>

          <div className="border rounded-[10px] divide-y">
            {/* Sub-courses */}
            {course.children.map(child => (
              <Link
                key={child.id}
                href={`/courses/${child.publicId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--card-hover)] transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{child.name}</div>
                  {child.description && (
                    <div className="text-xs text-muted-foreground truncate">{child.description}</div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{child.totalDecks} deck{child.totalDecks !== 1 ? "s" : ""}</span>
              </Link>
            ))}

            {/* Steps */}
            {course.steps.map(step => {
              const Icon = step.stepType === "material" ? BookOpen : Brain;
              const title = step.materialTitle ?? step.quizTitle ?? "Untitled";
              const quizInfo = !course.isOwner && step.quizId && course.quizInfo?.[step.quizId];
              const href = step.materialId ? `/materials/${step.materialId}` : step.quizId ? `/quizzes/${step.quizId}` : null;
              const Wrapper = href ? Link : "div" as any;
              return (
                <Wrapper key={step.id} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--card-hover)] transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Icon className={`h-4 w-4 ${step.stepType === "material" ? "text-blue-400" : "text-orange-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{title}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {step.stepType}
                      {quizInfo && ` \u00b7 ${quizInfo.questionCount} question${quizInfo.questionCount !== 1 ? "s" : ""}`}
                    </div>
                  </div>
                </Wrapper>
              );
            })}

            {/* Decks */}
            {course.decks.map(deck => (
              <Link key={deck.deckId} href={`/decks/${deck.deckId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--card-hover)] transition-colors">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{deck.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {deck.flashcardCount} card{deck.flashcardCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            This course has no content yet.
          </p>
        </div>
      )}
    </div>
    </>
  );
}
