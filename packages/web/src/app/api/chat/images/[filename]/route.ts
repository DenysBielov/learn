import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAuth } from "@/lib/auth";
import { getImagePath, getContentType } from "@/lib/chat-images";
import { getDb } from "@flashcards/database";
import { chatMessages, chatConversations } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { userId } = await requireAuth();

  const { filename } = await params;

  // Verify image belongs to user's conversation
  const db = getDb();
  const message = db.select({ id: chatMessages.id }).from(chatMessages)
    .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
    .where(and(eq(chatMessages.imageUrl, filename), eq(chatConversations.userId, userId)))
    .get();
  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filepath = getImagePath(filename);

  if (!filepath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop() ?? "";
  const contentType = getContentType(ext);
  const fileBuffer = fs.readFileSync(filepath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
