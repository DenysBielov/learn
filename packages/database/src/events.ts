import { type AppDatabase } from "./index";
import { events } from "./schema";

// In-memory rate limiter: max 10 events/sec per user
const rateLimits = new Map<number, { count: number; resetAt: number }>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 1000 });
    return true;
  }

  if (entry.count >= 10) {
    return false; // Rate limited, silently drop
  }

  entry.count++;
  return true;
}

/**
 * Emit an event to the SQLite event bus.
 * Silently drops if rate limited (max 10/sec/user).
 * Should be called AFTER a successful writeTransaction (not inside one).
 */
export function emitEvent(
  db: AppDatabase,
  userId: number,
  type: string,
  payload: Record<string, unknown> = {}
): void {
  if (!checkRateLimit(userId)) return;

  try {
    db.insert(events).values({
      userId,
      type,
      payload: JSON.stringify(payload),
    }).run();
  } catch {
    // Non-critical — don't let event emission break the tool
  }
}
