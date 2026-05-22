import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { AppDatabase } from "@flashcards/database";

export interface TagAccuracyInput {
  tag?: string;
  courseId?: number;
  since?: string; // ISO
}

export interface TagAccuracyRow {
  tag: string;
  attempts: number;
  correctRate: number;
  avgConfidence: number | null;
}

export function getTagAccuracy(db: AppDatabase, userId: number, input: TagAccuracyInput): TagAccuracyRow[] {
  const filters: ReturnType<typeof sql>[] = [sql`q.user_id = ${userId}`];
  if (input.tag !== undefined) filters.push(sql`t.name = ${input.tag}`);
  if (input.since !== undefined) {
    const ts = Math.floor(new Date(input.since).getTime() / 1000);
    filters.push(sql`qr.answered_at >= ${ts}`);
  }
  if (input.courseId !== undefined) {
    filters.push(sql`qq.quiz_id IN (SELECT quiz_id FROM course_step WHERE course_id = ${input.courseId} AND step_type = 'quiz' AND quiz_id IS NOT NULL)`);
  }
  const whereSql = filters.reduce((acc, f, i) => i === 0 ? f : sql`${acc} AND ${f}`);

  const havingClause = input.tag === undefined ? sql`HAVING attempts >= 3` : sql``;

  const rows = db.all<{ tag: string; attempts: number; correct_rate: number; avg_conf: number | null }>(sql`
    SELECT t.name AS tag,
           COUNT(qr.id) AS attempts,
           CAST(SUM(qr.correct) AS REAL) / COUNT(qr.id) AS correct_rate,
           AVG(qr.confidence) AS avg_conf
    FROM quiz_result qr
    INNER JOIN quiz_question qq ON qq.id = qr.question_id
    INNER JOIN quiz q ON q.id = qq.quiz_id
    INNER JOIN question_tag qt ON qt.question_id = qq.id
    INNER JOIN tag t ON t.id = qt.tag_id
    WHERE ${whereSql}
    GROUP BY t.id
    ${havingClause}
    ORDER BY correct_rate ASC
  `);

  return rows.map(r => ({
    tag: r.tag,
    attempts: r.attempts,
    correctRate: r.correct_rate,
    avgConfidence: r.avg_conf,
  }));
}

export function registerTagAccuracyTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "get_tag_accuracy",
    "Tag-level accuracy across all quiz answers. Omit tag to get all tags with >=3 attempts.",
    {
      tag: z.string().optional(),
      courseId: z.number().int().positive().optional(),
      since: z.string().optional(),
    },
    async (input) => {
      try {
        const rows = getTagAccuracy(db, userId, input);
        return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
      }
    }
  );
}
