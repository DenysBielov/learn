import Link from "next/link";
import { getAuthUser } from "@/lib/auth";

export async function PublicHeader() {
  const user = await getAuthUser();
  if (user) return null;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-6xl flex items-center justify-between px-4 h-16">
        <Link href="/" className="text-xl font-bold">
          Flashcards
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
