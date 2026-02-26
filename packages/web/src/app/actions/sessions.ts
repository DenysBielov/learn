"use server";

import { z } from "zod";
import { getDb } from "@flashcards/database";
import { studySessions, sessionActivities, flashcardResults, quizResults, courses, decks, quizzes } from "@flashcards/database/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, count, gte, gt, lt, asc, isNull, isNotNull, inArray } from "drizzle-orm";

export async function getSessions() {
  const { userId } = await requireAuth();
  const db = getDb();

  const sessions = db.select().from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.discardedAt)))
    .orderBy(desc(studySessions.startedAt))
    .all();

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);

  const allActivities = db.select().from(sessionActivities)
    .where(inArray(sessionActivities.sessionId, sessionIds))
    .all();

  const allDeckIds = [...new Set(allActivities.filter(a => a.deckId).map(a => a.deckId!))];
  const deckNameMap = new Map<number, string>();
  if (allDeckIds.length > 0) {
    const deckRows = db.select({ id: decks.id, name: decks.name }).from(decks)
      .where(inArray(decks.id, allDeckIds)).all();
    for (const d of deckRows) deckNameMap.set(d.id, d.name);
  }

  const allCourseIds = [...new Set(sessions.filter(s => s.courseId).map(s => s.courseId!))];
  const courseNameMap = new Map<number, string>();
  if (allCourseIds.length > 0) {
    const courseRows = db.select({ id: courses.id, name: courses.name }).from(courses)
      .where(inArray(courses.id, allCourseIds)).all();
    for (const c of courseRows) courseNameMap.set(c.id, c.name);
  }

  const cardCounts = db.select({
    sessionId: flashcardResults.sessionId,
    count: count(),
  }).from(flashcardResults)
    .where(inArray(flashcardResults.sessionId, sessionIds))
    .groupBy(flashcardResults.sessionId)
    .all();
  const cardCountMap = new Map(cardCounts.map(c => [c.sessionId, c.count]));

  const quizCounts = db.select({
    sessionId: quizResults.sessionId,
    count: count(),
  }).from(quizResults)
    .where(inArray(quizResults.sessionId, sessionIds))
    .groupBy(quizResults.sessionId)
    .all();
  const quizCountMap = new Map(quizCounts.map(c => [c.sessionId, c.count]));

  return sessions.map(session => {
    const activities = allActivities.filter(a => a.sessionId === session.id);
    const deckIds = [...new Set(activities.filter(a => a.deckId).map(a => a.deckId!))];
    const deckNames = deckIds.map(id => deckNameMap.get(id)).filter(Boolean);

    return {
      ...session,
      courseName: session.courseId ? courseNameMap.get(session.courseId) ?? null : null,
      deckNames,
      cardsReviewed: cardCountMap.get(session.id) ?? 0,
      questionsAnswered: quizCountMap.get(session.id) ?? 0,
    };
  });
}

