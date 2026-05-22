import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { AppDatabase } from "@flashcards/database";

export interface QuizStats {
  attempts: Array<{
    sessionId: number;
    activityId: number;
    completedAt: string;
    total: number;
    correct: number;
    percent: number;
    avgConfidence: number | null;
  }>;
  latestPercent: number;
  bestPercent: number;
  latestAt: string;
  perQuestionAccuracy: Array<{
    questionId: number;
    attempts: number;
    correctRate: number;
    lastCorrect: boolean;
    avgTimeMs: number;
  }>;
}

export function getQuizStats(db: AppDatabase, userId: number, input: { quizId: number }): QuizStats {
  const owned = db.get<{ id: number }>(sql`SELECT id FROM quiz WHERE id = ${input.quizId} AND user_id = ${userId}`);
  if (!owned) throw new Error("Quiz not found");

  const attemptRows = db.all<{
    session_id: number; activity_id: number; completed_at: number;
    total: number; correct: number; avg_conf: number | null;
  }>(sql`
    SELECT
      sa.session_id AS session_id,
      sa.id AS activity_id,
      COALESCE(sa.completed_at, (SELECT MAX(answered_at) FROM quiz_result WHERE activity_id = sa.id)) AS completed_at,
      COUNT(qr.id) AS total,
      SUM(qr.correct) AS correct,
      AVG(qr.confidence) AS avg_conf
    FROM session_activity sa
    INNER JOIN quiz_result qr ON qr.activity_id = sa.id
    WHERE sa.quiz_id = ${input.quizId} AND sa.type = 'quiz_answer'
    GROUP BY sa.id
    HAVING total > 0
    ORDER BY completed_at ASC
  `);

  const attempts = attemptRows.map(r => ({
    sessionId: r.session_id,
    activityId: r.activity_id,
    completedAt: new Date(r.completed_at * 1000).toISOString(),
    total: r.total,
    correct: r.correct,
    percent: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
    avgConfidence: r.avg_conf,
  }));

  const latest = attempts[attempts.length - 1];
  const bestPercent = attempts.reduce((m, a) => Math.max(m, a.percent), 0);

  const pq = db.all<{
    question_id: number; attempts: number; correct_rate: number;
    last_correct: number; avg_time: number;
  }>(sql`
    SELECT
      qr.question_id AS question_id,
      COUNT(qr.id) AS attempts,
      CAST(SUM(qr.correct) AS REAL) / COUNT(qr.id) AS correct_rate,
      (SELECT correct FROM quiz_result WHERE question_id = qr.question_id ORDER BY answered_at DESC, id DESC LIMIT 1) AS last_correct,
      AVG(qr.time_spent_ms) AS avg_time
    FROM quiz_result qr
    INNER JOIN quiz_question qq ON qq.id = qr.question_id
    WHERE qq.quiz_id = ${input.quizId}
    GROUP BY qr.question_id
  `);

  return {
    attempts,
    latestPercent: latest?.percent ?? 0,
    bestPercent,
    latestAt: latest?.completedAt ?? new Date(0).toISOString(),
    perQuestionAccuracy: pq.map(r => ({
      questionId: r.question_id,
      attempts: r.attempts,
      correctRate: r.correct_rate,
      lastCorrect: !!r.last_correct,
      avgTimeMs: Math.round(r.avg_time ?? 0),
    })),
  };
}

export function registerQuizStatsTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "get_quiz_stats",
    "Aggregate stats for a quiz: per-attempt scores, latest/best percent, per-question accuracy across all attempts.",
    { quizId: z.number().int().positive() },
    async ({ quizId }) => {
      try {
        const stats = getQuizStats(db, userId, { quizId });
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
      }
    }
  );
}
