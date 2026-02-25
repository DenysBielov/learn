import { getHeatmapData, getFilteredSessions, getSessionStats, getUserCourses } from "@/app/actions/sessions";
import { SessionHeatmap } from "@/components/session-heatmap";
import { SessionsList } from "@/components/sessions-list";

export const metadata = {
  title: "Sessions — Flashcards",
};

export default async function SessionsPage() {
  const [heatmap, stats, initialData, courses] = await Promise.all([
    getHeatmapData(),
    getSessionStats(),
    getFilteredSessions({}),
    getUserCourses(),
  ]);

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
      {/* Header */}
      <h1 className="text-xl font-bold">Sessions</h1>

      {/* Stats bar */}
      <div className="flex items-center">
        <div className="flex-1 text-center">
          <div className="text-xl font-semibold">{stats.totalSessions}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sessions</div>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <div className="text-xl font-semibold">
            {Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Time</div>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <div className="text-xl font-semibold">{stats.avgMinutes}m</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg Duration</div>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <div className="text-xl font-semibold">{stats.todaySessions}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Today</div>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <div className="text-xl font-semibold">{stats.streak} days</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Streak</div>
        </div>
      </div>

      {/* Heatmap */}
      <SessionHeatmap dayMap={heatmap.dayMap} courses={heatmap.courses} />

      {/* Sessions list */}
      <SessionsList
        initialSessions={initialData.sessions}
        initialNextCursor={initialData.nextCursor}
        courses={courses}
      />
    </div>
  );
}
