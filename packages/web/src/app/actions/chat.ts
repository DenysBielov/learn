"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { chatConversations, chatMessages, materials } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { deleteImage } from "@/lib/chat-images";

export interface ChatMessageData {
  id: number;
  role: "user" | "assistant";
  content: string | null;
  imageUrl: string | null;
  createdAt: Date;
}

export async function clearConversation(conversationId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const imagesToDelete: string[] = [];

  writeTransaction(db, () => {
    const conversation = db.select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
      .get();
    if (!conversation) throw new Error("Conversation not found");

    // Collect image URLs inside the transaction
    const messagesWithImages = db.select({ imageUrl: chatMessages.imageUrl })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .all();
    for (const msg of messagesWithImages) {
      if (msg.imageUrl) imagesToDelete.push(msg.imageUrl);
    }

    db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId)).run();
    db.delete(chatConversations).where(eq(chatConversations.id, conversationId)).run();
  });

  // Delete images from disk after transaction commits successfully
  for (const imageUrl of imagesToDelete) {
    deleteImage(imageUrl);
  }
}

export async function getSessionConversation(
  sessionId: number
): Promise<{ conversationId: number | null; messages: ChatMessageData[] }> {
  const parsed = z.number().int().positive().parse(sessionId);
  const { userId } = await requireAuth();
  const db = getDb();

  const conversation = db.select().from(chatConversations)
    .where(and(
      eq(chatConversations.userId, userId),
      eq(chatConversations.sessionId, parsed),
    ))
    .get();

  if (!conversation) {
    return { conversationId: null, messages: [] };
  }

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversation.id))
    .orderBy(chatMessages.createdAt)
    .all();

  return {
    conversationId: conversation.id,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      imageUrl: m.imageUrl,
      createdAt: m.createdAt,
    })),
  };
}

export async function deleteSessionChat(sessionId: number) {
  const parsed = z.number().int().positive().parse(sessionId);
  const { userId } = await requireAuth();
  const db = getDb();
  const imagesToDelete: string[] = [];

  writeTransaction(db, () => {
    const conversation = db.select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(
        eq(chatConversations.sessionId, parsed),
        eq(chatConversations.userId, userId),
      ))
      .get();
    if (!conversation) return;

    const messagesWithImages = db.select({ imageUrl: chatMessages.imageUrl })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversation.id))
      .all();
    for (const msg of messagesWithImages) {
      if (msg.imageUrl) imagesToDelete.push(msg.imageUrl);
    }

    db.delete(chatMessages).where(eq(chatMessages.conversationId, conversation.id)).run();
    db.delete(chatConversations).where(eq(chatConversations.id, conversation.id)).run();
  });

  // Delete images from disk after transaction commits successfully
  for (const imageUrl of imagesToDelete) {
    deleteImage(imageUrl);
  }
}

export async function getMaterialConversation(materialId: number): Promise<{
  conversationId: number | null;
  messages: ChatMessageData[];
}> {
  const { userId } = await requireAuth();
  const db = getDb();

  // Verify material ownership
  const material = db.select({ id: materials.id })
    .from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
    .get();
  if (!material) throw new Error("Material not found");

  const conversation = db.select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(
      eq(chatConversations.userId, userId),
      eq(chatConversations.materialId, materialId)
    ))
    .get();

  if (!conversation) return { conversationId: null, messages: [] };

  const messages = db.select({
    id: chatMessages.id,
    role: chatMessages.role,
    content: chatMessages.content,
    imageUrl: chatMessages.imageUrl,
    createdAt: chatMessages.createdAt,
  }).from(chatMessages)
    .where(eq(chatMessages.conversationId, conversation.id))
    .orderBy(chatMessages.createdAt)
    .all();

  return {
    conversationId: conversation.id,
    messages: messages.map(m => ({
      ...m,
      role: m.role as "user" | "assistant",
    })),
  };
}

export async function getSessionChatMessages(sessionId: number): Promise<string[]> {
  const parsed = z.number().int().positive().parse(sessionId);
  const { userId } = await requireAuth();
  const db = getDb();

  const conversation = db.select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(
      eq(chatConversations.sessionId, parsed),
      eq(chatConversations.userId, userId),
    ))
    .get();

  if (!conversation) return [];

  const messages = db.select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversation.id))
    .orderBy(chatMessages.createdAt)
    .all();

  return messages
    .filter((m) => m.content)
    .map((m) => `${m.role}: ${m.content}`);
}
