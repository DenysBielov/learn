import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { type AppDatabase, decks, flashcards, quizQuestions, writeTransaction } from "@flashcards/database";

export function registerDeckTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_deck",
    "Create a new deck with name and description",
    { name: z.string().min(1).max(200), description: z.string().max(1000).optional() },
    async ({ name, description }) => {
      const [deck] = writeTransaction(db, () =>
        db.insert(decks).values({ name, description: description ?? "", userId }).returning().all()
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(deck, null, 2) }] };
    }
  );

  server.tool(
    "list_decks",
    "List all decks with flashcard and question counts",
    {},
    async () => {
      const result = db
        .select({
          id: decks.id,
          name: decks.name,
          description: decks.description,
          flashcardCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = "deck"."id")`,
          questionCount: sql<number>`(SELECT COUNT(*) FROM quiz_question WHERE quiz_question.deck_id = "deck"."id")`,
          createdAt: decks.createdAt,
        })
        .from(decks)
        .where(eq(decks.userId, userId))
        .all();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_deck",
    "Get deck details with its flashcards and questions",
    { deckId: z.number().int().positive() },
    async ({ deckId }) => {
      const deck = await db.query.decks.findFirst({
        where: and(eq(decks.id, deckId), eq(decks.userId, userId)),
        with: {
          flashcards: true,
          quizQuestions: { with: { options: true } },
        },
      });
      if (!deck) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(deck, null, 2) }] };
    }
  );
}
