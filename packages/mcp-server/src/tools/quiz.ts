import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase, quizQuestions, questionOptions, decks, quizzes, materials,
  writeTransaction,
} from "@flashcards/database";
import { createQuizQuestionSchema } from "@flashcards/database/validation";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";
import { emitEvent } from "@flashcards/database/events";

export function registerQuizTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_quiz",
    "Create multiple quiz questions in a deck. Content supports Markdown (**bold**, *italic*, `code`, lists, tables), LaTeX math ($inline$ and $$block$$ delimiters), and images (upload via upload_image tool first, then embed as ![alt](/api/images/filename)).\n\nQUESTION TYPE SELECTION — use the right type for the concept being tested:\n- multiple_choice: factual recall, distinguishing similar concepts. Use plausible distractors.\n- true_false: common misconceptions, rules/principles. Always include explanation.\n- free_text: recall without cues — definitions, key terms. List accepted answer variants.\n- matching: related pairs (term↔definition, cause↔effect, input↔output).\n- ordering: sequential processes, timelines, algorithm steps.\n- cloze: in-context recall — formulas, code syntax, key phrases. {{c1::answer}} syntax.\n- multi_select: multiple correct answers — nuanced understanding, \"select all that apply\".\n- code_eval: programming — predict output, find bugs, trace execution.\n- open_ended: deeper analysis, explanations, design questions (higher-order thinking).\n\nTYPE DISTRIBUTION — for 10+ questions, use 4+ distinct types (no single type >40%). For 5-9, use 3+ types. For <5, use 2+ types.\n\nANSWER POSITIONING — randomize correct answer positions across multiple_choice/multi_select questions. Vary positions (A, B, C, D) roughly equally.\n\nRead the learning_content_guide resource for detailed best practices, topic-specific recommendations, and examples.",
    {
      deckId: z.number().int().positive(),
      sourceMaterialId: z.number().int().positive().optional().describe("Optional ID of the source material these questions were generated from."),
      questions: z.array(z.object({
        type: z.enum(["multiple_choice", "true_false", "free_text", "matching", "ordering", "cloze", "multi_select", "code_eval", "open_ended"]),
        question: z.string().min(1).max(10240).describe("Question text. Supports Markdown and LaTeX math."),
        explanation: z.string().max(5120).optional().describe("Explanation shown after answering. Supports Markdown and LaTeX."),
        options: z.array(z.object({
          optionText: z.string().min(1).max(500).describe("Option text. Supports Markdown and LaTeX math."),
          isCorrect: z.boolean(),
        })).optional(),
        correctAnswer: z.any().optional(),
      })).min(1).max(50),
    },
    async ({ deckId, sourceMaterialId, questions }) => {
      // Verify deck belongs to user
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

      // Validate each question against the discriminated union schema
      const validatedQuestions = questions.map(q =>
        createQuizQuestionSchema.parse({ ...q, deckId, sourceMaterialId })
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
            sourceMaterialId: sourceMaterialId ?? null,
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

      for (const questionId of created) {
        emitEvent(db, userId, "quiz_question.created", { questionId, deckId });
      }
      return { content: [{ type: "text" as const, text: `Created ${created.length} questions in deck ${deckId}` }] };
    }
  );

  server.tool(
    "list_questions",
    "List quiz questions, filterable by deck, quiz, tag, or type",
    {
      deckId: z.number().int().positive().optional(),
      quizId: z.number().int().positive().optional(),
      type: z.enum(["multiple_choice", "true_false", "free_text", "matching", "ordering", "cloze", "multi_select", "code_eval", "open_ended"]).optional(),
      tagName: z.string().optional(),
    },
    async ({ deckId, quizId, type, tagName }) => {
      const conditions = [
        sql`(${quizQuestions.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId}) OR ${quizQuestions.quizId} IN (SELECT id FROM quiz WHERE user_id = ${userId}))`,
      ];

      if (deckId) conditions.push(eq(quizQuestions.deckId, deckId));
      if (quizId) conditions.push(eq(quizQuestions.quizId, quizId));
      if (type) conditions.push(eq(quizQuestions.type, type));

      const whereClause = and(...conditions);

      const result = await db.query.quizQuestions.findMany({
        where: whereClause,
        with: { options: true },
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_question",
    "Update a quiz question's text or explanation. For structural changes (type, options, correctAnswer), use delete_questions + create_quiz instead.",
    {
      questionId: z.number().int().positive(),
      question: z.string().min(1).max(10240).optional(),
      explanation: z.string().max(5120).optional(),
    },
    async ({ questionId, question, explanation }) => {
      // Verify question belongs to user via quiz or deck ownership
      let existing = db.select({ id: quizQuestions.id }).from(quizQuestions)
        .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
        .where(and(eq(quizQuestions.id, questionId), eq(quizzes.userId, userId))).get();
      if (!existing) {
        existing = db.select({ id: quizQuestions.id }).from(quizQuestions)
          .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
          .where(and(eq(quizQuestions.id, questionId), eq(decks.userId, userId))).get();
      }
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Question ${questionId} not found` }], isError: true };
      }

      const updates: Record<string, string> = {};
      if (question !== undefined) updates.question = sanitizeMarkdownImageUrls(question);
      if (explanation !== undefined) updates.explanation = sanitizeMarkdownImageUrls(explanation);

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }], isError: true };
      }

      const updated = writeTransaction(db, () =>
        db.update(quizQuestions).set(updates).where(eq(quizQuestions.id, questionId)).returning().all()
      );

      emitEvent(db, userId, "quiz_question.updated", { questionId });
      return { content: [{ type: "text" as const, text: JSON.stringify(updated[0], null, 2) }] };
    }
  );

  server.tool(
    "delete_questions",
    "Delete quiz questions by IDs. Without confirm=true, returns a preview of what would be deleted.",
    {
      questionIds: z.array(z.number().int().positive()).min(1).max(100),
      confirm: z.boolean().optional(),
    },
    async ({ questionIds, confirm }) => {
      const uniqueIds = [...new Set(questionIds)];

      // Verify all questions belong to user
      const owned = db.select({ id: quizQuestions.id }).from(quizQuestions)
        .where(sql`${quizQuestions.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND (${quizQuestions.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId}) OR ${quizQuestions.quizId} IN (SELECT id FROM quiz WHERE user_id = ${userId}))`)
        .all();

      if (owned.length !== uniqueIds.length) {
        return { content: [{ type: "text" as const, text: "One or more questions not found or not owned by you" }], isError: true };
      }

      if (!confirm) {
        const quizResultCount = db.get<{ count: number }>(
          sql`SELECT COUNT(*) as count FROM quiz_result WHERE question_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`
        );
        const chatConversationCount = db.get<{ count: number }>(
          sql`SELECT COUNT(*) as count FROM chat_conversation WHERE question_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`
        );
        const questionOptionCount = db.get<{ count: number }>(
          sql`SELECT COUNT(*) as count FROM question_option WHERE question_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`
        );
        const cardFlagCount = db.get<{ count: number }>(
          sql`SELECT COUNT(*) as count FROM card_flag WHERE question_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`
        );

        const preview = {
          message: "Pass confirm=true to permanently delete these questions.",
          questionCount: uniqueIds.length,
          quizResults: quizResultCount?.count ?? 0,
          chatConversations: chatConversationCount?.count ?? 0,
          questionOptions: questionOptionCount?.count ?? 0,
          cardFlags: cardFlagCount?.count ?? 0,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(preview, null, 2) }] };
      }

      const deleted = writeTransaction(db, () =>
        db.delete(quizQuestions).where(
          sql`${quizQuestions.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND (${quizQuestions.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId}) OR ${quizQuestions.quizId} IN (SELECT id FROM quiz WHERE user_id = ${userId}))`
        ).returning().all()
      );

      if (deleted.length !== uniqueIds.length) {
        return { content: [{ type: "text" as const, text: "Delete count mismatch — some questions may not have been deleted" }], isError: true };
      }

      for (const q of deleted) {
        emitEvent(db, userId, "quiz_question.deleted", { questionId: q.id });
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, count: deleted.length }, null, 2) }] };
    }
  );
}
