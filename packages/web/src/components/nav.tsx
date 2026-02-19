"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, RefreshCw, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationToggle } from "@/components/notification-toggle";

async function cleanupServiceWorker() {
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await reg.unregister();
    }
  }
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/review", label: "Review", icon: RefreshCw },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await cleanupServiceWorker();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:border-r md:bg-background">
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
          <div className="flex items-center justify-between flex-shrink-0 px-4">
            <h1 className="text-xl font-bold">Flashcards</h1>
            <div className="flex items-center gap-1">
              <NotificationToggle />
              <ThemeToggle />
            </div>
          </div>
          <nav className="mt-8 flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 pb-4">
            <button
              onClick={handleLogout}
              className="group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full"
            >
              <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t z-50">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-3 px-4 text-xs flex-1 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-6 w-6 mb-1" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="flex items-center justify-center py-3 px-4">
            <NotificationToggle />
          </div>
          <div className="flex items-center justify-center py-3 px-4">
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center py-3 px-4 text-xs flex-1 transition-colors text-muted-foreground"
          >
            <LogOut className="h-6 w-6 mb-1" />
            <span>Sign out</span>
          </button>
        </div>
      </nav>
    </>
  );
}
