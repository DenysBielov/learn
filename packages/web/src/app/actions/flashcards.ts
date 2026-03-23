"use server";

import { z } from "zod";
import { getDb, writeTransaction } from "@flashcards/database";
import { flashcards, flashcardResults, studySessions, sessionActivities, decks, courses, quizzes, courseSteps, stepProgress, learningMaterials, materials, quizResults } from "@flashcards/database/schema";
import { createFlashcardSchema } from "@flashcards/database/validation";
import { and, eq, inArray, isNull, isNotNull, desc, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calculateSm2, type Sm2Rating } from "@/lib/sm2";
import { requireAuth } from "@/lib/auth";
import { getDescendantDeckIds } from "@flashcards/database/courses";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";

// SECURITY: Callers MUST pre-filter cards by userId (e.g., via deck ownership).
// This helper trusts that the input cards already belong to the authenticated user.
function attachLearningMaterials<T extends { id: number }>(
  db: ReturnType<typeof getDb>,
  cards: T[]
): (T & { learningMaterials: typeof learningMaterials.$inferSelect[] })[] {
  if (cards.length === 0) return [];
  const ids = cards.map(c => c.id);
  const materials = db.select().from(learningMaterials)
    .where(inArray(learningMaterials.flashcardId, ids))
    .orderBy(learningMaterials.position)
    .all();
  const byCardId = new Map<number, typeof materials>();
  for (const m of materials) {
    const arr = byCardId.get(m.flashcardId!) || [];
    arr.push(m);
    byCardId.set(m.flashcardId!, arr);
  }
  return cards.map(c => ({ ...c, learningMaterials: byCardId.get(c.id) || [] }));
}

export async function createFlashcard(formData: FormData) {
  const { userId } = await requireAuth();
  const rawSourceMaterialId = formData.get("sourceMaterialId");
  const parsed = createFlashcardSchema.parse({
    deckId: Number(formData.get("deckId")),
    front: formData.get("front"),
    back: formData.get("back"),
    sourceMaterialId: rawSourceMaterialId ? Number(rawSourceMaterialId) : undefined,
  });

  const sanitized = {
    ...parsed,
    front: sanitizeMarkdownImageUrls(parsed.front),
    back: sanitizeMarkdownImageUrls(parsed.back),
  };

  const db = getDb();
  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, sanitized.deckId), eq(decks.userId, userId))).get();
  if (!deck) throw new Error("Deck not found");

  if (sanitized.sourceMaterialId) {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, sanitized.sourceMaterialId)).get();
    if (!material || material.userId !== userId) {
      throw new Error("Source material not found or not owned by user");
    }
  }

  writeTransaction(db, () =>
    db.insert(flashcards).values(sanitized).run()
  );

  revalidatePath(`/decks/${sanitized.deckId}`);
}

export async function deleteFlashcard(id: number, deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  const card = db.select({ id: flashcards.id }).from(flashcards)
    .innerJoin(decks, eq(flashcards.deckId, decks.id))
    .where(and(eq(flashcards.id, id), eq(decks.userId, userId))).get();
  if (!card) throw new Error("Flashcard not found");

  writeTransaction(db, () =>
    db.delete(flashcards).where(eq(flashcards.id, id)).run()
  );
  revalidatePath(`/decks/${deckId}`);
}

const tagIdsSchema = z.array(z.number().int().positive()).max(50).optional();

export async function getDueFlashcards(deckId?: number, tagIds?: number[]) {
  const { userId } = await requireAuth();
  const validTagIds = tagIdsSchema.parse(tagIds);
  const db = getDb();
  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  const tagFilter = validTagIds?.length ? sql` AND ${flashcards.id} IN (
    SELECT ft.flashcard_id FROM flashcard_tag ft
    JOIN tag t ON ft.tag_id = t.id
    WHERE t.id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`,`)})
      AND t.user_id = ${userId}
    GROUP BY ft.flashcard_id
    HAVING COUNT(DISTINCT ft.tag_id) = ${validTagIds.length}
  )` : sql``;

  if (deckId) {
    const cards = db.select().from(flashcards)
      .where(sql`${flashcards.nextReviewAt} <= ${nowSeconds} AND ${flashcards.deckId} = ${deckId} AND ${flashcards.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId})${tagFilter}`)
      .all();
    return attachLearningMaterials(db, cards);
  }

  const cards = db.select().from(flashcards)
    .where(sql`${flashcards.nextReviewAt} <= ${nowSeconds} AND ${flashcards.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId})${tagFilter}`)
    .all();
  return attachLearningMaterials(db, cards);
}

