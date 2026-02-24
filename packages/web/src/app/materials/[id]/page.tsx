import { getMaterial } from "@/app/actions/materials";
import { MaterialTabs } from "@/components/material-tabs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
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

  function getStepUrl(step: { stepType: string; materialId: number | null; quizId: number | null }) {
    if (step.stepType === "material" && step.materialId) return `/materials/${step.materialId}`;
    if (step.stepType === "quiz" && step.quizId) return `/quizzes/${step.quizId}`;
    return "#";
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-4xl space-y-6">
      {/* Breadcrumbs */}
      {material.step && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href={`/courses/${material.step.courseId}`} className="hover:text-foreground">
            {material.step.courseName}
          </Link>
          <span>/</span>
          <span className="text-foreground">{material.title}</span>
        </nav>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-muted-foreground shrink-0" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{material.title}</h1>
      </div>

      {/* External URL */}
      {material.externalUrl && (
        <a
          href={material.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Open external resource
        </a>
      )}

      {/* Content with Tabs */}
      <MaterialTabs
        content={material.content}
        linkedDecks={material.linkedDecks}
        linkedQuizzes={material.linkedQuizzes}
      />

      {/* Completion & Navigation */}
      {material.step && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
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
    </div>
  );
}