const MAX_SESSION_MINUTES = 240; // Cap at 4h to exclude sessions left open by accident

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getSessionStats() {
  const { userId } = await requireAuth();
  const db = getDb();

  const allSessions = db.select().from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.discardedAt)))
    .all();

  const totalSessions = allSessions.length;

  // Duration stats: only completed sessions, capped to avoid outliers
  let completedCount = 0;
  let totalMinutes = 0;
  for (const s of allSessions) {
    if (s.startedAt && s.completedAt) {
      completedCount++;
      const raw = (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
      totalMinutes += Math.min(raw, MAX_SESSION_MINUTES);
    }
  }

  // Today: sessions started or completed today, or currently active
  const today = new Date();
  const todayStr = today.toDateString();
  const todaySessions = allSessions.filter(s => {
    if (new Date(s.startedAt).toDateString() === todayStr) return true;
    if (s.completedAt && new Date(s.completedAt).toDateString() === todayStr) return true;
    if (!s.completedAt) return true; // active sessions count for today
    return false;
  }).length;

  // Streak: consecutive days where a completed session was active
  // Multi-day sessions fill every day they spanned (start→completion)
  const sessionDates = new Set<string>();
  for (const s of allSessions) {
    if (!s.completedAt) continue; // only completed sessions count for streak
    const start = new Date(s.startedAt);
    const end = new Date(s.completedAt);
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      sessionDates.add(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  let streak = 0;
  const todayKey = toDateKey(today);

  // Start from today if there's a session today, otherwise from yesterday
  let checkDate = new Date(today);
  if (!sessionDates.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = toDateKey(checkDate);
    if (sessionDates.has(key)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalSessions,
    totalMinutes: Math.round(totalMinutes),
    avgMinutes: completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0,
    todaySessions,
    streak,
  };
}

export async function getSession(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const session = db.select().from(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .get();

  if (!session) return null;

  const course = session.courseId
    ? db.select().from(courses).where(eq(courses.id, session.courseId)).get()
    : null;

  const activities = db.select().from(sessionActivities)
    .where(eq(sessionActivities.sessionId, session.id))
    .orderBy(asc(sessionActivities.startedAt))
    .all();

  const allDeckIds = [...new Set(activities.filter(a => a.deckId).map(a => a.deckId!))];
  const deckNameMap = new Map<number, string>();
  if (allDeckIds.length > 0) {
    const deckRows = db.select({ id: decks.id, name: decks.name }).from(decks)
      .where(inArray(decks.id, allDeckIds)).all();
    for (const d of deckRows) deckNameMap.set(d.id, d.name);
  }

  const allQuizIds = [...new Set(activities.filter(a => a.quizId).map(a => a.quizId!))];
  const quizNameMap = new Map<number, string>();
  if (allQuizIds.length > 0) {
    const quizRows = db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes)
      .where(inArray(quizzes.id, allQuizIds)).all();
    for (const q of quizRows) quizNameMap.set(q.id, q.title);
  }

  const activityIds = activities.map(a => a.id);
  const cardCounts = activityIds.length > 0 ? db.select({
    activityId: flashcardResults.activityId,
    count: count(),
  }).from(flashcardResults)
    .where(inArray(flashcardResults.activityId, activityIds))
    .groupBy(flashcardResults.activityId)
    .all() : [];
  const cardCountMap = new Map(cardCounts.map(c => [c.activityId, c.count]));

  const questionCounts = activityIds.length > 0 ? db.select({
    activityId: quizResults.activityId,
    count: count(),
  }).from(quizResults)
    .where(inArray(quizResults.activityId, activityIds))
    .groupBy(quizResults.activityId)
    .all() : [];
  const questionCountMap = new Map(questionCounts.map(c => [c.activityId, c.count]));

  const enrichedActivities = activities.map(activity => ({
    ...activity,
    deckName: activity.deckId ? deckNameMap.get(activity.deckId) ?? null : null,
    quizName: activity.quizId ? quizNameMap.get(activity.quizId) ?? null : null,
    cardCount: cardCountMap.get(activity.id) ?? 0,
    questionCount: questionCountMap.get(activity.id) ?? 0,
  }));

  const cardReviews = db.select().from(flashcardResults)
    .where(eq(flashcardResults.sessionId, session.id))
    .all();

  const quizAnswersList = db.select().from(quizResults)
    .where(eq(quizResults.sessionId, session.id))
    .all();

  const relatedSessions = session.courseId
    ? db.select().from(studySessions)
        .where(and(
          eq(studySessions.userId, userId),
          eq(studySessions.courseId, session.courseId),
          isNull(studySessions.discardedAt),
        ))
        .orderBy(desc(studySessions.startedAt))
        .limit(5)
        .all()
        .filter(s => s.id !== session.id)
    : [];

  return {
    ...session,
    courseName: course?.name ?? null,
    activities: enrichedActivities,
    cardReviews,
    quizAnswers: quizAnswersList,
    relatedSessions: relatedSessions.map(s => ({
      ...s,
      courseName: course?.name ?? null,
    })),
  };
}

export async function getHeatmapData() {
  const { userId } = await requireAuth();
  const db = getDb();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const sessions = db.select({
    startedAt: studySessions.startedAt,
    completedAt: studySessions.completedAt,
    courseId: studySessions.courseId,
  }).from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      gte(studySessions.startedAt, oneYearAgo),
      isNull(studySessions.discardedAt),
    ))
    .all();

  const userCourses = db.select({
    id: courses.id,
    name: courses.name,
    color: courses.color,
  }).from(courses)
    .where(eq(courses.userId, userId))
    .all();

  const courseMap = new Map(userCourses.map(c => [c.id, c]));

  const dayMap: Record<string, {
    totalMinutes: number;
    courses: Record<number, { name: string; color: string; minutes: number }>;
  }> = {};

  function addMinutesToDay(dateKey: string, minutes: number, courseId: number | null) {
    if (!dayMap[dateKey]) {
      dayMap[dateKey] = { totalMinutes: 0, courses: {} };
    }
    dayMap[dateKey].totalMinutes += minutes;
    if (courseId) {
      const course = courseMap.get(courseId);
      if (course) {
        if (dayMap[dateKey].courses[courseId]) {
          dayMap[dateKey].courses[courseId].minutes += minutes;
        } else {
          dayMap[dateKey].courses[courseId] = { name: course.name, color: course.color, minutes };
        }
      }
    }
  }

  for (const session of sessions) {
    const start = new Date(session.startedAt);
    const end = session.completedAt ? new Date(session.completedAt) : null;

    if (!end) {
      // Active session: default 30min on start day
      addMinutesToDay(toDateKey(start), 30, session.courseId);
      continue;
    }

    // Split across days if session spans midnight
    let cursor = new Date(start);
    while (cursor < end) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      const segmentEnd = dayEnd < end ? new Date(dayEnd.getTime() + 1) : end;
      const minutes = (segmentEnd.getTime() - cursor.getTime()) / 60000;
      addMinutesToDay(toDateKey(cursor), minutes, session.courseId);
      cursor = new Date(dayEnd.getTime() + 1); // start of next day
    }
  }

  return { dayMap, courses: userCourses };
}