export async function getAllFlashcards(deckId: number, tagIds?: number[]) {
  const { userId } = await requireAuth();
  const validTagIds = tagIdsSchema.parse(tagIds);
  const db = getDb();

  const tagFilter = validTagIds?.length ? sql` AND ${flashcards.id} IN (
    SELECT ft.flashcard_id FROM flashcard_tag ft
    JOIN tag t ON ft.tag_id = t.id
    WHERE t.id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`,`)})
      AND t.user_id = ${userId}
    GROUP BY ft.flashcard_id
    HAVING COUNT(DISTINCT ft.tag_id) = ${validTagIds.length}
  )` : sql``;

  const cards = db.select().from(flashcards)
    .where(sql`${flashcards.deckId} = ${deckId} AND ${flashcards.deckId} IN (SELECT id FROM deck WHERE user_id = ${userId})${tagFilter}`)
    .all();
  return attachLearningMaterials(db, cards);
}

export async function reviewFlashcard(
  flashcardId: number,
  sessionId: number | null,
  activityId: number | null,
  rating: Sm2Rating,
  timeSpentMs: number
) {
  if (sessionId !== null) z.number().int().positive().parse(sessionId);
  if (activityId !== null) z.number().int().positive().parse(activityId);
  const { userId } = await requireAuth();
  const validatedRating = z.enum(["again", "hard", "good", "easy"]).parse(rating);
  const db = getDb();
  const correct = validatedRating !== "again";

  writeTransaction(db, () => {
    const card = db.select({
      id: flashcards.id,
      easeFactor: flashcards.easeFactor,
      interval: flashcards.interval,
      repetitions: flashcards.repetitions,
    }).from(flashcards)
      .innerJoin(decks, eq(flashcards.deckId, decks.id))
      .where(and(eq(flashcards.id, flashcardId), eq(decks.userId, userId)))
      .get();
    if (!card) throw new Error("Flashcard not found");

    if (sessionId !== null) {
      const session = db.select({ id: studySessions.id, discardedAt: studySessions.discardedAt }).from(studySessions)
        .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
        .get();
      if (!session) throw new Error("Session not found");
      if (session.discardedAt) throw new Error("Session is discarded");
    }

    if (activityId !== null) {
      const activity = db.select({ id: sessionActivities.id, sessionId: sessionActivities.sessionId })
        .from(sessionActivities)
        .innerJoin(studySessions, eq(sessionActivities.sessionId, studySessions.id))
        .where(and(
          eq(sessionActivities.id, activityId),
          eq(studySessions.userId, userId),
        ))
        .get();
      if (!activity) throw new Error("Activity not found");
      if (sessionId !== null && activity.sessionId !== sessionId) {
        throw new Error("Activity does not belong to the specified session");
      }
    }

    const sm2Result = calculateSm2(
      { easeFactor: card.easeFactor, interval: card.interval, repetitions: card.repetitions },
      validatedRating
    );

    db.update(flashcards)
      .set({
        easeFactor: sm2Result.easeFactor,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        nextReviewAt: sm2Result.nextReviewAt,
      })
      .where(eq(flashcards.id, flashcardId))
      .run();

    db.insert(flashcardResults).values({
      sessionId: sessionId ?? null,
      activityId: activityId ?? null,
      flashcardId,
      correct,
      userAnswer: validatedRating,
      timeSpentMs,
    }).run();
  });
}

