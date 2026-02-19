import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { saveSubscription } from "@flashcards/database/push-subscriptions";
import { getDb, writeTransaction } from "@flashcards/database";
import { sql } from "drizzle-orm";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(128),
    auth: z.string().min(1).max(32),
  }),
});

const SUBSCRIBE_WINDOW_MS = 3_600_000;
const SUBSCRIBE_MAX_REQUESTS = 5;

let tableCreated = false;

function ensureRateLimitTable() {
  if (tableCreated) return;
  const db = getDb();
  db.run(sql`
    CREATE TABLE IF NOT EXISTS subscribe_rate_limit (
      user_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      PRIMARY KEY (user_id, timestamp)
    )
  `);
  tableCreated = true;
}

function checkRateLimit(userId: number): boolean {
  ensureRateLimitTable();
  const db = getDb();
  const cutoff = Date.now() - SUBSCRIBE_WINDOW_MS;

  writeTransaction(db, () => {
    db.run(sql`DELETE FROM subscribe_rate_limit WHERE timestamp < ${cutoff}`);
  });

  const result = db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM subscribe_rate_limit
    WHERE user_id = ${userId} AND timestamp >= ${cutoff}
  `);

  return (result?.count ?? 0) < SUBSCRIBE_MAX_REQUESTS;
}

function recordRequest(userId: number) {
  ensureRateLimitTable();
  const db = getDb();
  writeTransaction(db, () => {
    db.run(sql`
      INSERT OR IGNORE INTO subscribe_rate_limit (user_id, timestamp) VALUES (${userId}, ${Date.now()})
    `);
  });
}

export async function POST(request: NextRequest) {
  const { userId } = await requireAuth();

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = subscribeSchema.parse(body);

    const db = getDb();
    const result = writeTransaction(db, () =>
      saveSubscription(db, userId, parsed.endpoint, parsed.keys.p256dh, parsed.keys.auth)
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    recordRequest(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid subscription data" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
