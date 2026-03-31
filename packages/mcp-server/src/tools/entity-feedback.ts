import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type AppDatabase, entityFeedback, writeTransaction } from "@flashcards/database";

const entityTypeEnum = z.enum(["material", "quiz", "question", "flashcard", "deck", "course"]);

/**
 * Shared helper: get aggregated feedback counts for a batch of entities.
 * Returns a Map from entityId to { positiveCount, negativeCount }.
 */
export function getFeedbackCounts(
  db: AppDatabase,
  entityType: string,
  entityIds: number[],
): Map<number, { positiveCount: number; negativeCount: number }> {
  if (entityIds.length === 0) return new Map();

  const rows = db.select({
    entityId: entityFeedback.entityId,
    positiveCount: sql<number>`sum(case when ${entityFeedback.vote} = 1 then 1 else 0 end)`,
    negativeCount: sql<number>`sum(case when ${entityFeedback.vote} = -1 then 1 else 0 end)`,
  })
    .from(entityFeedback)
    .where(and(
      eq(entityFeedback.entityType, entityType),
      inArray(entityFeedback.entityId, entityIds),
    ))
    .groupBy(entityFeedback.entityId)
    .all();

  const map = new Map<number, { positiveCount: number; negativeCount: number }>();
  for (const row of rows) {
    map.set(row.entityId, {
      positiveCount: row.positiveCount ?? 0,
      negativeCount: row.negativeCount ?? 0,
    });
  }
  return map;
}

export function registerEntityFeedbackTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "list_feedback",
    "List entity feedback. Filter by entity type, specific entity, vote direction, or review status. Returns feedback with user info and comments.",
    {
      entity_type: entityTypeEnum.optional().describe("Filter by entity type"),
      entity_id: z.number().int().positive().optional().describe("Filter by specific entity ID (requires entity_type)"),
      vote: z.enum(["positive", "negative"]).optional().describe("Filter by vote: 'positive' (thumbs up) or 'negative' (thumbs down)"),
      is_reviewed: z.boolean().optional().describe("Filter by review status"),
      limit: z.number().int().min(1).max(100).optional().default(50).describe("Max results"),
    },
    async ({ entity_type, entity_id, vote, is_reviewed, limit }) => {
      const conditions = [];
      if (entity_type) conditions.push(eq(entityFeedback.entityType, entity_type));
      if (entity_id && entity_type) conditions.push(eq(entityFeedback.entityId, entity_id));
      if (vote) conditions.push(eq(entityFeedback.vote, vote === "positive" ? 1 : -1));
      if (is_reviewed !== undefined) conditions.push(eq(entityFeedback.isReviewed, is_reviewed));

      const rows = db.select()
        .from(entityFeedback)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit)
        .all();

      const result = rows.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        vote: r.vote === 1 ? "positive" : "negative",
        comment: r.comment,
        isReviewed: r.isReviewed,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "resolve_feedback",
    "Mark feedback items as reviewed. Use after processing feedback to improve content quality.",
    {
      feedback_ids: z.array(z.number().int().positive()).min(1).describe("Array of feedback IDs to mark as reviewed"),
    },
    async ({ feedback_ids }) => {
      let updated = 0;
      writeTransaction(db, () => {
        for (const id of feedback_ids) {
          const result = db.update(entityFeedback)
            .set({ isReviewed: true, updatedAt: new Date() })
            .where(eq(entityFeedback.id, id))
            .run();
          updated += result.changes;
        }
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ updated, total: feedback_ids.length }) }],
      };
    }
  );

  server.tool(
    "get_feedback_summary",
    "Get aggregated feedback counts for one or more entities. Returns positive and negative vote counts per entity.",
    {
      entity_type: entityTypeEnum.describe("Entity type"),
      entity_ids: z.array(z.number().int().positive()).min(1).max(100).describe("Array of entity IDs"),
    },
    async ({ entity_type, entity_ids }) => {
      const countsMap = getFeedbackCounts(db, entity_type, entity_ids);
      const summaries = entity_ids.map((entityId) => ({
        entityId,
        positiveCount: countsMap.get(entityId)?.positiveCount ?? 0,
        negativeCount: countsMap.get(entityId)?.negativeCount ?? 0,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }] };
    }
  );
}
