import { type NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getDb, events } from "@flashcards/database";
import { and, gt, desc, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Event pruning — runs once per minute
let pruneTimer: ReturnType<typeof setInterval> | null = null;

function startPruning() {
  if (pruneTimer) return; // Already started

  pruneTimer = setInterval(() => {
    try {
      const db = getDb();
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;

      // Delete events older than 5 minutes
      db.delete(events)
        .where(sql`${events.createdAt} < ${fiveMinutesAgo}`)
        .run();

      // Hard cap: keep max 10,000 rows
      const countResult = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(events)
        .get();
      const count = countResult?.count ?? 0;

      if (count > 10000) {
        // Delete oldest events beyond the cap
        db.run(sql`
          DELETE FROM event WHERE id NOT IN (
            SELECT id FROM event ORDER BY id DESC LIMIT 10000
          )
        `);
      }
    } catch {
      // Non-critical — skip this cycle
    }
  }, 60_000); // Every 60 seconds
}

// Start pruning when the module loads
startPruning();

// Per-user connection tracking
const connections = new Map<number, number>(); // userId -> active count
const MAX_CONNECTIONS_PER_USER = 3;
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const POLL_INTERVAL_MS = 2000; // 2 seconds
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds

export async function GET(request: NextRequest) {
  // Auth via cookie (SSE uses cookies, not Authorization header)
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = verifyToken(token);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;

  // Connection limit
  const currentConnections = connections.get(userId) ?? 0;
  if (currentConnections >= MAX_CONNECTIONS_PER_USER) {
    return NextResponse.json(
      { error: "Too many connections" },
      { status: 429 }
    );
  }

  connections.set(userId, currentConnections + 1);

  const db = getDb();
  const startTime = Date.now();

  // Get the latest event ID at connection time (start from here)
  const latestEvent = db
    .select({ id: events.id })
    .from(events)
    .orderBy(desc(events.id))
    .limit(1)
    .get();
  let lastSeenId = latestEvent?.id ?? 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        controller.enqueue(encoder.encode(data));
      }

      // Send initial connection event
      send(`:ok\n\n`);

      // Poll for new events
      const pollTimer = setInterval(() => {
        // Check max duration
        if (Date.now() - startTime > MAX_DURATION_MS) {
          send(`event: timeout\ndata: {}\n\n`);
          cleanup();
          controller.close();
          return;
        }

        try {
          const newEvents = db
            .select()
            .from(events)
            .where(and(gt(events.id, lastSeenId), eq(events.userId, userId)))
            .orderBy(events.id)
            .limit(50) // Cap per poll to prevent flooding
            .all();

          for (const event of newEvents) {
            // Send as unnamed events (no `event:` field) so that
            // EventSource.onmessage fires for every event type.
            // The event type is embedded in the data payload instead.
            const payload = JSON.parse(event.payload);
            const data = JSON.stringify({ type: event.type, ...payload });
            send(`id: ${event.id}\ndata: ${data}\n\n`);
            lastSeenId = event.id;
          }
        } catch {
          // DB error - skip this cycle
        }
      }, POLL_INTERVAL_MS);

      // Heartbeat to detect zombie connections
      const heartbeatTimer = setInterval(() => {
        try {
          send(`:heartbeat\n\n`);
        } catch {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      function cleanup() {
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        const count = connections.get(userId) ?? 1;
        if (count <= 1) {
          connections.delete(userId);
        } else {
          connections.set(userId, count - 1);
        }
      }

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