export async function completeStudySession(sessionId: number, completedAt?: Date) {
  const { userId } = await requireAuth();
  const db = getDb();
  writeTransaction(db, () => {
    const session = db.select({
      id: studySessions.id,
      startedAt: studySessions.startedAt,
      completedAt: studySessions.completedAt,
      discardedAt: studySessions.discardedAt,
    }).from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .get();
    if (!session) throw new Error("Session not found");
    if (session.completedAt) throw new Error("Session is already completed");
    if (session.discardedAt) throw new Error("Session is discarded");

    const resolvedCompletedAt = completedAt ?? new Date();

    if (completedAt) {
      if (resolvedCompletedAt <= session.startedAt) {
        throw new Error("Completed time must be after session start time");
      }
      if (resolvedCompletedAt > new Date()) {
        throw new Error("Completed time must not be in the future");
      }
    }

    db.update(studySessions)
      .set({ completedAt: resolvedCompletedAt })
      .where(eq(studySessions.id, sessionId))
      .run();

    // Complete any open activities in this session
    db.update(sessionActivities)
      .set({ completedAt: resolvedCompletedAt })
      .where(and(
        eq(sessionActivities.sessionId, sessionId),
        isNull(sessionActivities.completedAt),
      ))
      .run();

    // Auto-complete quiz steps for any quiz activities in this session
    const quizActivities = db.select({ quizId: sessionActivities.quizId })
      .from(sessionActivities)
      .where(and(
        eq(sessionActivities.sessionId, sessionId),
        eq(sessionActivities.type, "quiz_answer"),
        isNotNull(sessionActivities.quizId),
      ))
      .all();

    for (const qa of quizActivities) {
      if (!qa.quizId) continue;
      const step = db.select({ stepId: courseSteps.id })
        .from(courseSteps)
        .innerJoin(courses, eq(courseSteps.courseId, courses.id))
        .where(and(
          eq(courseSteps.quizId, qa.quizId),
          eq(courses.userId, userId),
        ))
        .get();

      if (step) {
        const existing = db.select({ id: stepProgress.id })
          .from(stepProgress)
          .where(and(
            eq(stepProgress.courseStepId, step.stepId),
            eq(stepProgress.userId, userId),
          )).get();

        if (existing) {
          db.update(stepProgress)
            .set({ isCompleted: true, completedAt: new Date() })
            .where(eq(stepProgress.id, existing.id))
            .run();
        } else {
          db.insert(stepProgress).values({
            courseStepId: step.stepId,
            userId,
            isCompleted: true,
            completedAt: new Date(),
          }).run();
        }
      }
    }
  });
}

export async function discardSession(sessionId: number) {
  z.number().int().positive().parse(sessionId);
  const { userId } = await requireAuth();
  const db = getDb();
  writeTransaction(db, () => {
    const session = db.select({ id: studySessions.id, discardedAt: studySessions.discardedAt })
      .from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .get();
    if (!session) throw new Error("Session not found");
    if (session.discardedAt) throw new Error("Session is already discarded");

    db.update(studySessions)
      .set({ discardedAt: new Date() })
      .where(eq(studySessions.id, sessionId))
      .run();
  });
}

export async function createSession(courseId?: number, title?: string) {
  if (courseId !== undefined) z.number().int().positive().parse(courseId);
  if (title !== undefined) z.string().min(1).max(200).parse(title);
  const { userId } = await requireAuth();
  const db = getDb();

  if (courseId) {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");
  }

  return writeTransaction(db, () => {
    const existing = db.select().from(studySessions)
      .where(and(
        eq(studySessions.userId, userId),
        isNull(studySessions.completedAt),
        isNull(studySessions.discardedAt),
      ))
      .orderBy(desc(studySessions.startedAt))
      .limit(1)
      .get();
    if (existing) return existing;

    const [session] = db.insert(studySessions).values({
      userId,
      courseId: courseId ?? null,
      title: title ?? null,
    }).returning().all();
    return session;
  });
}

export async function getActiveSession() {
  const { userId } = await requireAuth();
  const db = getDb();
  return db.select().from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      isNull(studySessions.completedAt),
      isNull(studySessions.discardedAt),
    ))
    .orderBy(desc(studySessions.startedAt))
    .limit(1)
    .get() ?? null;
}

export async function getActiveActivity(sessionId: number) {
  z.number().int().positive().parse(sessionId);
  const { userId } = await requireAuth();
  const db = getDb();
  return db.select({
    id: sessionActivities.id,
    type: sessionActivities.type,
    deckId: sessionActivities.deckId,
    quizId: sessionActivities.quizId,
    materialId: sessionActivities.materialId,
    startedAt: sessionActivities.startedAt,
  })
    .from(sessionActivities)
    .innerJoin(studySessions, eq(sessionActivities.sessionId, studySessions.id))
    .where(and(
      eq(sessionActivities.sessionId, sessionId),
      eq(studySessions.userId, userId),
      isNull(sessionActivities.completedAt),
    ))
    .orderBy(desc(sessionActivities.startedAt))
    .limit(1)
    .get() ?? null;
}