export type SessionFilters = {
  query?: string;
  courseId?: number;
  dateRange?: "today" | "week" | "month" | "year";
  status?: "active" | "completed" | "discarded";
  sortBy?: "date" | "duration";
  sortOrder?: "asc" | "desc";
  cursor?: number;
  limit?: number;
};

export async function getFilteredSessions(filters: SessionFilters) {
  const filtersSchema = z.object({
    query: z.string().max(200).optional(),
    courseId: z.number().int().positive().optional(),
    dateRange: z.enum(["today", "week", "month", "year"]).optional(),
    status: z.enum(["active", "completed", "discarded"]).optional(),
    sortBy: z.enum(["date", "duration"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    cursor: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  });
  const validated = filtersSchema.parse(filters);

  const { userId } = await requireAuth();
  const db = getDb();
  const limit = validated.limit ?? 20;

  // Build WHERE conditions
  const conditions = [eq(studySessions.userId, userId)];

  if (validated.courseId) {
    conditions.push(eq(studySessions.courseId, validated.courseId));
  }

  if (validated.dateRange) {
    const now = new Date();
    let rangeStart: Date;
    switch (validated.dateRange) {
      case "today":
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - 7);
        break;
      case "month":
        rangeStart = new Date(now);
        rangeStart.setMonth(rangeStart.getMonth() - 1);
        break;
      case "year":
        rangeStart = new Date(now);
        rangeStart.setFullYear(rangeStart.getFullYear() - 1);
        break;
    }
    conditions.push(gte(studySessions.startedAt, rangeStart));
  }

  if (validated.status === "discarded") {
    conditions.push(isNotNull(studySessions.discardedAt));
  } else {
    conditions.push(isNull(studySessions.discardedAt));
    if (validated.status === "active") {
      conditions.push(isNull(studySessions.completedAt));
    } else if (validated.status === "completed") {
      conditions.push(isNotNull(studySessions.completedAt));
    }
  }

  // Cursor-based pagination
  if (validated.cursor) {
    const cursorSession = db.select({ startedAt: studySessions.startedAt })
      .from(studySessions)
      .where(eq(studySessions.id, validated.cursor))
      .get();

    if (cursorSession) {
      const sortOrder = validated.sortOrder ?? "desc";
      if (sortOrder === "desc") {
        conditions.push(lt(studySessions.startedAt, cursorSession.startedAt));
      } else {
        conditions.push(gt(studySessions.startedAt, cursorSession.startedAt));
      }
    }
  }

  const orderDir = validated.sortOrder === "asc" ? asc : desc;

  // For duration sorting we need to sort client-side after enrichment,
  // so always fetch by date for the DB query
  const sessions = db.select().from(studySessions)
    .where(and(...conditions))
    .orderBy(orderDir(studySessions.startedAt))
    .limit(limit + 1)
    .all();

  const hasMore = sessions.length > limit;
  const sliced = hasMore ? sessions.slice(0, limit) : sessions;

  // Batch-load activities and deck names
  const sessionIds = sliced.map(s => s.id);
  const allActivities = sessionIds.length > 0 ? db.select().from(sessionActivities)
    .where(inArray(sessionActivities.sessionId, sessionIds))
    .all() : [];

  const allDeckIds = [...new Set(allActivities.filter(a => a.deckId).map(a => a.deckId!))];
  const deckNameMap = new Map<number, string>();
  if (allDeckIds.length > 0) {
    const deckRows = db.select({ id: decks.id, name: decks.name }).from(decks)
      .where(inArray(decks.id, allDeckIds)).all();
    for (const d of deckRows) deckNameMap.set(d.id, d.name);
  }

  // Batch-load courses
  const allCourseIds = [...new Set(sliced.filter(s => s.courseId).map(s => s.courseId!))];
  const courseNameMap = new Map<number, { name: string; color: string }>();
  if (allCourseIds.length > 0) {
    const courseRows = db.select({ id: courses.id, name: courses.name, color: courses.color }).from(courses)
      .where(inArray(courses.id, allCourseIds)).all();
    for (const c of courseRows) courseNameMap.set(c.id, { name: c.name, color: c.color });
  }

  // Batch-load card/quiz counts
  const cardCounts = sessionIds.length > 0 ? db.select({
    sessionId: flashcardResults.sessionId,
    count: count(),
  }).from(flashcardResults)
    .where(inArray(flashcardResults.sessionId, sessionIds))
    .groupBy(flashcardResults.sessionId)
    .all() : [];
  const cardCountMap = new Map(cardCounts.map(c => [c.sessionId, c.count]));

  const quizCounts = sessionIds.length > 0 ? db.select({
    sessionId: quizResults.sessionId,
    count: count(),
  }).from(quizResults)
    .where(inArray(quizResults.sessionId, sessionIds))
    .groupBy(quizResults.sessionId)
    .all() : [];
  const quizCountMap = new Map(quizCounts.map(c => [c.sessionId, c.count]));

  const enriched = sliced.map(session => {
    const activities = allActivities.filter(a => a.sessionId === session.id);
    const sessionDeckIds = [...new Set(activities.filter(a => a.deckId).map(a => a.deckId!))];
    const deckNames = sessionDeckIds.map(id => deckNameMap.get(id)).filter(Boolean) as string[];
    const courseData = session.courseId ? courseNameMap.get(session.courseId) : null;

    const duration = session.startedAt && session.completedAt
      ? (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
      : null;

    return {
      ...session,
      courseName: courseData?.name ?? null,
      courseColor: courseData?.color ?? null,
      deckNames,
      cardsReviewed: cardCountMap.get(session.id) ?? 0,
      questionsAnswered: quizCountMap.get(session.id) ?? 0,
      duration,
    };
  });

  // Text search filter
  let filtered = enriched;
  if (validated.query) {
    const q = validated.query.toLowerCase();
    filtered = enriched.filter(s =>
      (s.summary && s.summary.toLowerCase().includes(q)) ||
      (s.courseName && s.courseName.toLowerCase().includes(q)) ||
      (s.deckNames?.some(n => n.toLowerCase().includes(q))) ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    );
  }

  // Duration sorting (client-side since it's computed)
  if (validated.sortBy === "duration") {
    filtered.sort((a, b) => {
      const aDur = a.duration ?? 0;
      const bDur = b.duration ?? 0;
      return validated.sortOrder === "asc" ? aDur - bDur : bDur - aDur;
    });
  }

  const nextCursor = hasMore && sliced.length > 0
    ? sliced[sliced.length - 1].id
    : null;

  return { sessions: filtered, nextCursor };
}

export async function getUserCourses() {
  const { userId } = await requireAuth();
  const db = getDb();

  return db.select({
    id: courses.id,
    name: courses.name,
    color: courses.color,
  }).from(courses)
    .where(eq(courses.userId, userId))
    .all();
}
