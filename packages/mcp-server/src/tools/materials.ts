import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase,
  materials,
  courses,
  courseSteps,
  writeTransaction,
} from "@flashcards/database";
import { getNextStepPosition } from "@flashcards/database/courses";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";

function validateUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL must use https or http protocol");
  }
}

export function registerMaterialTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_material",
    "Create a learning material in a course. Materials can have markdown content, an external URL, or both.",
    {
      courseId: z.number().int().positive(),
      title: z.string().min(1).max(200),
      content: z.string().max(100_000).optional().describe("Markdown content. Supports LaTeX math ($inline$ and $$block$$)."),
      externalUrl: z.string().max(2000).optional().describe("External URL (must be http or https)"),
    },
    async ({ courseId, title, content, externalUrl }) => {
      if (!content && !externalUrl) {
        return { content: [{ type: "text" as const, text: "Material must have content or an external URL" }], isError: true };
      }

      const course = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
      if (!course) {
        return { content: [{ type: "text" as const, text: `Course ${courseId} not found` }], isError: true };
      }

      if (externalUrl) {
        try { validateUrl(externalUrl); } catch {
          return { content: [{ type: "text" as const, text: "Invalid URL: must use http or https protocol" }], isError: true };
        }
      }

      const sanitizedContent = content ? sanitizeMarkdownImageUrls(content) : null;

      const [material] = writeTransaction(db, () => {
        const [created] = db.insert(materials).values({
          title,
          content: sanitizedContent,
          externalUrl: externalUrl ?? null,
          userId,
        }).returning().all();

        const position = getNextStepPosition(db, courseId);
        db.insert(courseSteps).values({
          courseId,
          position,
          stepType: "material",
          materialId: created.id,
        }).run();

        return [created];
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(material, null, 2) }] };
    }
  );

  server.tool(
    "update_material",
    "Update a learning material's title, content, or external URL",
    {
      materialId: z.number().int().positive(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().max(100_000).optional(),
      externalUrl: z.string().max(2000).optional(),
    },
    async ({ materialId, title, content, externalUrl }) => {
      const existing = db.select({ id: materials.id }).from(materials)
        .where(and(eq(materials.id, materialId), eq(materials.userId, userId))).get();
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Material ${materialId} not found` }], isError: true };
      }

      if (externalUrl) {
        try { validateUrl(externalUrl); } catch {
          return { content: [{ type: "text" as const, text: "Invalid URL: must use http or https protocol" }], isError: true };
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = sanitizeMarkdownImageUrls(content);
      if (externalUrl !== undefined) updates.externalUrl = externalUrl;

      if (Object.keys(updates).length === 1) {
        return { content: [{ type: "text" as const, text: "No fields to update" }], isError: true };
      }

      const [updated] = writeTransaction(db, () =>
        db.update(materials).set(updates).where(eq(materials.id, materialId)).returning().all()
      );

      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "delete_material",
    "Delete a learning material (course step removed via cascade)",
    {
      materialId: z.number().int().positive(),
    },
    async ({ materialId }) => {
      const existing = db.select({ id: materials.id }).from(materials)
        .where(and(eq(materials.id, materialId), eq(materials.userId, userId))).get();
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Material ${materialId} not found` }], isError: true };
      }

      writeTransaction(db, () =>
        db.delete(materials).where(eq(materials.id, materialId)).run()
      );

      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, materialId }) }] };
    }
  );

  server.tool(
    "list_materials",
    "List learning materials, optionally filtered by course",
    {
      courseId: z.number().int().positive().optional(),
    },
    async ({ courseId }) => {
      if (courseId) {
        const result = db.select({
          id: materials.id,
          title: materials.title,
          hasContent: sql<boolean>`${materials.content} IS NOT NULL`,
          externalUrl: materials.externalUrl,
          position: courseSteps.position,
          createdAt: materials.createdAt,
        })
          .from(materials)
          .innerJoin(courseSteps, eq(courseSteps.materialId, materials.id))
          .where(and(eq(courseSteps.courseId, courseId), eq(materials.userId, userId)))
          .orderBy(courseSteps.position)
          .all();
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }

      const result = db.select({
        id: materials.id,
        title: materials.title,
        hasContent: sql<boolean>`${materials.content} IS NOT NULL`,
        externalUrl: materials.externalUrl,
        createdAt: materials.createdAt,
      })
        .from(materials)
        .where(eq(materials.userId, userId))
        .all();

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
