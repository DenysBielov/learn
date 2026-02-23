import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { type AppDatabase, decks, flashcards, quizQuestions, writeTransaction } from "@flashcards/database";
import { emitEvent } from "@flashcards/database/events";

export function registerDeckTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_deck",
    "Create a new deck with name and description",
    { name: z.string().min(1).max(200), description: z.string().max(1000).optional() },
    async ({ name, description }) => {
      const [deck] = writeTransaction(db, () =>
        db.insert(decks).values({ name, description: description ?? "", userId }).returning().all()
      );
      emitEvent(db, userId, "deck.created", { deckId: deck.id });
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

  server.tool(
    "update_deck",
    "Update a deck's name or description",
    { deckId: z.number().int().positive(), name: z.string().min(1).max(200).optional(), description: z.string().max(1000).optional() },
    async ({ deckId, name, description }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "Nothing to update. Provide at least one of: name, description" }], isError: true };
      }
      updates.updatedAt = new Date();
      const [deck] = writeTransaction(db, () =>
        db.update(decks).set(updates).where(and(eq(decks.id, deckId), eq(decks.userId, userId))).returning().all()
      );
      if (!deck) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }
      emitEvent(db, userId, "deck.updated", { deckId: deck.id });
      return { content: [{ type: "text" as const, text: JSON.stringify(deck, null, 2) }] };
    }
  );

  server.tool(
    "delete_deck",
    "Delete a deck and all its content. Without confirm=true, returns a preview of what would be deleted.",
    { deckId: z.number().int().positive(), confirm: z.boolean().optional() },
    async ({ deckId, confirm }) => {
      const deck = db.select({ id: decks.id }).from(decks).where(and(eq(decks.id, deckId), eq(decks.userId, userId))).all();
      if (deck.length === 0) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }
      if (!confirm) {
        const result = {
          message: "This will delete the following. Pass confirm=true to proceed.",
          flashcards: db.select({ count: sql<number>`COUNT(*)` }).from(flashcards).where(eq(flashcards.deckId, deckId)).all()[0]?.count ?? 0,
          questions: db.select({ count: sql<number>`COUNT(*)` }).from(quizQuestions).where(eq(quizQuestions.deckId, deckId)).all()[0]?.count ?? 0,
          studySessions: db.select({ count: sql<number>`(SELECT COUNT(*) FROM study_session WHERE deck_id = ${deckId})` }).from(decks).where(eq(decks.id, deckId)).all()[0]?.count ?? 0,
          courseDeckLinks: db.select({ count: sql<number>`(SELECT COUNT(*) FROM course_deck WHERE deck_id = ${deckId})` }).from(decks).where(eq(decks.id, deckId)).all()[0]?.count ?? 0,
          flashcardResults: db.select({ count: sql<number>`(SELECT COUNT(*) FROM flashcard_result WHERE flashcard_id IN (SELECT id FROM flashcard WHERE deck_id = ${deckId}))` }).from(decks).where(eq(decks.id, deckId)).all()[0]?.count ?? 0,
          quizResults: db.select({ count: sql<number>`(SELECT COUNT(*) FROM quiz_result WHERE question_id IN (SELECT id FROM quiz_question WHERE deck_id = ${deckId}))` }).from(decks).where(eq(decks.id, deckId)).all()[0]?.count ?? 0,
          chatConversations: db.select({ count: sql<number>`(SELECT COUNT(*) FROM chat_conversation WHERE flashcard_id IN (SELECT id FROM flashcard WHERE deck_id = ${deckId}) OR question_id IN (SELECT id FROM quiz_question WHERE deck_id = ${deckId}))` }).from(decks).where(eq(decks.id, deckId)).all()[0]?.count ?? 0,
          cardFlags: db.select({ count: sql<number>`(SELECT COUNT(*) FROM card_flag WHERE flashcard_id IN (SELECT id FROM flashcard WHERE deck_id = ${deckId}) OR question_id IN (SELECT id FROM quiz_question WHERE deck_id = ${deckId}))` }).from(decks).where(eq(decks.id, deckId)).all()[0]?.count ?? 0,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }
      const deleted = writeTransaction(db, () =>
        db.delete(decks).where(and(eq(decks.id, deckId), eq(decks.userId, userId))).returning().all()
      );
      if (deleted.length === 0) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }
      emitEvent(db, userId, "deck.deleted", { deckId });
      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, deckId }, null, 2) }] };
    }
  );
}
