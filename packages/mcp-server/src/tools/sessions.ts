import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  type AppDatabase,
  studySessions,
  courses,
  materials,
  decks,
  quizzes,
  flashcardResults,
  quizResults,
  writeTransaction,
} from "@flashcards/database";
import { emitEvent } from "@flashcards/database/events";

export function registerSessionTools(server: McpServer, db: AppDatabase, userId: number) {
  // ── 1. create_study_session ─────────────────────────────────────────
  server.tool(
    "create_study_session",
    "Create a new study session for flashcards, quiz, or reading",
    {
      courseId: z.number().int().positive().optional(),
      deckId: z.number().int().positive().optional(),
      quizId: z.number().int().positive().optional(),
      mode: z.enum(["flashcard", "quiz", "reading"]),
      subMode: z.string().max(100).optional(),
    },
    async ({ courseId, deckId, quizId, mode, subMode }) => {
      try {
        // Validate ownership of referenced entities
        if (courseId !== undefined) {
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
        }

        if (deckId !== undefined) {
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
        }

        if (quizId !== undefined) {
          const quiz = db
            .select({ id: quizzes.id })
            .from(quizzes)
            .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
            .get();
          if (!quiz) {
            return {
              content: [{ type: "text" as const, text: `Quiz ${quizId} not found` }],
              isError: true,
            };
          }
        }

        const [session] = writeTransaction(db, () =>
          db
            .insert(studySessions)
            .values({
              userId,
              courseId: courseId ?? null,
              deckId: deckId ?? null,
              quizId: quizId ?? null,
              mode,
              subMode: subMode ?? null,
            })
            .returning()
            .all()
        );

        emitEvent(db, userId, "session.created", { sessionId: session.id, mode });
        return { content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 2. create_reading_session ───────────────────────────────────────
  server.tool(
    "create_reading_session",
    "Create a study session for reading a material",
    {
      materialId: z.number().int().positive(),
    },
    async ({ materialId }) => {
      try {
        const material = db
          .select({ id: materials.id })
          .from(materials)
          .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
          .get();
        if (!material) {
          return {
            content: [{ type: "text" as const, text: `Material ${materialId} not found` }],
            isError: true,
          };
        }

        const [session] = writeTransaction(db, () =>
          db
            .insert(studySessions)
            .values({
              userId,
              materialId,
              mode: "reading",
            })
            .returning()
            .all()
        );

        emitEvent(db, userId, "session.created", { sessionId: session.id, mode: "reading", materialId });
        return { content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 3. get_study_session ────────────────────────────────────────────
  server.tool(
    "get_study_session",
    "Get study session details including result counts",
    {
      sessionId: z.number().int().positive(),
    },
    async ({ sessionId }) => {
      try {
        const session = db
          .select()
          .from(studySessions)
          .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
          .get();

        if (!session) {
          return {
            content: [{ type: "text" as const, text: `Session ${sessionId} not found` }],
            isError: true,
          };
        }

        const fcResults = db
          .select({ count: sql<number>`COUNT(*)` })
          .from(flashcardResults)
          .where(eq(flashcardResults.sessionId, sessionId))
          .get();

        const qResults = db
          .select({ count: sql<number>`COUNT(*)` })
          .from(quizResults)
          .where(eq(quizResults.sessionId, sessionId))
          .get();

        const result = {
          ...session,
          flashcardResultCount: fcResults?.count ?? 0,
          quizResultCount: qResults?.count ?? 0,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 4. update_session_notes ─────────────────────────────────────────
  server.tool(
    "update_session_notes",
    "Update the notes on a study session",
    {
      sessionId: z.number().int().positive(),
      notes: z.string().max(50000),
    },
    async ({ sessionId, notes }) => {
      try {
        const session = db
          .select({ id: studySessions.id })
          .from(studySessions)
          .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
          .get();

        if (!session) {
          return {
            content: [{ type: "text" as const, text: `Session ${sessionId} not found` }],
            isError: true,
          };
        }

        writeTransaction(db, () =>
          db
            .update(studySessions)
            .set({ notes })
            .where(eq(studySessions.id, sessionId))
            .run()
        );

        emitEvent(db, userId, "session.updated", { sessionId });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ updated: true, sessionId }) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 5. close_study_session ──────────────────────────────────────────
  server.tool(
    "close_study_session",
    "Close a study session by setting completedAt, optionally with a summary",
    {
      sessionId: z.number().int().positive(),
      summary: z.string().max(10000).optional(),
      completedAt: z.string().datetime().optional().describe("ISO 8601 timestamp for when the session ended. Must be after startedAt and not in the future. Defaults to now."),
    },
    async ({ sessionId, summary, completedAt }) => {
      try {
        const session = db
          .select({ id: studySessions.id, completedAt: studySessions.completedAt, startedAt: studySessions.startedAt })
          .from(studySessions)
          .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
          .get();

        if (!session) {
          return {
            content: [{ type: "text" as const, text: `Session ${sessionId} not found` }],
            isError: true,
          };
        }

        if (session.completedAt !== null) {
          return {
            content: [{ type: "text" as const, text: `Session ${sessionId} is already closed` }],
            isError: true,
          };
        }

        const endTime = completedAt ? new Date(completedAt) : new Date();

        if (completedAt) {
          if (endTime <= new Date(session.startedAt)) {
            return {
              content: [{ type: "text" as const, text: "End time must be after session start time" }],
              isError: true,
            };
          }
          if (endTime > new Date()) {
            return {
              content: [{ type: "text" as const, text: "End time cannot be in the future" }],
              isError: true,
            };
          }
        }

        const updates: Record<string, unknown> = {
          completedAt: endTime,
        };
        if (summary !== undefined) {
          updates.summary = summary;
        }

        const [updated] = writeTransaction(db, () =>
          db
            .update(studySessions)
            .set(updates)
            .where(eq(studySessions.id, sessionId))
            .returning()
            .all()
        );

        emitEvent(db, userId, "session.closed", { sessionId });
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );

  // ── 6. list_study_sessions ──────────────────────────────────────────
  server.tool(
    "list_study_sessions",
    "List recent study sessions, optionally filtered by course",
    {
      courseId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).default(10).optional(),
    },
    async ({ courseId, limit }) => {
      try {
        const take = limit ?? 10;

        const conditions = [eq(studySessions.userId, userId)];
        if (courseId !== undefined) {
          conditions.push(eq(studySessions.courseId, courseId));
        }

        const sessions = db
          .select()
          .from(studySessions)
          .where(and(...conditions))
          .orderBy(desc(studySessions.startedAt))
          .limit(take)
          .all();

        return { content: [{ type: "text" as const, text: JSON.stringify(sessions, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
    }
  );
}
