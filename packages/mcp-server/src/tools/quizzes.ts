import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  type AppDatabase,
  quizzes,
  quizQuestions,
  questionOptions,
  courses,
  courseSteps,
  writeTransaction,
} from "@flashcards/database";
import { createQuizQuestionForQuizSchema } from "@flashcards/database/validation";
import { getNextStepPosition } from "@flashcards/database/courses";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";

export function registerQuizEntityTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "create_quiz_entity",
    "Create a standalone quiz in a course",
    {
      courseId: z.number().int().positive(),
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
    },
    async ({ courseId, title, description }) => {
      const course = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
      if (!course) {
        return { content: [{ type: "text" as const, text: `Course ${courseId} not found` }], isError: true };
      }

      const [quiz] = writeTransaction(db, () => {
        const [created] = db.insert(quizzes).values({
          title,
          description: description ?? "",
          userId,
        }).returning().all();

        const position = getNextStepPosition(db, courseId);
        db.insert(courseSteps).values({
          courseId,
          position,
          stepType: "quiz",
          quizId: created.id,
        }).run();

        return [created];
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(quiz, null, 2) }] };
    }
  );

  server.tool(
    "update_quiz_entity",
    "Update a standalone quiz's title or description",
    {
      quizId: z.number().int().positive(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
    },
    async ({ quizId, title, description }) => {
      const existing = db.select({ id: quizzes.id }).from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).get();
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Quiz ${quizId} not found` }], isError: true };
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;

      if (Object.keys(updates).length === 1) {
        return { content: [{ type: "text" as const, text: "No fields to update" }], isError: true };
      }

      const [updated] = writeTransaction(db, () =>
        db.update(quizzes).set(updates).where(eq(quizzes.id, quizId)).returning().all()
      );

      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "delete_quiz_entity",
    "Delete a standalone quiz and all its questions",
    {
      quizId: z.number().int().positive(),
    },
    async ({ quizId }) => {
      const existing = db.select({ id: quizzes.id }).from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).get();
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Quiz ${quizId} not found` }], isError: true };
      }

      writeTransaction(db, () =>
        db.delete(quizzes).where(eq(quizzes.id, quizId)).run()
      );

      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, quizId }) }] };
    }
  );

  server.tool(
    "add_questions_to_quiz",
    "Add quiz questions to a standalone quiz. Same question types and format as create_quiz but uses quizId instead of deckId.",
    {
      quizId: z.number().int().positive(),
      questions: z.array(z.object({
        type: z.enum(["multiple_choice", "true_false", "free_text", "matching", "ordering", "cloze", "multi_select", "code_eval", "open_ended"]),
        question: z.string().min(1).max(10240),
        explanation: z.string().max(5120).optional(),
        options: z.array(z.object({
          optionText: z.string().min(1).max(500),
          isCorrect: z.boolean(),
        })).optional(),
        correctAnswer: z.any().optional(),
      })).min(1).max(50),
    },
    async ({ quizId, questions }) => {
      const quiz = db.select({ id: quizzes.id }).from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).get();
      if (!quiz) {
        return { content: [{ type: "text" as const, text: `Quiz ${quizId} not found` }], isError: true };
      }

      const validatedQuestions = questions.map(q =>
        createQuizQuestionForQuizSchema.parse({ ...q, quizId })
      );

      const created = writeTransaction(db, () => {
        const results: number[] = [];
        for (const parsed of validatedQuestions) {
          const correctAnswerJson = "correctAnswer" in parsed
            ? JSON.stringify(parsed.correctAnswer)
            : null;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [inserted] = db.insert(quizQuestions).values({
            quizId,
            type: parsed.type,
            question: sanitizeMarkdownImageUrls(parsed.question),
            explanation: sanitizeMarkdownImageUrls(parsed.explanation ?? ""),
            correctAnswer: correctAnswerJson,
          } as any).returning().all();

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

      return { content: [{ type: "text" as const, text: `Created ${created.length} questions in quiz ${quizId}` }] };
    }
  );
}
