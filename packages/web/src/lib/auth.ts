import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/better-auth";
import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// Better Auth – new session-based auth functions
// ---------------------------------------------------------------------------

export async function getAuthUser(): Promise<{ userId: number; email: string; name: string | null } | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;
  return {
    userId: Number(session.user.id),
    email: session.user.email,
    name: session.user.name,
  };
}

export async function requireAuth(): Promise<{ userId: number; email: string; name: string | null }> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function getOptionalUser() {
  return getAuthUser();
}

// ---------------------------------------------------------------------------
// Legacy helpers – still imported by the old login route & add-user script.
// Will be removed in Task 13.
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = "24h";
const COOKIE_NAME = "auth_token";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload === "object" && "userId" in payload) {
      return { userId: payload.userId as number };
    }
    return null;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