export async function startActivity(
  sessionId: number,
  type: "flashcard_review" | "quiz_answer" | "reading",
  opts: { deckId?: number; quizId?: number; materialId?: number }
) {
  z.number().int().positive().parse(sessionId);
  z.enum(["flashcard_review", "quiz_answer", "reading"]).parse(type);
  if (opts.deckId !== undefined) z.number().int().positive().parse(opts.deckId);
  if (opts.quizId !== undefined) z.number().int().positive().parse(opts.quizId);
  if (opts.materialId !== undefined) z.number().int().positive().parse(opts.materialId);
  const { userId } = await requireAuth();
  const db = getDb();

  if (type === "quiz_answer" && !opts.quizId) throw new Error("quiz_answer requires quizId");
  if (type === "reading" && !opts.materialId) throw new Error("reading requires materialId");

  if (opts.deckId) {
    const deck = db.select({ id: decks.id }).from(decks)
      .where(and(eq(decks.id, opts.deckId), eq(decks.userId, userId))).get();
    if (!deck) throw new Error("Deck not found");
  }
  if (opts.quizId) {
    const quiz = db.select({ id: quizzes.id }).from(quizzes)
      .where(and(eq(quizzes.id, opts.quizId), eq(quizzes.userId, userId))).get();
    if (!quiz) throw new Error("Quiz not found");
  }
  if (opts.materialId) {
    const material = db.select({ id: materials.id }).from(materials)
      .where(and(eq(materials.id, opts.materialId), eq(materials.userId, userId))).get();
    if (!material) throw new Error("Material not found");
  }

  const [activity] = writeTransaction(db, () => {
    const session = db.select({ id: studySessions.id })
      .from(studySessions)
      .where(and(
        eq(studySessions.id, sessionId),
        eq(studySessions.userId, userId),
        isNull(studySessions.completedAt),
        isNull(studySessions.discardedAt),
      ))
      .get();
    if (!session) throw new Error("Session not found or not active");

    db.update(sessionActivities)
      .set({ completedAt: new Date() })
      .where(and(
        eq(sessionActivities.sessionId, sessionId),
        isNull(sessionActivities.completedAt),
      ))
      .run();

    return db.insert(sessionActivities).values({
      sessionId,
      type,
      deckId: type === "quiz_answer" ? null : (opts.deckId ?? null),
      quizId: opts.quizId ?? null,
      materialId: opts.materialId ?? null,
    }).returning().all();
  });
  return activity;
}

export async function completeActivity(activityId: number) {
  z.number().int().positive().parse(activityId);
  const { userId } = await requireAuth();
  const db = getDb();

  const activity = db.select({
    id: sessionActivities.id,
    sessionId: sessionActivities.sessionId,
  })
    .from(sessionActivities)
    .innerJoin(studySessions, eq(sessionActivities.sessionId, studySessions.id))
    .where(and(
      eq(sessionActivities.id, activityId),
      eq(studySessions.userId, userId),
    ))
    .get();
  if (!activity) throw new Error("Activity not found");

  writeTransaction(db, () =>
    db.update(sessionActivities)
      .set({ completedAt: new Date() })
      .where(eq(sessionActivities.id, activityId))
      .run()
  );
}


interface FlashcardRow {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_at: number;
  created_at: number;
}

function mapFlashcardRow(row: FlashcardRow) {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    easeFactor: row.ease_factor,
    interval: row.interval,
    repetitions: row.repetitions,
    nextReviewAt: new Date(row.next_review_at * 1000),
    createdAt: new Date(row.created_at * 1000),
  };
}

export async function getDueFlashcardsForActiveCourses(tagIds?: number[]) {
  const { userId } = await requireAuth();
  const validTagIds = tagIdsSchema.parse(tagIds);
  const db = getDb();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const tagFilter = validTagIds?.length ? sql`
    AND f.id IN (
      SELECT ft.flashcard_id FROM flashcard_tag ft
      JOIN tag t ON ft.tag_id = t.id
      WHERE t.id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`,`)})
        AND t.user_id = ${userId}
      GROUP BY ft.flashcard_id
      HAVING COUNT(DISTINCT ft.tag_id) = ${validTagIds.length}
    )` : sql``;

  const cards = db.all<FlashcardRow>(sql`
    WITH RECURSIVE active_tree AS (
      SELECT id, 1 AS depth FROM course WHERE is_active = 1 AND user_id = ${userId}
      UNION ALL
      SELECT c.id, at.depth + 1 FROM course c
      JOIN active_tree at ON c.parent_id = at.id
      WHERE at.depth < 10
    ),
    active_decks AS (
      SELECT DISTINCT cd.deck_id FROM course_deck cd
      JOIN active_tree at ON cd.course_id = at.id
    )
    SELECT f.* FROM flashcard f
    JOIN active_decks ad ON f.deck_id = ad.deck_id
    WHERE f.next_review_at <= ${nowSeconds}
    ${tagFilter}
  `).map(mapFlashcardRow);
  return attachLearningMaterials(db, cards);
}

