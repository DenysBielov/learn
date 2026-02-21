import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase, quizQuestions, questionOptions, decks,
  writeTransaction,
} from "@flashcards/database";
import { createQuizQuestionSchema } from "@flashcards/database/validation";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";

export function registerQuizTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_quiz",
    "Create multiple quiz questions in a deck. Supported types: multiple_choice, true_false, free_text, matching, ordering, cloze (Anki-style {{c1::word}} syntax), multi_select (multiple correct answers), code_eval (code snippet with auto or AI scoring). Content supports Markdown (**bold**, *italic*, `code`, lists, tables), LaTeX math ($inline$ and $$block$$ delimiters), and images (upload via upload_image tool first, then embed as ![alt](/api/images/filename)). IMPORTANT: When creating multiple_choice or multi_select questions, randomize the position of the correct answer across questions — do NOT always place it as the first option. Vary correct answer positions (A, B, C, D) roughly equally across the quiz.",
    {
      deckId: z.number().int().positive(),
      questions: z.array(z.object({
        type: z.enum(["multiple_choice", "true_false", "free_text", "matching", "ordering", "cloze", "multi_select", "code_eval"]),
        question: z.string().min(1).max(10240).describe("Question text. Supports Markdown and LaTeX math."),
        explanation: z.string().max(5120).optional().describe("Explanation shown after answering. Supports Markdown and LaTeX."),
        options: z.array(z.object({
          optionText: z.string().min(1).max(500).describe("Option text. Supports Markdown and LaTeX math."),
          isCorrect: z.boolean(),
        })).optional(),
        correctAnswer: z.any().optional(),
      })).min(1).max(50),
    },
    async ({ deckId, questions }) => {
      // Verify deck belongs to user
      const deck = db.select({ id: decks.id }).from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
      if (!deck) {
        return { content: [{ type: "text" as const, text: `Deck ${deckId} not found` }], isError: true };
      }

      // Validate each question against the discriminated union schema
      const validatedQuestions = questions.map(q =>
        createQuizQuestionSchema.parse({ ...q, deckId })
      );

      const created = writeTransaction(db, () => {
        const results: number[] = [];
        for (const parsed of validatedQuestions) {
          const correctAnswerJson = "correctAnswer" in parsed
            ? JSON.stringify(parsed.correctAnswer)
            : null;

          const [inserted] = db.insert(quizQuestions).values({
            deckId,
            type: parsed.type,
            question: sanitizeMarkdownImageUrls(parsed.question),
            explanation: sanitizeMarkdownImageUrls(parsed.explanation ?? ""),
            correctAnswer: correctAnswerJson,
          }).returning().all();

          results.push(inserted.id);

          if ("options" in parsed && parsed.options) {
            db.insert(questionOptions).values(
              parsed.options.map(o => ({
                questionId: inserted.id,
                optionText: sanitizeMarkdownImageUrls(o.optionText),
                isCorrect: o.isCorrect,
              }))
            ).run();
          }
        }
        return results;
      });

      return { content: [{ type: "text" as const, text: `Created ${created.length} questions in deck ${deckId}` }] };
    }
  );

  server.tool(
    "list_questions",
    "List quiz questions, filterable by deck, tag, or type",
    {
      deckId: z.number().int().positive().optional(),
      type: z.enum(["multiple_choice", "true_false", "free_text", "matching", "ordering", "cloze", "multi_select", "code_eval"]).optional(),
      tagName: z.string().optional(),
    },
    async ({ deckId, type, tagName }) => {
      const conditions = [
        sql`${quizQuestions.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId})`,
      ];

      if (deckId) conditions.push(eq(quizQuestions.deckId, deckId));
      if (type) conditions.push(eq(quizQuestions.type, type));

      const whereClause = and(...conditions);

      const result = await db.query.quizQuestions.findMany({
        where: whereClause,
        with: { options: true },
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
