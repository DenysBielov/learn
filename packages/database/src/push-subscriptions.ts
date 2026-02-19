import { eq, and, inArray } from "drizzle-orm";
import type { AppDatabase } from "./index";
import { pushSubscriptions } from "./schema";

const ALLOWED_PUSH_DOMAINS = [
  /\.push\.services\.mozilla\.com$/,
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /\.notify\.windows\.com$/,
  /\.push\.apple\.com$/,
];

export function validateEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return ALLOWED_PUSH_DOMAINS.some(pattern => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

const MAX_SUBSCRIPTIONS_PER_USER = 10;

/**
 * Save a push subscription for a user.
 * MUST be called within a writeTransaction to ensure atomicity of the
 * subscription cap check + insert.
 */
export function saveSubscription(
  db: AppDatabase,
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
): { ok: boolean; error?: string } {
  if (!validateEndpoint(endpoint)) {
    return { ok: false, error: "Invalid push endpoint" };
  }

  const existing = db.select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all();
  if (existing.length >= MAX_SUBSCRIPTIONS_PER_USER) {
    return { ok: false, error: "Maximum subscriptions reached" };
  }

  db.insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: { p256dh, auth, createdAt: new Date() },
    })
    .run();

  return { ok: true };
}

export function deleteSubscription(db: AppDatabase, userId: number, endpoint: string) {
  db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .run();
}

export function getSubscriptionsForUser(db: AppDatabase, userId: number) {
  return db.select({
    id: pushSubscriptions.id,
    endpoint: pushSubscriptions.endpoint,
    p256dh: pushSubscriptions.p256dh,
    auth: pushSubscriptions.auth,
  }).from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all();
}

export function getAllSubscriptionsGrouped(db: AppDatabase) {
  return db.select({
    id: pushSubscriptions.id,
    userId: pushSubscriptions.userId,
    endpoint: pushSubscriptions.endpoint,
    p256dh: pushSubscriptions.p256dh,
    auth: pushSubscriptions.auth,
  }).from(pushSubscriptions)
    .all();
}

export function deleteSubscriptionsByIds(db: AppDatabase, ids: number[]) {
  if (ids.length === 0) return;
  db.delete(pushSubscriptions)
    .where(inArray(pushSubscriptions.id, ids))
    .run();
}
