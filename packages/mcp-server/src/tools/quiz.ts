import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase, quizQuestions, quizzes,
  writeTransaction,
} from "@flashcards/database";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";
import { emitEvent } from "@flashcards/database/events";
import { getFeedbackCounts } from "./entity-feedback.js";

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
    "Update a quiz question's text or explanation. For structural changes (type, options, correctAnswer), use delete_questions + add_questions_to_quiz instead. IMPORTANT: options for multiple_choice, multi_select, matching, and ordering are SHUFFLED at quiz time — never reference them by authored position ('A', 'B', 'C', 'D', 'the first option') in question or explanation. Quote the option text or describe it semantically instead.",
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
