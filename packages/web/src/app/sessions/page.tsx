import { getSessions, getSessionStats } from "@/app/actions/sessions";
import { SessionCard } from "@/components/session-card";
import { Clock, Calendar, Timer, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Sessions — Flashcards",
};

export default async function SessionsPage() {
  const [sessions, stats] = await Promise.all([
    getSessions(),
    getSessionStats(),
  ]);

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: stats.totalSessions, icon: Calendar },
          { label: "Total Time", value: `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`, icon: Clock },
          { label: "Avg Duration", value: `${stats.avgMinutes}m`, icon: Timer },
          { label: "Today", value: stats.todaySessions, icon: TrendingUp },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border rounded-[10px] p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <stat.icon className="h-3.5 w-3.5" />
              {stat.label}
            </div>
            <div className="text-lg font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Session cards */}
      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No study sessions yet</p>
          <p className="text-xs mt-1">Start studying to see your sessions here</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
