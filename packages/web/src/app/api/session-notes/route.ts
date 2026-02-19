import { NextRequest } from "next/server";
import { getDb, writeTransaction } from "@flashcards/database";
import { studySessions } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { userId } = await requireAuth();

  const { sessionId, notes } = await request.json();
  if (typeof sessionId !== "number" || typeof notes !== "string") {
    return new Response(null, { status: 400 });
  }

  const db = getDb();
  writeTransaction(db, () =>
    db.update(studySessions)
      .set({ notes })
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .run()
  );

  return new Response(null, { status: 204 });
}
