import { NextRequest } from "next/server";
import { getDb, writeTransaction } from "@flashcards/database";
import { materials } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { userId } = await requireAuth();

  const { materialId, notes } = await request.json();
  if (typeof materialId !== "number" || typeof notes !== "string") {
    return new Response(null, { status: 400 });
  }

  if (notes.length > 100_000) {
    return new Response(null, { status: 400 });
  }

  const db = getDb();
  writeTransaction(db, () =>
    db.update(materials)
      .set({ notes })
      .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
      .run()
  );

  return new Response(null, { status: 204 });
}
