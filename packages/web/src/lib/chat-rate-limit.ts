import { getDb, writeTransaction } from "@flashcards/database";
import { sql } from "drizzle-orm";

const CHAT_WINDOW_MS = 60_000; // 1 minute
const CHAT_MAX_REQUESTS = 20;
const IMAGE_GEN_WINDOW_MS = 60_000;
const IMAGE_GEN_MAX_REQUESTS = 5;

function ensureTable() {
  const db = getDb();
  db.run(sql`
    CREATE TABLE IF NOT EXISTS chat_rate_limit (
      user_id INTEGER NOT NULL,
      bucket TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      PRIMARY KEY (user_id, bucket, timestamp)
    )
  `);
}

let tableCreated = false;

function init() {
  if (!tableCreated) {
    ensureTable();
    tableCreated = true;
  }
}

function checkLimit(
  userId: number,
  bucket: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number } {
  init();
  const db = getDb();
  const cutoff = Date.now() - windowMs;

  // Clean old entries and count
  writeTransaction(db, () => {
    db.run(sql`DELETE FROM chat_rate_limit WHERE timestamp < ${cutoff}`);
  });

  const result = db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM chat_rate_limit
    WHERE user_id = ${userId} AND bucket = ${bucket} AND timestamp >= ${cutoff}
  `);

  const count = result?.count ?? 0;
  return { allowed: count < maxRequests, remaining: maxRequests - count };
}

function record(userId: number, bucket: string) {
  init();
  const db = getDb();
  writeTransaction(db, () => {
    db.run(sql`
      INSERT INTO chat_rate_limit (user_id, bucket, timestamp) VALUES (${userId}, ${bucket}, ${Date.now()})
    `);
  });
}

export function checkChatRateLimit(userId: number) {
  return checkLimit(userId, "chat", CHAT_WINDOW_MS, CHAT_MAX_REQUESTS);
}

export function recordChatRequest(userId: number) {
  record(userId, "chat");
}

export function checkImageGenRateLimit(userId: number) {
  return checkLimit(userId, "image_gen", IMAGE_GEN_WINDOW_MS, IMAGE_GEN_MAX_REQUESTS);
}

export function recordImageGenRequest(userId: number) {
  record(userId, "image_gen");
}
