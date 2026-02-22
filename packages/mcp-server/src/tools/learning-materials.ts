import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppDatabase, learningMaterials, flashcards, quizQuestions, decks, writeTransaction } from "@flashcards/database";
import { eq, and } from "drizzle-orm";

const ALLOWED_URL_SCHEMES = ["http:", "https:", "obsidian:"];

function validateUrl(url: string): string | null {
  if (url.startsWith("obsidian://")) return null; // valid
  try {
    const parsed = new URL(url);
    if (!ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
      return `URL scheme "${parsed.protocol}" is not allowed. Allowed: ${ALLOWED_URL_SCHEMES.join(", ")}`;
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

function detectType(url: string): "article" | "video" | "obsidian" | "other" {
  if (url.startsWith("obsidian://")) return "obsidian";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "video";
  return "article";
}

export function registerLearningMaterialTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "add_learning_material",
    "Add learning material URLs to a flashcard or quiz question. Materials are reference links (articles, YouTube videos, Obsidian notes) for deeper study.",
    {
      flashcard_id: z.number().int().positive().optional().describe("Flashcard to attach material to"),
      question_id: z.number().int().positive().optional().describe("Quiz question to attach material to"),
      materials: z.array(z.object({
        url: z.string().max(2048).describe("URL (https://, obsidian://)"),
        title: z.string().max(500).optional().describe("Display title (auto-detected from URL if omitted)"),
      })).min(1).max(20).describe("Materials to add"),
    },
    async ({ flashcard_id, question_id, materials: inputs }) => {
      if (!flashcard_id && !question_id) {
        return { content: [{ type: "text" as const, text: "Must specify either flashcard_id or question_id" }], isError: true };
      }
      if (flashcard_id && question_id) {
        return { content: [{ type: "text" as const, text: "Specify only one of flashcard_id or question_id" }], isError: true };
      }

      // Validate all URLs before any writes
      for (const m of inputs) {
        const err = validateUrl(m.url);
        if (err) return { content: [{ type: "text" as const, text: `Invalid URL "${m.url}": ${err}` }], isError: true };
      }

      // Verify ownership
      if (flashcard_id) {
        const card = db.select({ id: flashcards.id }).from(flashcards)
          .innerJoin(decks, eq(flashcards.deckId, decks.id))
          .where(and(eq(flashcards.id, flashcard_id), eq(decks.userId, userId)))
          .get();
        if (!card) return { content: [{ type: "text" as const, text: `Flashcard ${flashcard_id} not found` }], isError: true };
      }
      if (question_id) {
        const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
          .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
          .where(and(eq(quizQuestions.id, question_id), eq(decks.userId, userId)))
          .get();
        if (!q) return { content: [{ type: "text" as const, text: `Question ${question_id} not found` }], isError: true };
      }

      // Position query + inserts inside writeTransaction to avoid race condition
      const created = writeTransaction(db, () => {
        const existing = db.select({ position: learningMaterials.position })
          .from(learningMaterials)
          .where(
            flashcard_id
              ? eq(learningMaterials.flashcardId, flashcard_id)
              : eq(learningMaterials.questionId, question_id!)
          )
          .all();
        let nextPos = existing.length > 0 ? Math.max(...existing.map(e => e.position)) + 1 : 0;

        return inputs.map((m) => {
          const [row] = db.insert(learningMaterials).values({
            flashcardId: flashcard_id ?? null,
            questionId: question_id ?? null,
            url: m.url,
            title: m.title ?? null,
            type: detectType(m.url),
            position: nextPos++,
          }).returning().all();
          return row;
        });
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "list_learning_materials",
    "List learning materials attached to a flashcard or quiz question.",
    {
      flashcard_id: z.number().int().positive().optional(),
      question_id: z.number().int().positive().optional(),
    },
    async ({ flashcard_id, question_id }) => {
      if (!flashcard_id && !question_id) {
        return { content: [{ type: "text" as const, text: "Must specify either flashcard_id or question_id" }], isError: true };
      }
      if (flashcard_id && question_id) {
        return { content: [{ type: "text" as const, text: "Specify only one of flashcard_id or question_id" }], isError: true };
      }

      // Verify ownership through deck
      if (flashcard_id) {
        const card = db.select({ id: flashcards.id }).from(flashcards)
          .innerJoin(decks, eq(flashcards.deckId, decks.id))
          .where(and(eq(flashcards.id, flashcard_id), eq(decks.userId, userId)))
          .get();
        if (!card) return { content: [{ type: "text" as const, text: `Flashcard ${flashcard_id} not found` }], isError: true };
      }
      if (question_id) {
        const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
          .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
          .where(and(eq(quizQuestions.id, question_id), eq(decks.userId, userId)))
          .get();
        if (!q) return { content: [{ type: "text" as const, text: `Question ${question_id} not found` }], isError: true };
      }

      const results = db.select().from(learningMaterials)
        .where(
          flashcard_id
            ? eq(learningMaterials.flashcardId, flashcard_id)
            : eq(learningMaterials.questionId, question_id!)
        )
        .orderBy(learningMaterials.position)
        .all();

      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "remove_learning_material",
    "Remove a learning material by ID.",
    {
      material_id: z.number().int().positive(),
    },
    async ({ material_id }) => {
      // Verify ownership through the parent flashcard/question
      const material = db.select({
        id: learningMaterials.id,
        flashcardId: learningMaterials.flashcardId,
        questionId: learningMaterials.questionId,
      }).from(learningMaterials).where(eq(learningMaterials.id, material_id)).get();

      if (!material) {
        return { content: [{ type: "text" as const, text: `Material ${material_id} not found` }], isError: true };
      }

      // Check ownership via deck
      if (material.flashcardId) {
        const card = db.select({ id: flashcards.id }).from(flashcards)
          .innerJoin(decks, eq(flashcards.deckId, decks.id))
          .where(and(eq(flashcards.id, material.flashcardId), eq(decks.userId, userId)))
          .get();
        if (!card) return { content: [{ type: "text" as const, text: "Not authorized" }], isError: true };
      } else if (material.questionId) {
        const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
          .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
          .where(and(eq(quizQuestions.id, material.questionId), eq(decks.userId, userId)))
          .get();
        if (!q) return { content: [{ type: "text" as const, text: "Not authorized" }], isError: true };
      }

      writeTransaction(db, () =>
        db.delete(learningMaterials).where(eq(learningMaterials.id, material_id)).run()
      );

      return { content: [{ type: "text" as const, text: `Material ${material_id} removed` }] };
    }
  );
}
