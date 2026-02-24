import { getCourseJourney, getCourse } from "@/app/actions/courses";
import { CourseGraph } from "@/components/course-graph";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@flashcards/database";
import { learningDependencies } from "@flashcards/database/schema";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const metadata = {
  title: "Dependency Graph — Flashcards",
};

export default async function GraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  await requireAuth();

  const [course, journey] = await Promise.all([
    getCourse(courseId),
    getCourseJourney(courseId).catch(() => []),
  ]);

  if (!course) notFound();

  // Fetch dependencies for this course's steps
  const db = getDb();
  const deps = db.select().from(learningDependencies)
    .where(sql`
      (${learningDependencies.materialItemId} IN (
        SELECT material_id FROM course_step WHERE course_id = ${courseId} AND material_id IS NOT NULL
      )) OR
      (${learningDependencies.courseItemId} IN (
        SELECT id FROM course WHERE parent_id = ${courseId}
      ))
    `)
    .all();

  // Map dependencies to step edges
  const edges: Array<{ fromStepId: number; toStepId: number }> = [];

  for (const dep of deps) {
    // Find the step that IS the dependent item
    const toStep = journey.find(s => {
      if (dep.materialItemId && s.stepType === "material") return s.materialId === dep.materialItemId;
      return false;
    });
    // Find the step that is the prerequisite
    const fromStep = journey.find(s => {
      if (dep.dependsOnMaterialId && s.stepType === "material") return s.materialId === dep.dependsOnMaterialId;
      return false;
    });

    if (toStep && fromStep) {
      edges.push({ fromStepId: fromStep.id, toStepId: toStep.id });
    }
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {course.name}
        </Link>
        <h1 className="text-xl font-bold">Dependency Graph</h1>
      </div>

      <CourseGraph steps={journey} edges={edges} />
    </div>
  );
}
