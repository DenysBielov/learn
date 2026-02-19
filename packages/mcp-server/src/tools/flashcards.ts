import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import {
  type AppDatabase, decks, flashcards, flashcardTags, tags,
  writeTransaction,
} from "@flashcards/database";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";

export function registerFlashcardTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_flashcards",
    "Batch-create flashcards in a deck. Content supports Markdown (**bold**, *italic*, `code`, lists, tables), LaTeX math ($inline$ and $$block$$ delimiters), and images (upload via upload_image tool first, then embed as ![alt](/api/images/filename)).",
    {
      deckId: z.number().int().positive(),
      cards: z.array(z.object({
        front: z.string().min(1).max(10240).describe("Front of the card. Supports Markdown and LaTeX math ($..$ inline, $$...$$ block)."),
        back: z.string().min(1).max(10240).describe("Back of the card. Supports Markdown and LaTeX math ($..$ inline, $$...$$ block)."),
      })).min(1).max(100),
    },
    async ({ deckId, cards }) => {
      const deck = db.select({ id: decks.id }).from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
      if (!deck) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }
      const created = writeTransaction(db, () =>
        db.insert(flashcards)
          .values(cards.map(c => ({
            deckId,
            front: sanitizeMarkdownImageUrls(c.front),
            back: sanitizeMarkdownImageUrls(c.back),
          })))
          .returning()
          .all()
      );
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
}
