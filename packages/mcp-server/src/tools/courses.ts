import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  type AppDatabase,
  courses,
  courseDecks,
  courseSteps,
  stepProgress,
  materials,
  quizzes,
  decks,
  writeTransaction,
} from "@flashcards/database";
import {
  checkCircularReference,
  getAncestorDepth,
  getDescendantCourseIds,
  getNextPosition,
  getNextDeckPosition,
  getNextStepPosition,
} from "@flashcards/database/courses";
import { emitEvent } from "@flashcards/database/events";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function registerCourseTools(server: McpServer, db: AppDatabase, userId: number) {
  // ── 1. create_course ─────────────────────────────────────────────────
  server.tool(
    "create_course",
    "Create a new course (optionally nested under a parent)",
    {
      name: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      color: z.string().regex(HEX_COLOR, "Must be a hex color like #a1b2c3").optional(),
      parentId: z.number().int().positive().optional(),
    },
    async ({ name, description, color, parentId }) => {
      try {
        // Validate parent exists and belongs to user
        if (parentId !== undefined) {
          const parent = db
            .select({ id: courses.id })
            .from(courses)
            .where(and(eq(courses.id, parentId), eq(courses.userId, userId)))
            .get();
          if (!parent) {
            return {
              content: [{ type: "text" as const, text: `Parent course ${parentId} not found` }],
              isError: true,
            };
          }
        }

        // Validate depth
        const parentDepth = getAncestorDepth(db, parentId ?? null, userId);
        if (parentDepth >= 10) {
          return {
            content: [{ type: "text" as const, text: "Nesting depth exceeds maximum of 10 levels" }],
            isError: true,
          };
        }

        const position = getNextPosition(db, parentId ?? null, userId);

        const [course] = writeTransaction(db, () =>
          db
            .insert(courses)
            .values({
              name,
              description: description ?? "",
              color: color ?? "#6366f1",
              parentId: parentId ?? null,
              position,
              userId,
            })
            .returning()
            .all()
        );

        emitEvent(db, userId, "course.created", { courseId: course.id });
        return { content: [{ type: "text" as const, text: JSON.stringify(course, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 2. list_courses ──────────────────────────────────────────────────
  server.tool(
    "list_courses",
    "List courses — top-level by default, or children of a parent",
    {
      parentId: z.number().int().positive().optional(),
    },
    async ({ parentId }) => {
      const condition =
        parentId !== undefined
          ? and(eq(courses.parentId, parentId), eq(courses.userId, userId))
          : and(isNull(courses.parentId), eq(courses.userId, userId));

      const result = db
        .select({
          id: courses.id,
          parentId: courses.parentId,
          name: courses.name,
          description: courses.description,
          color: courses.color,
          position: courses.position,
          childCount: sql<number>`(SELECT COUNT(*) FROM course WHERE parent_id = ${courses.id})`,
          deckCount: sql<number>`(SELECT COUNT(*) FROM course_deck WHERE course_id = ${courses.id})`,
          createdAt: courses.createdAt,
        })
        .from(courses)
        .where(condition)
        .orderBy(courses.position, courses.name)
        .all();

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── 3. get_course ────────────────────────────────────────────────────
  server.tool(
    "get_course",
    "Get course details including children and linked decks",
    {
      courseId: z.number().int().positive(),
    },
    async ({ courseId }) => {
      const course = db
        .select()
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
        .get();

      if (!course) {
        return {
          content: [{ type: "text" as const, text: `Course ${courseId} not found` }],
          isError: true,
        };
      }

      const children = db
        .select()
        .from(courses)
        .where(eq(courses.parentId, courseId))
        .orderBy(courses.position, courses.name)
        .all();

      const linkedDecks = db
        .select({
          deckId: decks.id,
          name: decks.name,
          description: decks.description,
          position: courseDecks.position,
        })
        .from(courseDecks)
        .innerJoin(decks, eq(courseDecks.deckId, decks.id))
        .where(eq(courseDecks.courseId, courseId))
        .orderBy(courseDecks.position)
        .all();

      const result = { ...course, children, decks: linkedDecks };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── 4. update_course ─────────────────────────────────────────────────
  server.tool(
    "update_course",
    "Update a course's name, description, or color",
    {
      courseId: z.number().int().positive(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      color: z.string().regex(HEX_COLOR, "Must be a hex color like #a1b2c3").optional(),
    },
    async ({ courseId, name, description, color }) => {
      const existing = db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
        .get();

      if (!existing) {
        return {
          content: [{ type: "text" as const, text: `Course ${courseId} not found` }],
          isError: true,
        };
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;

      if (Object.keys(updates).length === 0) {
        return {
          content: [{ type: "text" as const, text: "No fields to update" }],
          isError: true,
        };
      }

      const [updated] = writeTransaction(db, () =>
        db.update(courses).set(updates).where(and(eq(courses.id, courseId), eq(courses.userId, userId))).returning().all()
      );

      emitEvent(db, userId, "course.updated", { courseId });
      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    }
  );

  // ── 5. delete_course ─────────────────────────────────────────────────
  server.tool(
    "delete_course",
    "Delete a course and all descendants. Without confirm=true, returns a preview of what would be deleted.",
    {
      courseId: z.number().int().positive(),
      confirm: z.boolean().optional(),
    },
    async ({ courseId, confirm }) => {
      const existing = db
        .select({ id: courses.id, name: courses.name })
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
        .get();

      if (!existing) {
        return {
          content: [{ type: "text" as const, text: `Course ${courseId} not found` }],
          isError: true,
        };
      }

      const descendantIds = getDescendantCourseIds(db, courseId, userId);

      // Count deck links across all descendants
      const deckLinkRows = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(courseDecks)
        .where(sql`course_id IN (${sql.join(descendantIds.map((id) => sql`${id}`), sql`, `)})`)
        .get();
      const deckLinkCount = deckLinkRows?.count ?? 0;

      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "This will delete the following. Pass confirm=true to proceed.",
                  courseName: existing.name,
                  descendantCourseCount: descendantIds.length,
                  deckLinksToRemove: deckLinkCount,
                  courseIds: descendantIds,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Bottom-up deletion (descendantIds are deepest-first)
      writeTransaction(db, () => {
        for (const id of descendantIds) {
          db.delete(courseDecks).where(eq(courseDecks.courseId, id)).run();
          db.delete(courses).where(eq(courses.id, id)).run();
        }
      });

      for (const id of descendantIds) {
        emitEvent(db, userId, "course.deleted", { courseId: id });
      }

      console.log(
        `[MCP] Deleted course "${existing.name}" (id=${courseId}) and ${descendantIds.length - 1} descendant(s), ${deckLinkCount} deck link(s)`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                deleted: true,
                coursesRemoved: descendantIds.length,
                deckLinksRemoved: deckLinkCount,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── 6. add_deck_to_course ────────────────────────────────────────────
  server.tool(
    "add_deck_to_course",
    "Link a deck to a course",
    {
      courseId: z.number().int().positive(),
      deckId: z.number().int().positive(),
      position: z.number().int().nonnegative().optional(),
    },
    async ({ courseId, deckId, position }) => {
      // Validate course exists and belongs to user
      const course = db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
        .get();
      if (!course) {
        return {
          content: [{ type: "text" as const, text: `Course ${courseId} not found` }],
          isError: true,
        };
      }

      // Validate deck exists and belongs to user
      const deck = db
        .select({ id: decks.id })
        .from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
        .get();
      if (!deck) {
        return {
          content: [{ type: "text" as const, text: `Deck ${deckId} not found` }],
          isError: true,
        };
      }

      const pos = position ?? getNextDeckPosition(db, courseId);

      try {
        const [link] = writeTransaction(db, () =>
          db
            .insert(courseDecks)
            .values({ courseId, deckId, position: pos })
            .returning()
            .all()
        );
        emitEvent(db, userId, "course.updated", { courseId, deckId });
        return { content: [{ type: "text" as const, text: JSON.stringify(link, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Likely a unique constraint violation (deck already linked)
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 7. remove_deck_from_course ───────────────────────────────────────
  server.tool(
    "remove_deck_from_course",
    "Remove a deck from a course (unlink, does not delete the deck)",
    {
      courseId: z.number().int().positive(),
      deckId: z.number().int().positive(),
    },
    async ({ courseId, deckId }) => {
      // Verify course belongs to user
      const course = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
      if (!course) {
        return { content: [{ type: "text" as const, text: `Course ${courseId} not found` }], isError: true };
      }

      const deleted = writeTransaction(db, () =>
        db
          .delete(courseDecks)
          .where(
            sql`${courseDecks.courseId} = ${courseId} AND ${courseDecks.deckId} = ${deckId}`
          )
          .returning()
          .all()
      );

      if (deleted.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No link found between course ${courseId} and deck ${deckId}`,
            },
          ],
          isError: true,
        };
      }

      emitEvent(db, userId, "course.updated", { courseId, deckId });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ removed: true, courseId, deckId }) },
        ],
      };
    }
  );

  // ── 8. move_course ───────────────────────────────────────────────────
  server.tool(
    "move_course",
    "Move a course to a new parent (or top-level with newParentId=null)",
    {
      courseId: z.number().int().positive(),
      newParentId: z.number().int().positive().nullable(),
    },
    async ({ courseId, newParentId }) => {
      // Validate course exists and belongs to user
      const course = db
        .select({ id: courses.id, parentId: courses.parentId })
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
        .get();

      if (!course) {
        return {
          content: [{ type: "text" as const, text: `Course ${courseId} not found` }],
          isError: true,
        };
      }

      // Validate new parent exists and belongs to user (if not null)
      if (newParentId !== null) {
        const parent = db
          .select({ id: courses.id })
          .from(courses)
          .where(and(eq(courses.id, newParentId), eq(courses.userId, userId)))
          .get();
        if (!parent) {
          return {
            content: [{ type: "text" as const, text: `Parent course ${newParentId} not found` }],
            isError: true,
          };
        }

        // Check circular reference
        if (checkCircularReference(db, courseId, newParentId, userId)) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Cannot move: would create a circular reference",
              },
            ],
            isError: true,
          };
        }
      }

      // Validate depth after move
      const newDepth = getAncestorDepth(db, newParentId, userId);
      if (newDepth >= 10) {
        return {
          content: [
            { type: "text" as const, text: "Cannot move: would exceed maximum nesting depth of 10" },
          ],
          isError: true,
        };
      }

      const position = getNextPosition(db, newParentId, userId);

      const [updated] = writeTransaction(db, () =>
        db
          .update(courses)
          .set({ parentId: newParentId, position })
          .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
          .returning()
          .all()
      );

      emitEvent(db, userId, "course.moved", { courseId, newParentId });
      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    }
  );

  // ── 9. get_course_journey ─────────────────────────────────────────────
  server.tool(
    "get_course_journey",
    "Get the ordered learning journey steps for a course with completion status",
    {
      courseId: z.number().int().positive(),
    },
    async ({ courseId }) => {
      const course = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
      if (!course) {
        return { content: [{ type: "text" as const, text: `Course ${courseId} not found` }], isError: true };
      }

      const steps = db.all<{
        id: number;
        position: number;
        step_type: string;
        material_id: number | null;
        quiz_id: number | null;
        title: string;
        is_completed: number | null;
        completed_at: number | null;
      }>(sql`
        SELECT
          cs.id,
          cs.position,
          cs.step_type,
          cs.material_id,
          cs.quiz_id,
          COALESCE(m.title, q.title) AS title,
          sp.is_completed,
          sp.completed_at
        FROM course_step cs
        LEFT JOIN material m ON cs.material_id = m.id
        LEFT JOIN quiz q ON cs.quiz_id = q.id
        LEFT JOIN step_progress sp ON sp.course_step_id = cs.id AND sp.user_id = ${userId}
        WHERE cs.course_id = ${courseId}
        ORDER BY cs.position
      `);

      const result = steps.map(s => ({
        id: s.id,
        position: s.position,
        stepType: s.step_type,
        materialId: s.material_id,
        quizId: s.quiz_id,
        title: s.title,
        isCompleted: !!s.is_completed,
        completedAt: s.completed_at ? new Date(s.completed_at * 1000).toISOString() : null,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── 10. reorder_course_steps ──────────────────────────────────────────
  server.tool(
    "reorder_course_steps",
    "Reorder learning journey steps within a course",
    {
      courseId: z.number().int().positive(),
      stepIds: z.array(z.number().int().positive()).min(1),
    },
    async ({ courseId, stepIds }) => {
      const course = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
      if (!course) {
        return { content: [{ type: "text" as const, text: `Course ${courseId} not found` }], isError: true };
      }

      const existingSteps = db.select({ id: courseSteps.id })
        .from(courseSteps)
        .where(eq(courseSteps.courseId, courseId))
        .all();

      if (existingSteps.length !== stepIds.length) {
        return { content: [{ type: "text" as const, text: "Step count mismatch" }], isError: true };
      }

      const existingIds = new Set(existingSteps.map(s => s.id));
      for (const stepId of stepIds) {
        if (!existingIds.has(stepId)) {
          return { content: [{ type: "text" as const, text: `Step ${stepId} does not belong to course ${courseId}` }], isError: true };
        }
      }

      writeTransaction(db, () => {
        for (let i = 0; i < stepIds.length; i++) {
          db.update(courseSteps)
            .set({ position: i })
            .where(eq(courseSteps.id, stepIds[i]))
            .run();
        }
      });

      emitEvent(db, userId, "course.updated", { courseId });
      return { content: [{ type: "text" as const, text: JSON.stringify({ reordered: true, courseId, stepCount: stepIds.length }) }] };
    }
  );

  // ── 11. toggle_step_complete ──────────────────────────────────────────
  server.tool(
    "toggle_step_complete",
    "Mark a learning journey step as complete or incomplete",
    {
      stepId: z.number().int().positive(),
      completed: z.boolean(),
    },
    async ({ stepId, completed }) => {
      const step = db.select({ id: courseSteps.id })
        .from(courseSteps)
        .innerJoin(courses, eq(courseSteps.courseId, courses.id))
        .where(and(eq(courseSteps.id, stepId), eq(courses.userId, userId)))
        .get();
      if (!step) {
        return { content: [{ type: "text" as const, text: `Step ${stepId} not found` }], isError: true };
      }

      writeTransaction(db, () => {
        const existing = db.select({ id: stepProgress.id })
          .from(stepProgress)
          .where(and(
            eq(stepProgress.courseStepId, stepId),
            eq(stepProgress.userId, userId),
          )).get();

        if (existing) {
          db.update(stepProgress)
            .set({
              isCompleted: completed,
              completedAt: completed ? new Date() : null,
            })
            .where(eq(stepProgress.id, existing.id))
            .run();
        } else {
          db.insert(stepProgress).values({
            courseStepId: stepId,
            userId,
            isCompleted: completed,
            completedAt: completed ? new Date() : null,
          }).run();
        }
      });

      emitEvent(db, userId, "course.updated", { stepId, completed });
      return { content: [{ type: "text" as const, text: JSON.stringify({ stepId, completed }) }] };
    }
  );
}
