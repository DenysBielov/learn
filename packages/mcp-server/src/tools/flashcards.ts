import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import {
  type AppDatabase, decks, flashcards, flashcardTags, tags, materials,
  writeTransaction,
} from "@flashcards/database";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";
import { emitEvent } from "@flashcards/database/events";

export function registerFlashcardTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_flashcards",
    "Batch-create flashcards in a deck. Content supports Markdown (**bold**, *italic*, `code`, lists, tables), LaTeX math ($inline$ and $$block$$ delimiters), and images (upload via upload_image tool first, then embed as ![alt](/api/images/filename)).\n\nCARD QUALITY RULES:\n- One concept per card — test exactly one thing. Break complex ideas into multiple cards.\n- Keep answers short — ideally one word or brief phrase.\n- Avoid yes/no questions — use direct questions or cloze format instead.\n- Include context cues — topic labels help when reviewing mixed decks.\n- Use precise wording — ambiguous questions cause unreliable self-grading.\n- Avoid enumerations — don't ask \"list all X\"; break into individual cards.\n\nRead the learning_content_guide resource for detailed flashcard creation principles.",
    {
      deckId: z.number().int().positive(),
      sourceMaterialId: z.number().int().positive().optional().describe("Optional ID of the source material these flashcards were generated from."),
      cards: z.array(z.object({
        front: z.string().min(1).max(10240).describe("Front of the card. Supports Markdown and LaTeX math ($..$ inline, $$...$$ block)."),
        back: z.string().min(1).max(10240).describe("Back of the card. Supports Markdown and LaTeX math ($..$ inline, $$...$$ block)."),
      })).min(1).max(100),
    },
    async ({ deckId, sourceMaterialId, cards }) => {
      const deck = db.select({ id: decks.id }).from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
      if (!deck) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }
      if (sourceMaterialId) {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, sourceMaterialId)).get();
        if (!material || material.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Source material not found or not owned by user" }], isError: true };
        }
      }
      const created = writeTransaction(db, () =>
        db.insert(flashcards)
          .values(cards.map(c => ({
            deckId,
            front: sanitizeMarkdownImageUrls(c.front),
            back: sanitizeMarkdownImageUrls(c.back),
            sourceMaterialId: sourceMaterialId ?? null,
          })))
          .returning()
          .all()
      );
      for (const card of created) {
        emitEvent(db, userId, "flashcard.created", { flashcardId: card.id, deckId });
      }
      return { content: [{ type: "text" as const, text: `Created ${created.length} flashcards in deck ${deckId}` }] };
    }
  );

  server.tool(
    "list_flashcards",
    "List flashcards, filterable by deck and/or tag",
    {
      deckId: z.number().int().positive().optional(),
      tagName: z.string().optional(),
    },
    async ({ deckId, tagName }) => {
      let query = db.select().from(flashcards).$dynamic();

      if (deckId) {
        const deck = db.select({ id: decks.id }).from(decks)
          .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
        if (!deck) return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
        query = query.where(eq(flashcards.deckId, deckId));
      } else {
        query = query.where(sql`${flashcards.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId})`);
      }

      const result = query.all();

      if (tagName) {
        const tag = db.select().from(tags).where(and(eq(tags.name, tagName), eq(tags.userId, userId))).get();
        if (!tag) return { content: [{ type: "text" as const, text: `Tag "${tagName}" not found` }], isError: true };

        const taggedIds = db.select({ flashcardId: flashcardTags.flashcardId })
          .from(flashcardTags)
          .where(eq(flashcardTags.tagId, tag.id))
          .all()
          .map(r => r.flashcardId);

        const filtered = result.filter(f => taggedIds.includes(f.id));
        return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_flashcard",
    "Update a flashcard's front or back content",
    {
      flashcardId: z.number().int().positive(),
      front: z.string().min(1).max(10240).optional(),
      back: z.string().min(1).max(10240).optional(),
    },
    async ({ flashcardId, front, back }) => {
      const card = db.select({ id: flashcards.id }).from(flashcards)
        .innerJoin(decks, eq(flashcards.deckId, decks.id))
        .where(and(eq(flashcards.id, flashcardId), eq(decks.userId, userId))).get();
      if (!card) {
        return { content: [{ type: "text" as const, text: `Flashcard ${flashcardId} not found` }], isError: true };
      }

      const updates: Record<string, string> = {};
      if (front !== undefined) updates.front = sanitizeMarkdownImageUrls(front);
      if (back !== undefined) updates.back = sanitizeMarkdownImageUrls(back);

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }], isError: true };
      }

      const updated = writeTransaction(db, () =>
        db.update(flashcards).set(updates).where(eq(flashcards.id, flashcardId)).returning().all()
      );
      emitEvent(db, userId, "flashcard.updated", { flashcardId });
      return { content: [{ type: "text" as const, text: JSON.stringify(updated[0], null, 2) }] };
    }
  );

  server.tool(
    "delete_flashcards",
    "Delete flashcards by IDs. Without confirm=true, returns a preview of what would be deleted.",
    {
      flashcardIds: z.array(z.number().int().positive()).min(1).max(100),
      confirm: z.boolean().optional(),
    },
    async ({ flashcardIds, confirm }) => {
      const uniqueIds = [...new Set(flashcardIds)];

      const owned = db.select({ id: flashcards.id }).from(flashcards)
        .innerJoin(decks, eq(flashcards.deckId, decks.id))
        .where(sql`${flashcards.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND ${decks.userId} = ${userId}`)
        .all();

      if (owned.length !== uniqueIds.length) {
        return { content: [{ type: "text" as const, text: "One or more flashcards not found or not owned by you" }], isError: true };
      }

      if (!confirm) {
        const flashcardCount = uniqueIds.length;
        const resultCount = (db.get(sql`SELECT COUNT(*) as count FROM flashcard_result WHERE flashcard_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`) as { count: number }).count;
        const conversationCount = (db.get(sql`SELECT COUNT(*) as count FROM chat_conversation WHERE flashcard_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`) as { count: number }).count;
        const flagCount = (db.get(sql`SELECT COUNT(*) as count FROM card_flag WHERE flashcard_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`) as { count: number }).count;
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              message: "This will delete the following. Pass confirm=true to proceed.",
              flashcardCount,
              flashcardResultCount: resultCount,
              chatConversationCount: conversationCount,
              cardFlagCount: flagCount,
            }, null, 2),
          }],
        };
      }

      const deleted = writeTransaction(db, () =>
        db.delete(flashcards)
          .where(sql`${flashcards.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND ${flashcards.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId})`)
          .returning()
          .all()
      );

      if (deleted.length !== uniqueIds.length) {
        return { content: [{ type: "text" as const, text: "Delete failed: count mismatch" }], isError: true };
      }

      for (const card of deleted) {
        emitEvent(db, userId, "flashcard.deleted", { flashcardId: card.id });
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, count: deleted.length }, null, 2) }] };
    }
  );
}
