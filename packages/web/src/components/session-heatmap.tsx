"use client";

import { useMemo } from "react";

type DayData = {
  totalMinutes: number;
  courses: Record<number, { name: string; color: string; minutes: number }>;
};

type Course = { id: number; name: string; color: string };

type Props = {
  dayMap: Record<string, DayData>;
  courses: Course[];
};

const DEFAULT_COLOR = "#6366f1";
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function withOpacity(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function intensityAlpha(totalMinutes: number): number {
  const clamped = Math.min(totalMinutes, 300);
  return 0.2 + (clamped / 300) * 0.8;
}

type WeekColumn = { date: Date; key: string }[];

function getWeeks(): WeekColumn[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Go back ~1 year to the previous Monday
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 1);
  // Shift to the Monday of that week (getDay: 0=Sun, 1=Mon, ...)
  const dayOfWeek = start.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diffToMon);

  const weeks: WeekColumn[] = [];
  let currentWeek: WeekColumn = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    const dow = cursor.getDay();
    // Map Sun=0 -> row 6, Mon=1 -> row 0, Tue=2 -> row 1, etc.
    if (dow === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push({
      date: new Date(cursor),
      key: cursor.toISOString().slice(0, 10),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

type MonthLabel = { label: string; col: number };

function getMonthLabels(weeks: WeekColumn[]): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let lastMonth = -1;
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  for (let i = 0; i < weeks.length; i++) {
    const firstDay = weeks[i][0];
    const month = firstDay.date.getMonth();
    if (month !== lastMonth) {
      labels.push({ label: monthNames[month], col: i });
      lastMonth = month;
    }
  }

  return labels;
}

function getDominantColor(day: DayData): string {
  const entries = Object.values(day.courses);
  if (entries.length === 0) return DEFAULT_COLOR;

  let max = 0;
  let color = DEFAULT_COLOR;
  for (const entry of entries) {
    if (entry.minutes > max) {
      max = entry.minutes;
      color = entry.color;
    }
  }
  return color;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function dayRow(date: Date): number {
  // Mon=0, Tue=1, ..., Sun=6
  const dow = date.getDay();
  return dow === 0 ? 6 : dow - 1;
}

export function SessionHeatmap({ dayMap, courses }: Props) {
  const weeks = useMemo(() => getWeeks(), []);
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);

  // Courses that actually appear in the data
  const activeCourses = useMemo(() => {
    const seenIds = new Set<number>();
    for (const day of Object.values(dayMap)) {
      for (const id of Object.keys(day.courses)) {
        seenIds.add(Number(id));
      }
    }
    return courses.filter((c) => seenIds.has(c.id));
  }, [dayMap, courses]);

  return (
    <div className="bg-card border rounded-[10px] p-4 overflow-x-auto">
      {/* Month labels */}
      <div className="flex mb-1" style={{ paddingLeft: 32 }}>
        {(() => {
          const elements: React.ReactNode[] = [];
          for (let i = 0; i < monthLabels.length; i++) {
            const current = monthLabels[i];
            const next = monthLabels[i + 1];
            const span = next ? next.col - current.col : weeks.length - current.col;
            elements.push(
              <span
                key={current.label + current.col}
                className="text-xs text-muted-foreground"
                style={{ width: span * 14, flexShrink: 0 }}
              >
                {current.label}
              </span>
            );
          }
          return elements;
        })()}
      </div>

      {/* Grid */}
      <div className="flex gap-0">
        {/* Day labels column */}
        <div className="flex flex-col shrink-0" style={{ width: 32, gap: 2 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-3 flex items-center">
              <span className="text-xs text-muted-foreground leading-none">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex" style={{ gap: 2 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
              {Array.from({ length: 7 }).map((_, row) => {
                const entry = week.find((d) => dayRow(d.date) === row);
                if (!entry) {
                  return <div key={row} className="w-3 h-3" />;
                }

                const day = dayMap[entry.key];
                const hasData = day && day.totalMinutes > 0;
                const color = hasData ? getDominantColor(day) : undefined;
                const alpha = hasData ? intensityAlpha(day.totalMinutes) : undefined;
                const dateStr = entry.date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div key={row} className="relative group">
                    <div
                      className={`w-3 h-3 rounded-sm ${!hasData ? "bg-foreground/[0.04]" : ""}`}
                      style={
                        hasData
                          ? { backgroundColor: withOpacity(color!, alpha!) }
                          : undefined
                      }
                    />
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                      <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                        <div className="font-medium mb-1">{dateStr}</div>
                        {hasData ? (
                          <>
                            <div className="text-muted-foreground mb-1">
                              Total: {formatMinutes(day.totalMinutes)}
                            </div>
                            {Object.values(day.courses).map((c) => (
                              <div key={c.name} className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-sm shrink-0"
                                  style={{ backgroundColor: c.color }}
                                />
                                <span className="text-muted-foreground">
                                  {c.name}: {formatMinutes(c.minutes)}
                                </span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="text-muted-foreground">No study</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        {/* Course legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {activeCourses.map((course) => (
            <div key={course.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: course.color }}
              />
              <span className="text-xs text-muted-foreground">{course.name}</span>
            </div>
          ))}
        </div>

        {/* Intensity scale */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Less</span>
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((alpha) => (
            <div
              key={alpha}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: withOpacity(DEFAULT_COLOR, alpha) }}
            />
          ))}
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  );
}
