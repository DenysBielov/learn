"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Clock, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFilteredSessions, type SessionFilters } from "@/app/actions/sessions";

type Course = { id: number; name: string; color: string };
type Session = Awaited<ReturnType<typeof getFilteredSessions>>["sessions"][number];

type Props = {
  initialSessions: Session[];
  initialNextCursor: number | null;
  courses: Course[];
};

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "";
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

type SortOption = "newest" | "oldest" | "longest" | "shortest";

function sortToFilters(sort: SortOption): Pick<SessionFilters, "sortBy" | "sortOrder"> {
  switch (sort) {
    case "newest":
      return { sortBy: "date", sortOrder: "desc" };
    case "oldest":
      return { sortBy: "date", sortOrder: "asc" };
    case "longest":
      return { sortBy: "duration", sortOrder: "desc" };
    case "shortest":
      return { sortBy: "duration", sortOrder: "asc" };
  }
}

function sortToUrlParams(sort: SortOption): { sort: string; order: string } {
  const { sortBy, sortOrder } = sortToFilters(sort);
  return { sort: sortBy!, order: sortOrder! };
}

function SkeletonRows() {
  return (
    <div className="border rounded-[10px] overflow-hidden divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/5 rounded bg-muted" />
          </div>
          <div className="h-5 w-16 rounded-full bg-muted hidden sm:block" />
          <div className="h-5 w-12 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-4 w-14 rounded bg-muted hidden sm:block" />
          <div className="h-4 w-10 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function SessionsList({ initialSessions, initialNextCursor, courses }: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);

  // Filter state
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Build filters object from current state
  const buildFilters = useCallback(
    (overrides: Partial<{ query: string; mode: string; courseId: string; dateRange: string; status: string; sort: SortOption }> = {}): SessionFilters => {
      const q = overrides.query ?? query;
      const m = overrides.mode ?? mode;
      const c = overrides.courseId ?? courseId;
      const d = overrides.dateRange ?? dateRange;
      const s = overrides.status ?? status;
      const so = overrides.sort ?? sort;

      const filters: SessionFilters = {};
      if (q) filters.query = q;
      if (m !== "all") filters.mode = m as SessionFilters["mode"];
      if (c !== "all") filters.courseId = Number(c);
      if (d !== "all") filters.dateRange = d as SessionFilters["dateRange"];
      if (s !== "all") filters.status = s as SessionFilters["status"];
      Object.assign(filters, sortToFilters(so));
      return filters;
    },
    [query, mode, courseId, dateRange, status, sort]
  );

  // Sync filters to URL
  const syncUrl = useCallback(
    (overrides: Partial<{ query: string; mode: string; courseId: string; dateRange: string; status: string; sort: SortOption }> = {}) => {
      const q = overrides.query ?? query;
      const m = overrides.mode ?? mode;
      const c = overrides.courseId ?? courseId;
      const d = overrides.dateRange ?? dateRange;
      const s = overrides.status ?? status;
      const so = overrides.sort ?? sort;

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (m !== "all") params.set("mode", m);
      if (c !== "all") params.set("course", c);
      if (d !== "all") params.set("date", d);
      if (s !== "all") params.set("status", s);
      const { sort: sortParam, order } = sortToUrlParams(so);
      params.set("sort", sortParam);
      params.set("order", order);

      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [query, mode, courseId, dateRange, status, sort]
  );

  // Fetch with filters (resets list)
  const fetchFiltered = useCallback(
    (overrides: Partial<{ query: string; mode: string; courseId: string; dateRange: string; status: string; sort: SortOption }> = {}) => {
      syncUrl(overrides);
      const filters = buildFilters(overrides);
      startTransition(async () => {
        const result = await getFilteredSessions(filters);
        setSessions(result.sessions);
        setNextCursor(result.nextCursor);
      });
    },
    [buildFilters, syncUrl]
  );

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchFiltered({ query: value });
      }, 300);
    },
    [fetchFiltered]
  );

  // Filter change handlers (immediate)
  const handleModeChange = useCallback(
    (value: string) => {
      setMode(value);
      fetchFiltered({ mode: value });
    },
    [fetchFiltered]
  );

  const handleCourseChange = useCallback(
    (value: string) => {
      setCourseId(value);
      fetchFiltered({ courseId: value });
    },
    [fetchFiltered]
  );

  const handleDateChange = useCallback(
    (value: string) => {
      setDateRange(value);
      fetchFiltered({ dateRange: value });
    },
    [fetchFiltered]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatus(value);
      fetchFiltered({ status: value });
    },
    [fetchFiltered]
  );

  const handleSortChange = useCallback(
    (value: string) => {
      const v = value as SortOption;
      setSort(v);
      fetchFiltered({ sort: v });
    },
    [fetchFiltered]
  );

  // Load more (append to list)
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const filters = buildFilters();
      filters.cursor = nextCursor;
      const result = await getFilteredSessions(filters);
      setSessions((prev) => [...prev, ...result.sessions]);
      setNextCursor(result.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, buildFilters]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isLoadingMore && !isPending) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, isLoadingMore, isPending, loadMore]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sessions..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="flashcard">Flashcard</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
          </SelectContent>
        </Select>

        <Select value={courseId} onValueChange={handleCourseChange}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span
                  className="inline-block h-2 w-2 rounded-full mr-1.5"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={handleDateChange}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger size="sm" className="ml-auto">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="longest">Longest first</SelectItem>
            <SelectItem value="shortest">Shortest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isPending ? (
        <SkeletonRows />
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sessions match your filters</p>
        </div>
      ) : (
        <div className="border rounded-[10px] overflow-hidden divide-y divide-border">
          {sessions.map((session) => {
            const isActive = !session.completedAt;
            const color = session.courseColor ?? "#6366f1";
            const title = session.summary || session.deckName || "Study Session";

            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                {/* Color dot */}
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />

                {/* Title + breadcrumb */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{title}</div>
                  {session.courseName && (
                    <div className="text-xs text-muted-foreground truncate">
                      {session.courseName}
                      {session.deckName && (
                        <>
                          <span className="mx-1 text-muted-foreground/40">&rsaquo;</span>
                          {session.deckName}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Mode pill */}
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full border bg-muted/30 text-muted-foreground capitalize shrink-0">
                  {session.mode}
                </span>

                {/* Duration pill */}
                {session.duration !== null && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full border bg-muted/30 text-muted-foreground shrink-0">
                    {formatDuration(session.duration)}
                  </span>
                )}

                {/* Status pill */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border shrink-0 ${
                    isActive
                      ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                      : "text-green-400 bg-green-500/10 border-green-500/20"
                  }`}
                >
                  {isActive ? "Active" : "Completed"}
                </span>

                {/* Cards / questions count */}
                {session.cardsReviewed > 0 && (
                  <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
                    {session.cardsReviewed} cards
                  </span>
                )}
                {session.questionsAnswered > 0 && (
                  <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
                    {session.questionsAnswered} questions
                  </span>
                )}

                {/* Date */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(session.startedAt)}
                </span>

                {/* Chevron */}
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Load more spinner */}
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} />
    </div>
  );
}
