"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { users, account, apiTokens } from "@flashcards/database/schema";
import { encrypt } from "@flashcards/database/encryption";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomBytes, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile() {
  const { userId, email, name } = await requireAuth();
  return { name: name ?? "", email };
}

export async function updateProfile(name: string) {
  const { userId } = await requireAuth();
  const db = getDb();
  writeTransaction(db, () =>
    db.update(users).set({ name }).where(eq(users.id, userId)).run()
  );
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// Change Password
// ---------------------------------------------------------------------------

export async function hasCredentialAccount() {
  const { userId } = await requireAuth();
  const db = getDb();
  const row = db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .get();
  return !!row;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await requireAuth();

  const res = await auth.api.changePassword({
    headers: await headers(),
    body: { currentPassword, newPassword },
  });

  if (!res) {
    throw new Error("Failed to change password");
  }

  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// API Tokens
// ---------------------------------------------------------------------------

export async function getApiTokens() {
  const { userId } = await requireAuth();
  const db = getDb();
  const rows = db
    .select({
      id: apiTokens.id,
      type: apiTokens.type,
      name: apiTokens.name,
      tokenHash: apiTokens.tokenHash,
      encryptedValue: apiTokens.encryptedValue,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .all();

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    maskedValue: r.encryptedValue
      ? `****${r.encryptedValue.slice(-4)}`
      : r.tokenHash
        ? "[hidden]"
        : "",
    createdAt: r.createdAt,
  }));
}

export async function createApiToken(type: string, name: string, value: string) {
  const { userId } = await requireAuth();
  const db = getDb();

  const { encrypted, keyVersion } = encrypt(value);

  writeTransaction(db, () =>
    db
      .insert(apiTokens)
      .values({
        userId,
        type,
        name,
        encryptedValue: encrypted,
        keyVersion,
      })
      .run()
  );

  revalidatePath("/settings");
}

export async function deleteApiToken(tokenId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () =>
    db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
      .run()
  );

  revalidatePath("/settings");
}

export async function generateMcpToken(name: string) {
  const { userId } = await requireAuth();
  const db = getDb();

  const plaintext = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(plaintext).digest("hex");

  writeTransaction(db, () =>
    db
      .insert(apiTokens)
      .values({
        userId,
        type: "mcp",
        name,
        tokenHash: hash,
        keyVersion: 1,
      })
      .run()
  );

  revalidatePath("/settings");
  return plaintext;
}
