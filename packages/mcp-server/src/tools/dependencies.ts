import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  type AppDatabase,
  learningDependencies,
  courses,
  materials,
  writeTransaction,
} from "@flashcards/database";
import {
  verifySiblingConstraint,
  wouldCreateCycle,
  getDependenciesForCourse,
} from "@flashcards/database/dependencies";
import { emitEvent } from "@flashcards/database/events";

export function registerDependencyTools(server: McpServer, db: AppDatabase, userId: number) {
  // ── 1. create_dependency ────────────────────────────────────────────
  server.tool(
    "create_dependency",
    "Create a learning dependency between two items (courses or materials) within the same parent course",
    {
      courseItemId: z.number().int().positive().optional().describe("Course ID of the item that depends on something"),
      materialItemId: z.number().int().positive().optional().describe("Material ID of the item that depends on something"),
      dependsOnCourseId: z.number().int().positive().optional().describe("Course ID of the prerequisite"),
      dependsOnMaterialId: z.number().int().positive().optional().describe("Material ID of the prerequisite"),
    },
    async ({ courseItemId, materialItemId, dependsOnCourseId, dependsOnMaterialId }) => {
      try {
        const item = { courseId: courseItemId, materialId: materialItemId };
        const dependsOn = { courseId: dependsOnCourseId, materialId: dependsOnMaterialId };

        // Validate XOR: exactly one of courseItemId or materialItemId
        if ((!item.courseId && !item.materialId) || (item.courseId && item.materialId)) {
          return { content: [{ type: "text" as const, text: "Exactly one of courseItemId or materialItemId required" }], isError: true };
        }
        if ((!dependsOn.courseId && !dependsOn.materialId) || (dependsOn.courseId && dependsOn.materialId)) {
          return { content: [{ type: "text" as const, text: "Exactly one of dependsOnCourseId or dependsOnMaterialId required" }], isError: true };
        }

        verifySiblingConstraint(db, item, dependsOn, userId);

        if (wouldCreateCycle(db, item, dependsOn)) {
          return { content: [{ type: "text" as const, text: "Adding this dependency would create a cycle" }], isError: true };
        }

        const [dep] = writeTransaction(db, () =>
          db.insert(learningDependencies).values({
            courseItemId: courseItemId ?? null,
            materialItemId: materialItemId ?? null,
            dependsOnCourseId: dependsOnCourseId ?? null,
            dependsOnMaterialId: dependsOnMaterialId ?? null,
          }).returning().all()
        );

        emitEvent(db, userId, "dependency.created", { dependencyId: dep.id });
        return { content: [{ type: "text" as const, text: JSON.stringify(dep, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: error.message }], isError: true };
      }
    }
  );

  // ── 2. delete_dependency ────────────────────────────────────────────
  server.tool(
    "delete_dependency",
    "Delete a learning dependency by ID",
    {
      dependencyId: z.number().int().positive(),
    },
    async ({ dependencyId }) => {
      try {
        const dep = db.select().from(learningDependencies).where(eq(learningDependencies.id, dependencyId)).get();
        if (!dep) {
          return { content: [{ type: "text" as const, text: "Dependency not found" }], isError: true };
        }

        // Verify ownership via FK chain
        let authorized = false;
        if (dep.courseItemId) {
          const course = db.select({ id: courses.id }).from(courses)
            .where(and(eq(courses.id, dep.courseItemId), eq(courses.userId, userId))).get();
          if (course) authorized = true;
        }
        if (!authorized && dep.materialItemId) {
          const material = db.select({ id: materials.id }).from(materials)
            .where(and(eq(materials.id, dep.materialItemId), eq(materials.userId, userId))).get();
          if (material) authorized = true;
        }
        if (!authorized) {
          return { content: [{ type: "text" as const, text: "Not authorized" }], isError: true };
        }

        writeTransaction(db, () =>
          db.delete(learningDependencies).where(eq(learningDependencies.id, dependencyId)).run()
        );

        emitEvent(db, userId, "dependency.deleted", { dependencyId });
        return { content: [{ type: "text" as const, text: `Deleted dependency ${dependencyId}` }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: error.message }], isError: true };
      }
    }
  );

  // ── 3. list_dependencies ────────────────────────────────────────────
  server.tool(
    "list_dependencies",
    "List all learning dependencies for items within a course",
    {
      courseId: z.number().int().positive(),
    },
    async ({ courseId }) => {
      try {
        const deps = getDependenciesForCourse(db, courseId, userId);
        return { content: [{ type: "text" as const, text: JSON.stringify(deps, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: error.message }], isError: true };
      }
    }
  );
}
