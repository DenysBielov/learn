import { getDb } from "@flashcards/database";
import { apiTokens } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@flashcards/database/encryption";

export function getUserApiKey(userId: number, type: string): string | null {
  const db = getDb();
  const token = db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), eq(apiTokens.type, type)))
    .get();
  if (!token?.encryptedValue) return null;
  return decrypt(token.encryptedValue, token.keyVersion);
}
