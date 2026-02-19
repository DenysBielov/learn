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
}
