import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

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

export async function getAuthUser(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<{ userId: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export { COOKIE_NAME };