export async function getCourseFlashcards(
  courseId: number,
  subMode: "review_due" | "sequential" | "random" | "weakest_first"
) {
  const { userId } = await requireAuth();
  const db = getDb();
  const deckIds = getDescendantDeckIds(db, courseId, userId);
  if (deckIds.length === 0) return [];

  const deckIdList = deckIds.join(",");
  const now = Math.floor(Date.now() / 1000);

  if (subMode === "review_due") {
    const cards = db.all<FlashcardRow>(sql`
      SELECT * FROM flashcard
      WHERE deck_id IN (${sql.raw(deckIdList)})
      AND next_review_at <= ${now}
    `).map(mapFlashcardRow);
    return attachLearningMaterials(db, cards);
  }

  if (subMode === "sequential") {
    const cards = db.all<FlashcardRow>(sql`
      SELECT f.* FROM flashcard f
      JOIN course_deck cd ON f.deck_id = cd.deck_id
      WHERE f.deck_id IN (${sql.raw(deckIdList)})
      AND f.next_review_at <= ${now}
      ORDER BY cd.position, f.id
    `).map(mapFlashcardRow);
    return attachLearningMaterials(db, cards);
  }

  if (subMode === "random") {
    const cards = db.all<FlashcardRow>(sql`
      SELECT * FROM flashcard
      WHERE deck_id IN (${sql.raw(deckIdList)})
    `).map(mapFlashcardRow);
    return attachLearningMaterials(db, cards);
  }

  if (subMode === "weakest_first") {
    const cards = db.all<FlashcardRow>(sql`
      SELECT f.*
      FROM flashcard f
      LEFT JOIN flashcard_result fr ON fr.flashcard_id = f.id
      WHERE f.deck_id IN (${sql.raw(deckIdList)})
      GROUP BY f.id
      ORDER BY COALESCE(
        CAST(SUM(CASE WHEN fr.correct = 0 THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(COUNT(fr.id), 0),
        0.5
      ) DESC
    `).map(mapFlashcardRow);
    return attachLearningMaterials(db, cards);
  }

  return [];
}

const updateSessionNotesSchema = z.object({
  sessionId: z.number().int().positive(),
  notes: z.string().max(50_000),
});

export async function updateSessionNotes(sessionId: number, notes: string) {
  const parsed = updateSessionNotesSchema.parse({ sessionId, notes });
  const { userId } = await requireAuth();
  const db = getDb();
  writeTransaction(db, () =>
    db.update(studySessions)
      .set({ notes: parsed.notes })
      .where(and(eq(studySessions.id, parsed.sessionId), eq(studySessions.userId, userId)))
      .run()
  );
}

export async function getSessionHistory(deckId?: number, courseId?: number) {
  const parsed = z.object({
    deckId: z.number().int().positive().optional(),
    courseId: z.number().int().positive().optional(),
  }).parse({ deckId, courseId });
  const { userId } = await requireAuth();
  const db = getDb();

  if (!parsed.deckId && !parsed.courseId) return [];

  const whereClause = parsed.courseId
    ? sql`s.course_id = ${parsed.courseId} AND s.user_id = ${userId}`
    : sql`EXISTS (
        SELECT 1 FROM session_activity sa
        WHERE sa.session_id = s.id AND sa.deck_id = ${parsed.deckId}
      ) AND s.user_id = ${userId}`;

  type SessionRow = {
    id: number;
    started_at: number;
    completed_at: number | null;
    notes: string | null;
    item_count: number;
    correct_count: number;
    activity_type: string | null;
  };

  const rows = db.all<SessionRow>(sql`
    SELECT
      s.id, s.started_at, s.completed_at, s.notes,
      COALESCE(fc.cnt, 0) + COALESCE(qc.cnt, 0) AS item_count,
      COALESCE(fc.correct, 0) + COALESCE(qc.correct, 0) AS correct_count,
      (SELECT sa.type FROM session_activity sa WHERE sa.session_id = s.id LIMIT 1) AS activity_type
    FROM study_session s
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS cnt, SUM(correct) AS correct
      FROM flashcard_result GROUP BY session_id
    ) fc ON fc.session_id = s.id
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS cnt, SUM(correct) AS correct
      FROM quiz_result GROUP BY session_id
    ) qc ON qc.session_id = s.id
    WHERE ${whereClause} AND s.completed_at IS NOT NULL AND s.discarded_at IS NULL
    ORDER BY s.started_at DESC
    LIMIT 10
  `);

  return rows.map((r) => ({
    id: r.id,
    activityType: r.activity_type as "flashcard_review" | "quiz_answer" | "reading" | null,
    startedAt: new Date(r.started_at * 1000),
    completedAt: r.completed_at ? new Date(r.completed_at * 1000) : null,
    notes: r.notes,
    itemCount: r.item_count,
    correctCount: r.correct_count,
  }));
}
