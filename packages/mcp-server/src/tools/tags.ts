import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase, tags, flashcardTags, questionTags, decks, flashcards, quizQuestions, writeTransaction,
} from "@flashcards/database";

export function registerTagTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_tags",
    "Create one or more tags",
    {
      tags: z.array(z.object({
        name: z.string().min(1).max(100),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })).min(1).max(20),
    },
    async ({ tags: tagInputs }) => {
      const created = writeTransaction(db, () =>
        db.insert(tags)
          .values(tagInputs.map(t => ({ name: t.name, color: t.color ?? "#6366f1", userId })))
          .returning()
          .all()
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool("list_tags", "List all tags", {}, async () => {
    const result = db.select().from(tags).where(eq(tags.userId, userId)).all();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "tag_items",
    "Apply tags to existing flashcards or questions",
    {
      tagIds: z.array(z.number().int().positive()).min(1),
      flashcardIds: z.array(z.number().int().positive()).optional(),
      questionIds: z.array(z.number().int().positive()).optional(),
    },
    async ({ tagIds, flashcardIds, questionIds }) => {
      // Verify tag ownership
      for (const tId of tagIds) {
        const tag = db.select({ id: tags.id }).from(tags)
          .where(and(eq(tags.id, tId), eq(tags.userId, userId))).get();
        if (!tag) return { content: [{ type: "text" as const, text: `Tag ${tId} not found` }], isError: true };
      }
      // Verify flashcard ownership (via deck)
      if (flashcardIds) {
        for (const fId of flashcardIds) {
          const card = db.select({ id: flashcards.id }).from(flashcards)
            .innerJoin(decks, eq(flashcards.deckId, decks.id))
            .where(and(eq(flashcards.id, fId), eq(decks.userId, userId))).get();
          if (!card) return { content: [{ type: "text" as const, text: `Flashcard ${fId} not found` }], isError: true };
        }
      }
      // Verify question ownership (via deck)
      if (questionIds) {
        for (const qId of questionIds) {
          const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
            .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
            .where(and(eq(quizQuestions.id, qId), eq(decks.userId, userId))).get();
          if (!q) return { content: [{ type: "text" as const, text: `Question ${qId} not found` }], isError: true };
        }
      }

      writeTransaction(db, () => {
        if (flashcardIds) {
          for (const fId of flashcardIds) {
            for (const tId of tagIds) {
              db.insert(flashcardTags).values({ flashcardId: fId, tagId: tId }).onConflictDoNothing().run();
            }
          }
        }
        if (questionIds) {
          for (const qId of questionIds) {
            for (const tId of tagIds) {
              db.insert(questionTags).values({ questionId: qId, tagId: tId }).onConflictDoNothing().run();
            }
          }
        }
      });
      return { content: [{ type: "text" as const, text: "Tags applied successfully" }] };
    }
  );

  server.tool(
    "update_tag",
    "Update a tag's name or color",
    {
      tagId: z.number().int().positive(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    },
    async ({ tagId, name, color }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }], isError: true };
      }
      try {
        const updated = writeTransaction(db, () =>
          db.update(tags).set(updates).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).returning().all()
        );
        if (updated.length === 0) {
          return { content: [{ type: "text" as const, text: `Tag ${tagId} not found` }], isError: true };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(updated[0], null, 2) }] };
      } catch (err) {
        if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
          return { content: [{ type: "text" as const, text: `Tag name "${name}" already exists` }], isError: true };
        }
        throw err;
      }
    }
  );

  server.tool(
    "delete_tags",
    "Delete tags by IDs. Only removes tags and their associations (flashcard_tag, question_tag).",
    {
      tagIds: z.array(z.number().int().positive()).min(1).max(50),
    },
    async ({ tagIds }) => {
      const uniqueIds = [...new Set(tagIds)];
      const owned = db.select({ id: tags.id }).from(tags).where(sql`${tags.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND ${tags.userId} = ${userId}`).all();
      if (owned.length !== uniqueIds.length) {
        return { content: [{ type: "text" as const, text: "One or more tags not found or not owned by you" }], isError: true };
      }
      const deleted = writeTransaction(db, () =>
        db.delete(tags).where(sql`${tags.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND ${tags.userId} = ${userId}`).returning().all()
      );
      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, count: deleted.length }, null, 2) }] };
    }
  );
}
