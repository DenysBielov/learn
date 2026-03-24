import { getMaterial } from "@/app/actions/materials";
import { MaterialContent } from "@/components/material-content";
import { MaterialPanel } from "@/components/material-panel";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { StepCompleteButton } from "@/components/step-complete-button";
import { getStepUrl } from "@/lib/route-utils";

interface MaterialPageProps {
  params: Promise<{ id: string }>;
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { id } = await params;
  const materialId = parseInt(id, 10);
  if (isNaN(materialId)) notFound();

  const material = await getMaterial(materialId);
  if (!material) notFound();

  const { isPublicView } = material;

  const materialContent = (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      {material.step && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={isPublicView ? "/explore" : "/dashboard"} className="hover:text-foreground">
            {isPublicView ? "Explore" : "Home"}
          </Link>
          <span>/</span>
          <Link href={`/courses/${material.step.coursePublicId}`} className="hover:text-foreground">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
          {!isPublicView && (
            <StepCompleteButton
              stepId={material.step.id}
              isCompleted={material.step.isCompleted}
            />
          )}
          <div className="flex gap-3">
            {material.prevStep && (
              <Button variant="outline" className="flex-1 sm:flex-initial" asChild>
                <Link href={getStepUrl(material.prevStep)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Link>
              </Button>
            )}
            {material.nextStep && (
              <Button className="flex-1 sm:flex-initial" asChild>
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
      <MaterialContent
        materialId={materialId}
        description={material.description ?? null}
        content={material.content ?? null}
        externalUrl={material.externalUrl ?? null}
        courseId={material.step?.courseId}
      />
    </div>
  );

  if (isPublicView) {
    return (
      <>
        <PublicHeader />
        <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6 max-w-4xl">
          {materialContent}
        </div>
      </>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--nav-height,56px))]">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6 max-w-4xl">
          {materialContent}
        </div>
      </div>
      <MaterialPanel
        materialId={materialId}
        linkedDecks={material.linkedDecks}
        linkedQuizzes={material.linkedQuizzes}
        resources={material.resources}
        initialNotes={material.notes ?? null}
        externalUrl={material.externalUrl ?? null}
      />
    </div>
  );
}
