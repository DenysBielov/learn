import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase, quizQuestions, quizzes, questionOptions,
  writeTransaction,
} from "@flashcards/database";
import { editQuestionOptionSchema, validateOptionSet } from "@flashcards/database/validation";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";
import { emitEvent } from "@flashcards/database/events";
import { getFeedbackCounts } from "./entity-feedback.js";

export interface UpdateOptionsResult {
  questionId: number;
  type: string;
  options: { id: number; optionText: string; isCorrect: boolean }[];
  updated: number;
  inserted: number;
  deleted: number;
}

/**
 * Replace a question's options in place from a desired FINAL set.
 * - option with id  -> update that row (id preserved -> quiz_results survive)
 * - option without id -> insert
 * - existing option id omitted -> delete (quiz_result.selected_option_id -> NULL)
 * Throws Error on validation/ownership failure; writes nothing on failure.
 */
export function updateQuestionOptions(
  db: AppDatabase,
  userId: number,
  questionId: number,
  options: { id?: number; optionText: string; isCorrect: boolean }[],
): UpdateOptionsResult {
  // 1. Ownership (via quiz.userId) + fetch type
  const question = db.select({ id: quizQuestions.id, type: quizQuestions.type })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(and(eq(quizQuestions.id, questionId), eq(quizzes.userId, userId)))
    .get();
  if (!question) throw new Error(`Question ${questionId} not found`);

  // 2. Type-scope + per-type set rules on the desired final set
  const setError = validateOptionSet(question.type, options);
  if (setError) throw new Error(setError);

  // 3. Existing options for this question
  const existing = db.select({ id: questionOptions.id })
    .from(questionOptions)
    .where(eq(questionOptions.questionId, questionId))
    .all();
  const existingIds = new Set(existing.map((o) => o.id));

  // 4. Id integrity: provided ids must be unique and belong to this question
  const providedIds = options.map((o) => o.id).filter((id): id is number => id !== undefined);
  if (new Set(providedIds).size !== providedIds.length) {
    throw new Error("Duplicate option id in input");
  }
  for (const id of providedIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Option ${id} does not belong to question ${questionId}`);
    }
  }

  // 5. Compute diff
  const keepIds = new Set(providedIds);
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  const toUpdate = options.filter(
    (o): o is { id: number; optionText: string; isCorrect: boolean } => o.id !== undefined,
  );
  const toInsert = options.filter((o) => o.id === undefined);

  // 6. Apply atomically
  writeTransaction(db, () => {
    for (const id of toDelete) {
      db.delete(questionOptions)
        .where(and(eq(questionOptions.id, id), eq(questionOptions.questionId, questionId)))
        .run();
    }
    for (const o of toUpdate) {
      db.update(questionOptions)
        .set({ optionText: sanitizeMarkdownImageUrls(o.optionText), isCorrect: o.isCorrect })
        .where(and(eq(questionOptions.id, o.id), eq(questionOptions.questionId, questionId)))
        .run();
    }
    if (toInsert.length > 0) {
      db.insert(questionOptions).values(
        toInsert.map((o) => ({
          questionId,
          optionText: sanitizeMarkdownImageUrls(o.optionText),
          isCorrect: o.isCorrect,
        })),
      ).run();
    }
  });

  // 7. Read back the final set (ascending id)
  const finalRows = db.select({
    id: questionOptions.id,
    optionText: questionOptions.optionText,
    isCorrect: questionOptions.isCorrect,
  })
    .from(questionOptions)
    .where(eq(questionOptions.questionId, questionId))
    .orderBy(questionOptions.id)
    .all();

  return {
    questionId,
    type: question.type,
    options: finalRows,
    updated: toUpdate.length,
    inserted: toInsert.length,
    deleted: toDelete.length,
  };
}

export function registerQuizTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "list_questions",
    "List quiz questions, filterable by quiz or type",
    {
      quizId: z.number().int().positive().optional(),
      type: z.enum(["multiple_choice", "true_false", "free_text", "matching", "ordering", "cloze", "multi_select", "code_eval", "open_ended"]).optional(),
    },
    async ({ quizId, type }) => {
      const conditions = [
        sql`${quizQuestions.quizId} IN (SELECT id FROM quiz WHERE user_id = ${userId})`,
      ];

      if (quizId) conditions.push(eq(quizQuestions.quizId, quizId));
      if (type) conditions.push(eq(quizQuestions.type, type));

      const whereClause = and(...conditions);

      const rows = await db.query.quizQuestions.findMany({
        where: whereClause,
        with: { options: true },
      });

      const entityIds = rows.map((r) => r.id);
      const feedbackMap = getFeedbackCounts(db, "question", entityIds);
      const result = rows.map((r) => ({
        ...r,
        feedbackPositive: feedbackMap.get(r.id)?.positiveCount ?? 0,
        feedbackNegative: feedbackMap.get(r.id)?.negativeCount ?? 0,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_question",
    "Update a quiz question's text or explanation. To edit options (text, add, remove, correctness) in place WITHOUT losing history, use update_question_options. For other structural changes (type, correctAnswer), use delete_questions + add_questions_to_quiz. IMPORTANT: options for multiple_choice, multi_select, matching, and ordering are SHUFFLED at quiz time — never reference them by authored position ('A', 'B', 'C', 'D', 'the first option') in question or explanation. Quote the option text or describe it semantically instead.",
    {
      questionId: z.number().int().positive(),
      question: z.string().min(1).max(10240).optional(),
      explanation: z.string().max(5120).optional().describe(
        "A good explanation does TWO things: (1) says why the correct answer is right, AND (2) says why each distractor is wrong (or weaker). Don't just confirm the right answer — contrast it against the others so the learner understands the full decision. Options are SHUFFLED at quiz time, so NEVER reference them by authored position ('A', 'B', 'C', 'D', 'the first option'). Quote the option text or describe it semantically instead.\n\nGood example (for a Counter-vs-list question) — covers correct + all distractors, no positional refs:\n\"Counter defaults missing keys to 0 on +=, giving O(1) updates and clean code; the length-26 list is fine for lowercase-only but less general. The set-based option loses multiplicity; sorting-then-counting is O(n log n) per query.\"\n\nBad example — only restates the answer, ignores distractors, uses letters that break after shuffle:\n\"A is best because Counter handles missing keys.\""
      ),
    },
    async ({ questionId, question, explanation }) => {
      const existing = db.select({ id: quizQuestions.id }).from(quizQuestions)
        .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
        .where(and(eq(quizQuestions.id, questionId), eq(quizzes.userId, userId))).get();
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
    "update_question_options",
    "Replace a multiple_choice / true_false / multi_select question's options IN PLACE, keyed by option id, WITHOUT changing the questionId — so quiz history (quiz_results) is preserved. The `options` array is the desired FINAL set: an option WITH an id updates that row in place (id kept); an option WITHOUT an id is inserted; any existing option whose id you omit is deleted (its quiz_result references become NULL but the result rows survive). Use this instead of delete_questions + add_questions_to_quiz for option edits. Validation matches add_questions_to_quiz — multiple_choice: 2-20 options, >=1 correct; true_false: exactly 2 options, exactly 1 correct; multi_select: 2-20 options, >=1 correct AND >=1 incorrect; optionText <=500 chars. Other question types store answers in correctAnswer and are rejected. optionText supports Markdown/LaTeX. Options are SHUFFLED at quiz time — never reference them by position ('A', 'B', 'the first option').",
    {
      questionId: z.number().int().positive(),
      options: z.array(editQuestionOptionSchema).min(1).describe(
        "The desired FINAL option set. id present -> update in place (id preserved); id absent -> insert; any existing option id you omit -> delete.",
      ),
    },
    async ({ questionId, options }) => {
      try {
        const result = updateQuestionOptions(db, userId, questionId, options);
        emitEvent(db, userId, "quiz_question.updated", { questionId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
      }
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

      // Verify all questions belong to user via quiz ownership
      const owned = db.select({ id: quizQuestions.id }).from(quizQuestions)
        .where(sql`${quizQuestions.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND ${quizQuestions.quizId} IN (SELECT id FROM quiz WHERE user_id = ${userId})`)
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
          sql`${quizQuestions.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) AND ${quizQuestions.quizId} IN (SELECT id FROM quiz WHERE user_id = ${userId})`
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
