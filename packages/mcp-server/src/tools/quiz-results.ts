import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { AppDatabase } from "@flashcards/database";

export interface QuizResultRow {
  id: number;
  sessionId: number | null;
  activityId: number | null;
  quizId: number;
  questionId: number;
  selectedOptionId: number | null;
  userAnswer: string;
  correct: boolean;
  confidence: 1 | 2 | 3 | 4 | 5 | null;
  note: string | null;
  timeSpentMs: number;
  answeredAt: string;
  questionText: string;
  questionType: string;
  selectedOptionText: string | null;
  correctOptionText: string | null;
}

export interface ListInput {
  sessionId?: number;
  quizId?: number;
  isCorrect?: boolean;
  hasNote?: boolean;
  minConfidence?: 1 | 2 | 3 | 4 | 5;
  limit?: number;
  offset?: number;
}

export function listQuizResults(db: AppDatabase, userId: number, input: ListInput): QuizResultRow[] {
  if (input.sessionId === undefined && input.quizId === undefined) {
    throw new Error("Must supply sessionId or quizId");
  }
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const offset = Math.max(input.offset ?? 0, 0);

  const filters: ReturnType<typeof sql>[] = [sql`q.user_id = ${userId}`];
  if (input.sessionId !== undefined) filters.push(sql`qr.session_id = ${input.sessionId}`);
  if (input.quizId !== undefined) filters.push(sql`qq.quiz_id = ${input.quizId}`);
  if (input.isCorrect !== undefined) filters.push(sql`qr.correct = ${input.isCorrect ? 1 : 0}`);
  if (input.hasNote === true) filters.push(sql`qr.note IS NOT NULL AND qr.note != ''`);
  if (input.hasNote === false) filters.push(sql`(qr.note IS NULL OR qr.note = '')`);
  if (input.minConfidence !== undefined) filters.push(sql`qr.confidence >= ${input.minConfidence}`);

  const whereSql = filters.reduce((acc, f, i) => i === 0 ? f : sql`${acc} AND ${f}`);

  const rows = db.all<{
    id: number; session_id: number | null; activity_id: number | null;
    quiz_id: number; question_id: number; selected_option_id: number | null;
    user_answer: string; correct: number; confidence: number | null;
    note: string | null; time_spent_ms: number; answered_at: number;
    question_text: string; question_type: string;
    selected_option_text: string | null; correct_option_text: string | null;
  }>(sql`
    SELECT
      qr.id, qr.session_id, qr.activity_id, qq.quiz_id AS quiz_id,
      qr.question_id, qr.selected_option_id, qr.user_answer, qr.correct,
      qr.confidence, qr.note, qr.time_spent_ms, qr.answered_at,
      qq.question AS question_text, qq.type AS question_type,
      (SELECT option_text FROM question_option WHERE id = qr.selected_option_id) AS selected_option_text,
      (SELECT option_text FROM question_option WHERE question_id = qq.id AND is_correct = 1 LIMIT 1) AS correct_option_text
    FROM quiz_result qr
    INNER JOIN quiz_question qq ON qq.id = qr.question_id
    INNER JOIN quiz q ON q.id = qq.quiz_id
    WHERE ${whereSql}
    ORDER BY qr.answered_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows.map(r => ({
    id: r.id,
    sessionId: r.session_id,
    activityId: r.activity_id,
    quizId: r.quiz_id,
    questionId: r.question_id,
    selectedOptionId: r.selected_option_id,
    userAnswer: r.user_answer ?? "",
    correct: !!r.correct,
    confidence: (r.confidence as 1|2|3|4|5|null) ?? null,
    note: r.note,
    timeSpentMs: r.time_spent_ms ?? 0,
    answeredAt: new Date(r.answered_at * 1000).toISOString(),
    questionText: r.question_text,
    questionType: r.question_type,
    selectedOptionText: r.selected_option_text,
    correctOptionText: r.correct_option_text,
  }));
}

export function registerQuizResultTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "list_quiz_results",
    "List per-question quiz results for a session or quiz. Returns selected/correct option text inline so wrong-answer evidence is one call.",
    {
      sessionId: z.number().int().positive().optional(),
      quizId: z.number().int().positive().optional(),
      isCorrect: z.boolean().optional(),
      hasNote: z.boolean().optional(),
      minConfidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
      limit: z.number().int().positive().max(500).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async (input) => {
      try {
        const rows = listQuizResults(db, userId, input);
        return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
      }
    }
  );
}
