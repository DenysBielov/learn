import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import type { AppDatabase } from "./index";

const ENTITY_LIMIT = 10_000;

/**
 * Deep-copy (fork) a course and all its content into a new user's account.
 * Runs inside a single SQLite transaction (caller must wrap with writeTransaction).
 */
export function forkCourse(
  db: AppDatabase,
  sourceCourseId: number,
  userId: number,
  authorName: string
): { newCourseId: number; newPublicId: string } {
  const now = new Date();

  // ── 1. Collect the full course tree (recursive) ──────────────────────
  const allCourses = db.all<{
    id: number;
    parent_id: number | null;
    name: string;
    description: string;
    color: string;
    is_active: number;
    position: number;
    estimated_hours: number | null;
    visibility: string;
    root_course_id: number | null;
    user_id: number;
  }>(sql`
    WITH RECURSIVE tree AS (
      SELECT * FROM course WHERE id = ${sourceCourseId}
      UNION ALL
      SELECT c.* FROM course c
      JOIN tree t ON c.parent_id = t.id
    )
    SELECT id, parent_id, name, description, color, is_active, position,
           estimated_hours, visibility, root_course_id, user_id
    FROM tree
  `);

  if (allCourses.length === 0) {
    throw new Error(`Course ${sourceCourseId} not found`);
  }

  const courseIds = allCourses.map((c) => c.id);
  const courseIdSet = new Set(courseIds);
  const courseIdList = courseIds.join(",");

  // ── 2. Collect all related entity IDs ────────────────────────────────

  // Course decks (deduplicated)
  const allCourseDecks = db.all<{ course_id: number; deck_id: number; position: number }>(
    sql.raw(`SELECT course_id, deck_id, position FROM course_deck WHERE course_id IN (${courseIdList})`)
  );
  const uniqueDeckIds = [...new Set(allCourseDecks.map((cd) => cd.deck_id))];

  // Course steps
  const allCourseSteps = db.all<{
    id: number; course_id: number; position: number;
    step_type: string; material_id: number | null; quiz_id: number | null;
  }>(
    sql.raw(`SELECT id, course_id, position, step_type, material_id, quiz_id FROM course_step WHERE course_id IN (${courseIdList})`)
  );

  // Materials from course steps
  const materialIdsFromSteps = allCourseSteps
    .filter((s) => s.material_id !== null)
    .map((s) => s.material_id!);

  // Quizzes from course steps
  const quizIdsFromSteps = allCourseSteps
    .filter((s) => s.quiz_id !== null)
    .map((s) => s.quiz_id!);

  // All materials
  const materialIds = [...new Set(materialIdsFromSteps)];
  const materialIdList = materialIds.length > 0 ? materialIds.join(",") : "0";

  // All quizzes
  const quizIds = [...new Set(quizIdsFromSteps)];
  const quizIdList = quizIds.length > 0 ? quizIds.join(",") : "0";

  // Decks
  const deckIdList = uniqueDeckIds.length > 0 ? uniqueDeckIds.join(",") : "0";

  // Flashcards
  const allFlashcards = db.all<{
    id: number; deck_id: number; front: string; back: string;
    source_material_id: number | null; created_at: number;
  }>(
    sql.raw(`SELECT id, deck_id, front, back, source_material_id, created_at FROM flashcard WHERE deck_id IN (${deckIdList})`)
  );
  const flashcardIds = allFlashcards.map((f) => f.id);
  const flashcardIdList = flashcardIds.length > 0 ? flashcardIds.join(",") : "0";

  // Quiz questions
  const allQuizQuestions = db.all<{
    id: number; deck_id: number | null; quiz_id: number;
    type: string; question: string; explanation: string | null;
    correct_answer: string | null; source_material_id: number | null;
    created_at: number;
  }>(
    sql.raw(`SELECT id, deck_id, quiz_id, type, question, explanation, correct_answer, source_material_id, created_at FROM quiz_question WHERE quiz_id IN (${quizIdList})`)
  );
  const questionIds = allQuizQuestions.map((q) => q.id);
  const questionIdList = questionIds.length > 0 ? questionIds.join(",") : "0";

  // Question options
  const allQuestionOptions = db.all<{
    id: number; question_id: number; option_text: string; is_correct: number;
  }>(
    sql.raw(`SELECT id, question_id, option_text, is_correct FROM question_option WHERE question_id IN (${questionIdList})`)
  );

  // ── 3. Count total entities and check limit ──────────────────────────
  const totalEntities =
    allCourses.length +
    uniqueDeckIds.length +
    materialIds.length +
    quizIds.length +
    allFlashcards.length +
    allQuizQuestions.length +
    allQuestionOptions.length +
    allCourseSteps.length +
    allCourseDecks.length;

  if (totalEntities > ENTITY_LIMIT) {
    throw new Error(
      `Fork would create ${totalEntities} entities, exceeding the ${ENTITY_LIMIT} limit`
    );
  }

  // ── 4. Fetch join-table data ─────────────────────────────────────────

  const allFlashcardTags = db.all<{ flashcard_id: number; tag_id: number }>(
    sql.raw(`SELECT flashcard_id, tag_id FROM flashcard_tag WHERE flashcard_id IN (${flashcardIdList})`)
  );

  const allQuestionTags = db.all<{ question_id: number; tag_id: number }>(
    sql.raw(`SELECT question_id, tag_id FROM question_tag WHERE question_id IN (${questionIdList})`)
  );

  const allMaterialTags = db.all<{ material_id: number; tag_id: number }>(
    sql.raw(`SELECT material_id, tag_id FROM material_tag WHERE material_id IN (${materialIdList})`)
  );

  const allMaterialDecks = db.all<{ material_id: number; deck_id: number }>(
    sql.raw(`SELECT material_id, deck_id FROM material_deck WHERE material_id IN (${materialIdList})`)
  );

  const allMaterialQuizzes = db.all<{ material_id: number; quiz_id: number }>(
    sql.raw(`SELECT material_id, quiz_id FROM material_quiz WHERE material_id IN (${materialIdList})`)
  );

  const allMaterialResources = db.all<{
    id: number; material_id: number; url: string;
    title: string | null; type: string; created_at: number;
  }>(
    sql.raw(`SELECT id, material_id, url, title, type, created_at FROM material_resource WHERE material_id IN (${materialIdList})`)
  );

  const allLearningMaterials = db.all<{
    id: number; flashcard_id: number | null; question_id: number | null;
    url: string; title: string | null; type: string; position: number;
    created_at: number;
  }>(
    sql.raw(`
      SELECT id, flashcard_id, question_id, url, title, type, position, created_at
      FROM learning_material
      WHERE flashcard_id IN (${flashcardIdList}) OR question_id IN (${questionIdList})
    `)
  );

  const allLearningDeps = db.all<{
    id: number; course_item_id: number | null; material_item_id: number | null;
    depends_on_course_id: number | null; depends_on_material_id: number | null;
  }>(
    sql.raw(`
      SELECT id, course_item_id, material_item_id, depends_on_course_id, depends_on_material_id
      FROM learning_dependency
      WHERE course_item_id IN (${courseIdList})
         OR material_item_id IN (${materialIdList})
         OR depends_on_course_id IN (${courseIdList})
         OR depends_on_material_id IN (${materialIdList})
    `)
  );

  // Collect all referenced tag IDs
  const allTagIds = new Set<number>();
  for (const ft of allFlashcardTags) allTagIds.add(ft.tag_id);
  for (const qt of allQuestionTags) allTagIds.add(qt.tag_id);
  for (const mt of allMaterialTags) allTagIds.add(mt.tag_id);

  const tagIdList = allTagIds.size > 0 ? [...allTagIds].join(",") : "0";
  const sourceTags = db.all<{ id: number; name: string; color: string | null }>(
    sql.raw(`SELECT id, name, color FROM tag WHERE id IN (${tagIdList})`)
  );

  // Fetch source materials and quizzes
  const sourceMaterials = db.all<{
    id: number; title: string; description: string | null;
    content: string | null; external_url: string | null; notes: string | null;
    created_at: number; updated_at: number;
  }>(
    sql.raw(`SELECT id, title, description, content, external_url, notes, created_at, updated_at FROM material WHERE id IN (${materialIdList})`)
  );

  const sourceQuizzes = db.all<{
    id: number; title: string; description: string;
    created_at: number; updated_at: number;
  }>(
    sql.raw(`SELECT id, title, description, created_at, updated_at FROM quiz WHERE id IN (${quizIdList})`)
  );

  const sourceDecks = db.all<{
    id: number; name: string; description: string | null;
    created_at: number; updated_at: number;
  }>(
    sql.raw(`SELECT id, name, description, created_at, updated_at FROM deck WHERE id IN (${deckIdList})`)
  );

  // Get source course owner info for attribution
  const sourceOwner = db.all<{ name: string | null; email: string }>(
    sql.raw(`SELECT name, email FROM users WHERE id = ${allCourses[0].user_id}`)
  );
  const sourceAuthorName = sourceOwner[0]?.name || sourceOwner[0]?.email || "Unknown";

  // ── 5. Build ID mapping tables ───────────────────────────────────────
  const courseMap = new Map<number, number>();
  const materialMap = new Map<number, number>();
  const quizMap = new Map<number, number>();
  const deckMap = new Map<number, number>();
  const flashcardMap = new Map<number, number>();
  const questionMap = new Map<number, number>();
  const tagMap = new Map<number, number>(); // old tag id -> new tag id

  const nowUnix = Math.floor(now.getTime() / 1000);

  // ── 6. Insert entities in dependency order ───────────────────────────

  // --- Courses ---
  // Sort so parents are inserted before children
  const courseInsertOrder: typeof allCourses = [];
  const courseRemaining = [...allCourses];
  const inserted = new Set<number>();
  while (courseRemaining.length > 0) {
    const beforeLen = courseRemaining.length;
    for (let i = courseRemaining.length - 1; i >= 0; i--) {
      const c = courseRemaining[i];
      const parentInTree = c.parent_id !== null && courseIdSet.has(c.parent_id);
      if (!parentInTree || inserted.has(c.parent_id!)) {
        courseInsertOrder.push(c);
        inserted.add(c.id);
        courseRemaining.splice(i, 1);
      }
    }
    if (courseRemaining.length === beforeLen) {
      // Shouldn't happen with valid data; break to avoid infinite loop
      throw new Error("Circular reference detected in course hierarchy");
    }
  }

  let rootPublicId = "";

  for (const c of courseInsertOrder) {
    const publicId = randomBytes(16).toString("hex");
    const isRoot = c.id === sourceCourseId;
    if (isRoot) rootPublicId = publicId;

    const newParentId = c.parent_id !== null && courseMap.has(c.parent_id)
      ? courseMap.get(c.parent_id)!
      : null;

    const result = db.all<{ id: number }>(sql.raw(`
      INSERT INTO course (parent_id, user_id, name, description, color, is_active, position,
        estimated_hours, public_id, visibility, root_course_id,
        forked_from_id, forked_from_user_id, forked_from_name, forked_from_author_name, forked_at,
        created_at, updated_at)
      VALUES (
        ${newParentId === null ? "NULL" : newParentId},
        ${userId},
        ${escapeSql(c.name)},
        ${escapeSql(c.description)},
        ${escapeSql(c.color)},
        0,
        ${c.position},
        ${c.estimated_hours === null ? "NULL" : c.estimated_hours},
        ${escapeSql(publicId)},
        'private',
        NULL,
        ${isRoot ? c.id : "NULL"},
        ${isRoot ? c.user_id : "NULL"},
        ${isRoot ? escapeSql(c.name) : "NULL"},
        ${isRoot ? escapeSql(sourceAuthorName) : "NULL"},
        ${isRoot ? nowUnix : "NULL"},
        ${nowUnix},
        ${nowUnix}
      )
      RETURNING id
    `));
    courseMap.set(c.id, result[0].id);
  }

  // Set root_course_id on all forked courses to the new root
  const newRootId = courseMap.get(sourceCourseId)!;
  const newCourseIds = [...courseMap.values()];
  if (newCourseIds.length > 0) {
    db.run(sql.raw(`
      UPDATE course SET root_course_id = ${newRootId}
      WHERE id IN (${newCourseIds.join(",")})
    `));
  }

  // --- Materials ---
  for (const m of sourceMaterials) {
    const result = db.all<{ id: number }>(sql.raw(`
      INSERT INTO material (title, description, content, external_url, notes, user_id, created_at, updated_at)
      VALUES (
        ${escapeSql(m.title)},
        ${m.description === null ? "NULL" : escapeSql(m.description)},
        ${m.content === null ? "NULL" : escapeSql(m.content)},
        ${m.external_url === null ? "NULL" : escapeSql(m.external_url)},
        ${m.notes === null ? "NULL" : escapeSql(m.notes)},
        ${userId},
        ${nowUnix},
        ${nowUnix}
      )
      RETURNING id
    `));
    materialMap.set(m.id, result[0].id);
  }

  // --- Quizzes ---
  for (const q of sourceQuizzes) {
    const result = db.all<{ id: number }>(sql.raw(`
      INSERT INTO quiz (title, description, user_id, created_at, updated_at)
      VALUES (
        ${escapeSql(q.title)},
        ${escapeSql(q.description)},
        ${userId},
        ${nowUnix},
        ${nowUnix}
      )
      RETURNING id
    `));
    quizMap.set(q.id, result[0].id);
  }

  // --- Decks ---
  for (const d of sourceDecks) {
    const result = db.all<{ id: number }>(sql.raw(`
      INSERT INTO deck (name, description, user_id, created_at, updated_at)
      VALUES (
        ${escapeSql(d.name)},
        ${d.description === null ? "NULL" : escapeSql(d.description)},
        ${userId},
        ${nowUnix},
        ${nowUnix}
      )
      RETURNING id
    `));
    deckMap.set(d.id, result[0].id);
  }

  // --- Flashcards (SRS fields reset) ---
  for (const f of allFlashcards) {
    const newDeckId = deckMap.get(f.deck_id);
    if (newDeckId === undefined) continue;

    const newSourceMaterialId = f.source_material_id !== null
      ? materialMap.get(f.source_material_id) ?? null
      : null;

    const result = db.all<{ id: number }>(sql.raw(`
      INSERT INTO flashcard (deck_id, front, back, ease_factor, interval, repetitions, next_review_at, source_material_id, created_at)
      VALUES (
        ${newDeckId},
        ${escapeSql(f.front)},
        ${escapeSql(f.back)},
        2.5,
        0,
        0,
        ${nowUnix},
        ${newSourceMaterialId === null ? "NULL" : newSourceMaterialId},
        ${nowUnix}
      )
      RETURNING id
    `));
    flashcardMap.set(f.id, result[0].id);
  }

  // --- Quiz Questions ---
  for (const q of allQuizQuestions) {
    const newQuizId = quizMap.get(q.quiz_id);
    if (newQuizId === undefined) continue;

    const newDeckId = q.deck_id !== null ? (deckMap.get(q.deck_id) ?? null) : null;
    const newSourceMaterialId = q.source_material_id !== null
      ? (materialMap.get(q.source_material_id) ?? null)
      : null;

    const result = db.all<{ id: number }>(sql.raw(`
      INSERT INTO quiz_question (deck_id, quiz_id, type, question, explanation, correct_answer, source_material_id, created_at)
      VALUES (
        ${newDeckId === null ? "NULL" : newDeckId},
        ${newQuizId},
        ${escapeSql(q.type)},
        ${escapeSql(q.question)},
        ${q.explanation === null ? "NULL" : escapeSql(q.explanation)},
        ${q.correct_answer === null ? "NULL" : escapeSql(q.correct_answer)},
        ${newSourceMaterialId === null ? "NULL" : newSourceMaterialId},
        ${nowUnix}
      )
      RETURNING id
    `));
    questionMap.set(q.id, result[0].id);
  }

  // --- Question Options ---
  for (const o of allQuestionOptions) {
    const newQuestionId = questionMap.get(o.question_id);
    if (newQuestionId === undefined) continue;

    db.run(sql.raw(`
      INSERT INTO question_option (question_id, option_text, is_correct)
      VALUES (
        ${newQuestionId},
        ${escapeSql(o.option_text)},
        ${o.is_correct}
      )
    `));
  }

  // --- Course Steps ---
  for (const s of allCourseSteps) {
    const newCourseId = courseMap.get(s.course_id);
    if (newCourseId === undefined) continue;

    const newMaterialId = s.material_id !== null
      ? (materialMap.get(s.material_id) ?? null)
      : null;
    const newQuizId = s.quiz_id !== null
      ? (quizMap.get(s.quiz_id) ?? null)
      : null;

    db.run(sql.raw(`
      INSERT INTO course_step (course_id, position, step_type, material_id, quiz_id)
      VALUES (
        ${newCourseId},
        ${s.position},
        ${escapeSql(s.step_type)},
        ${newMaterialId === null ? "NULL" : newMaterialId},
        ${newQuizId === null ? "NULL" : newQuizId}
      )
    `));
  }

  // --- Course Decks (join) ---
  for (const cd of allCourseDecks) {
    const newCourseId = courseMap.get(cd.course_id);
    const newDeckId = deckMap.get(cd.deck_id);
    if (newCourseId === undefined || newDeckId === undefined) continue;

    db.run(sql.raw(`
      INSERT OR IGNORE INTO course_deck (course_id, deck_id, position)
      VALUES (${newCourseId}, ${newDeckId}, ${cd.position})
    `));
  }

  // --- Material Decks (join) ---
  for (const md of allMaterialDecks) {
    const newMaterialId = materialMap.get(md.material_id);
    const newDeckId = deckMap.get(md.deck_id);
    if (newMaterialId === undefined || newDeckId === undefined) continue;

    db.run(sql.raw(`
      INSERT OR IGNORE INTO material_deck (material_id, deck_id)
      VALUES (${newMaterialId}, ${newDeckId})
    `));
  }

  // --- Material Quizzes (join) ---
  for (const mq of allMaterialQuizzes) {
    const newMaterialId = materialMap.get(mq.material_id);
    const newQuizId = quizMap.get(mq.quiz_id);
    if (newMaterialId === undefined || newQuizId === undefined) continue;

    db.run(sql.raw(`
      INSERT OR IGNORE INTO material_quiz (material_id, quiz_id)
      VALUES (${newMaterialId}, ${newQuizId})
    `));
  }

  // --- Material Resources ---
  for (const mr of allMaterialResources) {
    const newMaterialId = materialMap.get(mr.material_id);
    if (newMaterialId === undefined) continue;

    db.run(sql.raw(`
      INSERT INTO material_resource (material_id, url, title, type, created_at)
      VALUES (
        ${newMaterialId},
        ${escapeSql(mr.url)},
        ${mr.title === null ? "NULL" : escapeSql(mr.title)},
        ${escapeSql(mr.type)},
        ${nowUnix}
      )
    `));
  }

  // --- Tags (find-or-create for forking user) ---
  for (const t of sourceTags) {
    // Check if the user already has a tag with this name
    const existing = db.all<{ id: number }>(sql.raw(`
      SELECT id FROM tag WHERE name = ${escapeSql(t.name)} AND user_id = ${userId} LIMIT 1
    `));

    if (existing.length > 0) {
      tagMap.set(t.id, existing[0].id);
    } else {
      const result = db.all<{ id: number }>(sql.raw(`
        INSERT INTO tag (name, user_id, color)
        VALUES (${escapeSql(t.name)}, ${userId}, ${t.color === null ? "NULL" : escapeSql(t.color)})
        RETURNING id
      `));
      tagMap.set(t.id, result[0].id);
    }
  }

  // --- Flashcard Tags (join) ---
  for (const ft of allFlashcardTags) {
    const newFlashcardId = flashcardMap.get(ft.flashcard_id);
    const newTagId = tagMap.get(ft.tag_id);
    if (newFlashcardId === undefined || newTagId === undefined) continue;

    db.run(sql.raw(`
      INSERT OR IGNORE INTO flashcard_tag (flashcard_id, tag_id)
      VALUES (${newFlashcardId}, ${newTagId})
    `));
  }

  // --- Question Tags (join) ---
  for (const qt of allQuestionTags) {
    const newQuestionId = questionMap.get(qt.question_id);
    const newTagId = tagMap.get(qt.tag_id);
    if (newQuestionId === undefined || newTagId === undefined) continue;

    db.run(sql.raw(`
      INSERT OR IGNORE INTO question_tag (question_id, tag_id)
      VALUES (${newQuestionId}, ${newTagId})
    `));
  }

  // --- Material Tags (join) ---
  for (const mt of allMaterialTags) {
    const newMaterialId = materialMap.get(mt.material_id);
    const newTagId = tagMap.get(mt.tag_id);
    if (newMaterialId === undefined || newTagId === undefined) continue;

    db.run(sql.raw(`
      INSERT OR IGNORE INTO material_tag (material_id, tag_id)
      VALUES (${newMaterialId}, ${newTagId})
    `));
  }

  // --- Learning Materials ---
  for (const lm of allLearningMaterials) {
    const newFlashcardId = lm.flashcard_id !== null
      ? (flashcardMap.get(lm.flashcard_id) ?? null)
      : null;
    const newQuestionId = lm.question_id !== null
      ? (questionMap.get(lm.question_id) ?? null)
      : null;

    // Skip if neither FK could be remapped
    if (newFlashcardId === null && newQuestionId === null) continue;

    db.run(sql.raw(`
      INSERT INTO learning_material (flashcard_id, question_id, url, title, type, position, created_at)
      VALUES (
        ${newFlashcardId === null ? "NULL" : newFlashcardId},
        ${newQuestionId === null ? "NULL" : newQuestionId},
        ${escapeSql(lm.url)},
        ${lm.title === null ? "NULL" : escapeSql(lm.title)},
        ${escapeSql(lm.type)},
        ${lm.position},
        ${nowUnix}
      )
    `));
  }

  // --- Learning Dependencies ---
  for (const dep of allLearningDeps) {
    // Remap all four FK columns; if ANY references an entity outside the forked tree, drop the row
    const newCourseItemId = dep.course_item_id !== null
      ? courseMap.get(dep.course_item_id)
      : undefined;
    const newMaterialItemId = dep.material_item_id !== null
      ? materialMap.get(dep.material_item_id)
      : undefined;
    const newDependsOnCourseId = dep.depends_on_course_id !== null
      ? courseMap.get(dep.depends_on_course_id)
      : undefined;
    const newDependsOnMaterialId = dep.depends_on_material_id !== null
      ? materialMap.get(dep.depends_on_material_id)
      : undefined;

    // If a non-null FK couldn't be remapped, the entity is external → drop
    if (dep.course_item_id !== null && newCourseItemId === undefined) continue;
    if (dep.material_item_id !== null && newMaterialItemId === undefined) continue;
    if (dep.depends_on_course_id !== null && newDependsOnCourseId === undefined) continue;
    if (dep.depends_on_material_id !== null && newDependsOnMaterialId === undefined) continue;

    db.run(sql.raw(`
      INSERT INTO learning_dependency (course_item_id, material_item_id, depends_on_course_id, depends_on_material_id)
      VALUES (
        ${dep.course_item_id === null ? "NULL" : newCourseItemId},
        ${dep.material_item_id === null ? "NULL" : newMaterialItemId},
        ${dep.depends_on_course_id === null ? "NULL" : newDependsOnCourseId},
        ${dep.depends_on_material_id === null ? "NULL" : newDependsOnMaterialId}
      )
    `));
  }

  return { newCourseId: newRootId, newPublicId: rootPublicId };
}

/**
 * Escape a string for use in raw SQL.
 * Wraps in single quotes and escapes internal single quotes.
 */
function escapeSql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
