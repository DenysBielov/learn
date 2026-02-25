import { getMaterial } from "@/app/actions/materials";
import { RichContent } from "@/components/rich-content";
import { MaterialPanel } from "@/components/material-panel";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { StepCompleteButton } from "@/components/step-complete-button";

interface MaterialPageProps {
  params: Promise<{ id: string }>;
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { id } = await params;
  const materialId = parseInt(id, 10);
  if (isNaN(materialId)) notFound();

  const material = await getMaterial(materialId);
  if (!material) notFound();

  function getStepUrl(step: {
    stepType: string;
    materialId: number | null;
    quizId: number | null;
  }) {
    if (step.stepType === "material" && step.materialId)
      return `/materials/${step.materialId}`;
    if (step.stepType === "quiz" && step.quizId) return `/quizzes/${step.quizId}`;
    return "#";
  }

  const leftContent = (
    <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 h-full overflow-y-auto">
      {/* Breadcrumbs */}
      {material.step && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/courses/${material.step.courseId}`}
            className="hover:text-foreground"
          >
            {material.step.courseName}
          </Link>
          <span>/</span>
          <span className="text-foreground">{material.title}</span>
        </nav>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-muted-foreground shrink-0" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {material.title}
        </h1>
      </div>

      {/* Completion & Navigation */}
      {material.step && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b">
          <StepCompleteButton
            stepId={material.step.id}
            isCompleted={material.step.isCompleted}
          />

          <div className="flex gap-3">
            {material.prevStep && (
              <Button variant="outline" asChild>
                <Link href={getStepUrl(material.prevStep)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Link>
              </Button>
            )}
            {material.nextStep && (
              <Button asChild>
                <Link href={getStepUrl(material.nextStep)}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {material.content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <RichContent content={material.content} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No content available</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: Resizable two-column layout */}
      <div
        className="hidden md:block"
        style={{ height: "calc(100vh - var(--nav-height, 56px))" }}
      >
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={65} minSize={40} maxSize={80}>
            {leftContent}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
            <MaterialPanel
              materialId={materialId}
              linkedDecks={material.linkedDecks}
              linkedQuizzes={material.linkedQuizzes}
              initialNotes={material.notes ?? null}
              externalUrl={material.externalUrl ?? null}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: single column + bottom sheet FAB */}
      <div className="md:hidden">
        <div className="px-4 py-4 space-y-6">
          {/* Breadcrumbs */}
          {material.step && (
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              <span>/</span>
              <Link
                href={`/courses/${material.step.courseId}`}
                className="hover:text-foreground"
              >
                {material.step.courseName}
              </Link>
              <span>/</span>
              <span className="text-foreground">{material.title}</span>
            </nav>
          )}

          {/* Header */}
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-muted-foreground shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight">{material.title}</h1>
          </div>

          {/* Completion & Navigation */}
          {material.step && (
            <div className="flex flex-col items-center justify-between gap-4 pb-4 border-b">
              <StepCompleteButton
                stepId={material.step.id}
                isCompleted={material.step.isCompleted}
              />
              <div className="flex gap-3">
                {material.prevStep && (
                  <Button variant="outline" asChild>
                    <Link href={getStepUrl(material.prevStep)}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Link>
                  </Button>
                )}
                {material.nextStep && (
                  <Button asChild>
                    <Link href={getStepUrl(material.nextStep)}>
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          {material.content ? (
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <RichContent content={material.content} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No content available</p>
          )}
        </div>

        {/* Mobile bottom sheet panel */}
        <MaterialPanel
          materialId={materialId}
          linkedDecks={material.linkedDecks}
          linkedQuizzes={material.linkedQuizzes}
          initialNotes={material.notes ?? null}
          externalUrl={material.externalUrl ?? null}
        />
      </div>
    </>
  );
}
