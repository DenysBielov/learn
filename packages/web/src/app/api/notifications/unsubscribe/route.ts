import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteSubscription } from "@flashcards/database/push-subscriptions";
import { getDb, writeTransaction } from "@flashcards/database";
import { z } from "zod";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function DELETE(request: NextRequest) {
  const { userId } = await requireAuth();

  try {
    const body = await request.json();
    const parsed = unsubscribeSchema.parse(body);

    const db = getDb();
    writeTransaction(db, () => deleteSubscription(db, userId, parsed.endpoint));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
