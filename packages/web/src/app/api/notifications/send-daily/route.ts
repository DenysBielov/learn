import { NextRequest, NextResponse } from "next/server";
import { initVapid, verifyCronSecret, sendNotification } from "@/lib/push-send";
import { getAllSubscriptionsGrouped, deleteSubscriptionsByIds } from "@flashcards/database/push-subscriptions";
import { getActiveCoursesDueCount } from "@flashcards/database/courses";
import { getDb, writeTransaction } from "@flashcards/database";

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initVapid();
  } catch {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  const db = getDb();
  const subscriptions = getAllSubscriptionsGrouped(db);
  if (subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const byUser = new Map<number, typeof subscriptions>();
  for (const sub of subscriptions) {
    if (!byUser.has(sub.userId)) byUser.set(sub.userId, []);
    byUser.get(sub.userId)!.push(sub);
  }

  const sendPromises: Promise<{ subId: number; success: boolean; statusCode?: number }>[] = [];

  for (const [userId, userSubs] of byUser) {
    const dueCount = getActiveCoursesDueCount(db, userId);
    if (dueCount === 0) continue;

    const payload = {
      title: "Flashcards",
      body: `You have ${dueCount} card${dueCount !== 1 ? "s" : ""} due for review`,
      url: "/review?active=true",
    };

    for (const sub of userSubs) {
      sendPromises.push(
        sendNotification(sub, payload).then(result => ({
          subId: sub.id,
          ...result,
        }))
      );
    }
  }

  const results = await Promise.allSettled(sendPromises);

  const staleIds: number[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { subId, success, statusCode } = result.value;
      if (!success && (statusCode === 404 || statusCode === 410)) {
        staleIds.push(subId);
      }
    }
  }

  writeTransaction(db, () => deleteSubscriptionsByIds(db, staleIds));

  const sent = results.filter(
    r => r.status === "fulfilled" && r.value.success
  ).length;

  return NextResponse.json({ sent, staleRemoved: staleIds.length });
}
