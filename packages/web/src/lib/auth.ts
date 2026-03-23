import { auth } from "@/lib/better-auth";
import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// Better Auth – session-based auth functions
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
