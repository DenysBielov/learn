/**
 * Copy a course from a prod DB snapshot into the local DB using ATTACH DATABASE.
 *
 * Usage:
 *   npx tsx scripts/copy-course-from-prod.ts <prod-db-path> <course-id> [target-user-id]
 *
 * Example:
 *   npx tsx scripts/copy-course-from-prod.ts /tmp/flashcards-prod.db 27 1
 */

import Database from "better-sqlite3";
import { randomBytes } from "crypto";

const [prodDbPath, courseIdStr, targetUserIdStr] = process.argv.slice(2);

if (!prodDbPath || !courseIdStr) {
  console.error("Usage: npx tsx scripts/copy-course-from-prod.ts <prod-db-path> <course-id> [target-user-id]");
  process.exit(1);
}

const sourceCourseId = Number(courseIdStr);
const targetUserId = Number(targetUserIdStr || "1");

// Resolve local DB path relative to repo root
import { fileURLToPath } from "url";
import path from "path";

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    try {
      require("fs").accessSync(path.join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch { dir = path.dirname(dir); }
  }
  throw new Error("Could not find repo root (pnpm-workspace.yaml)");
}

const repoRoot = findRepoRoot(process.cwd());
const localDbPath = path.join(repoRoot, "data", "flashcards.db");

// Open local DB
const localDb = new Database(localDbPath);
localDb.pragma("journal_mode = WAL");
localDb.pragma("foreign_keys = OFF"); // Disable during bulk insert

// Attach prod DB
localDb.exec(`ATTACH DATABASE '${prodDbPath}' AS prod`);

const now = Math.floor(Date.now() / 1000);

const run = localDb.transaction(() => {
  // 1. Collect course tree from prod
  const allCourses = localDb.prepare(`
    WITH RECURSIVE tree AS (
      SELECT * FROM prod.course WHERE id = ?
      UNION ALL
      SELECT c.* FROM prod.course c JOIN tree t ON c.parent_id = t.id
    )
    SELECT id, parent_id, name, description, color, is_active, position,
           estimated_hours, visibility, root_course_id, user_id
    FROM tree
  `).all(sourceCourseId) as any[];

  if (allCourses.length === 0) {
    throw new Error(`Course ${sourceCourseId} not found in prod DB`);
  }

  const courseIds = allCourses.map((c: any) => c.id);
  const courseIdSet = new Set(courseIds);
  const courseIdList = courseIds.join(",");

  // 2. Collect related entities from prod
  const allCourseDecks = localDb.prepare(`SELECT course_id, deck_id, position FROM prod.course_deck WHERE course_id IN (${courseIdList})`).all() as any[];
  const uniqueDeckIds = [...new Set(allCourseDecks.map((cd: any) => cd.deck_id))];
  const deckIdList = uniqueDeckIds.length > 0 ? uniqueDeckIds.join(",") : "0";

  const allCourseSteps = localDb.prepare(`SELECT id, course_id, position, step_type, material_id, quiz_id FROM prod.course_step WHERE course_id IN (${courseIdList})`).all() as any[];
  const materialIds = [...new Set(allCourseSteps.filter((s: any) => s.material_id).map((s: any) => s.material_id))];
  const quizIds = [...new Set(allCourseSteps.filter((s: any) => s.quiz_id).map((s: any) => s.quiz_id))];
  const materialIdList = materialIds.length > 0 ? materialIds.join(",") : "0";
  const quizIdList = quizIds.length > 0 ? quizIds.join(",") : "0";

  const sourceDecks = localDb.prepare(`SELECT id, name, description FROM prod.deck WHERE id IN (${deckIdList})`).all() as any[];
  const sourceMaterials = localDb.prepare(`SELECT id, title, description, content, external_url, notes FROM prod.material WHERE id IN (${materialIdList})`).all() as any[];
  const sourceQuizzes = localDb.prepare(`SELECT id, title, description FROM prod.quiz WHERE id IN (${quizIdList})`).all() as any[];

  const allFlashcards = localDb.prepare(`SELECT id, deck_id, front, back, source_material_id FROM prod.flashcard WHERE deck_id IN (${deckIdList})`).all() as any[];
  const flashcardIds = allFlashcards.map((f: any) => f.id);
  const flashcardIdList = flashcardIds.length > 0 ? flashcardIds.join(",") : "0";

  const allQuizQuestions = localDb.prepare(`SELECT id, deck_id, quiz_id, type, question, explanation, correct_answer, source_material_id FROM prod.quiz_question WHERE quiz_id IN (${quizIdList})`).all() as any[];
  const questionIds = allQuizQuestions.map((q: any) => q.id);
  const questionIdList = questionIds.length > 0 ? questionIds.join(",") : "0";

  const allQuestionOptions = localDb.prepare(`SELECT id, question_id, option_text, is_correct FROM prod.question_option WHERE question_id IN (${questionIdList})`).all() as any[];

  // Join tables
  const allMaterialDecks = localDb.prepare(`SELECT material_id, deck_id FROM prod.material_deck WHERE material_id IN (${materialIdList})`).all() as any[];
  const allMaterialQuizzes = localDb.prepare(`SELECT material_id, quiz_id FROM prod.material_quiz WHERE material_id IN (${materialIdList})`).all() as any[];
  const allMaterialResources = localDb.prepare(`SELECT id, material_id, url, title, type FROM prod.material_resource WHERE material_id IN (${materialIdList})`).all() as any[];

  const allFlashcardTags = localDb.prepare(`SELECT flashcard_id, tag_id FROM prod.flashcard_tag WHERE flashcard_id IN (${flashcardIdList})`).all() as any[];
  const allQuestionTags = localDb.prepare(`SELECT question_id, tag_id FROM prod.question_tag WHERE question_id IN (${questionIdList})`).all() as any[];
  const allMaterialTags = localDb.prepare(`SELECT material_id, tag_id FROM prod.material_tag WHERE material_id IN (${materialIdList})`).all() as any[];

  const allTagIds = new Set<number>();
  for (const ft of allFlashcardTags) allTagIds.add(ft.tag_id);
  for (const qt of allQuestionTags) allTagIds.add(qt.tag_id);
  for (const mt of allMaterialTags) allTagIds.add(mt.tag_id);
  const tagIdList = allTagIds.size > 0 ? [...allTagIds].join(",") : "0";
  const sourceTags = localDb.prepare(`SELECT id, name, color FROM prod.tag WHERE id IN (${tagIdList})`).all() as any[];

  const allLearningMaterials = localDb.prepare(`
    SELECT id, flashcard_id, question_id, url, title, type, position
    FROM prod.learning_material
    WHERE flashcard_id IN (${flashcardIdList}) OR question_id IN (${questionIdList})
  `).all() as any[];

  const allLearningDeps = localDb.prepare(`
    SELECT id, course_item_id, material_item_id, depends_on_course_id, depends_on_material_id
    FROM prod.learning_dependency
    WHERE course_item_id IN (${courseIdList})
       OR material_item_id IN (${materialIdList})
       OR depends_on_course_id IN (${courseIdList})
       OR depends_on_material_id IN (${materialIdList})
  `).all() as any[];

  // 3. Build ID maps and insert
  const courseMap = new Map<number, number>();
  const materialMap = new Map<number, number>();
  const quizMap = new Map<number, number>();
  const deckMap = new Map<number, number>();
  const flashcardMap = new Map<number, number>();
  const questionMap = new Map<number, number>();
  const tagMap = new Map<number, number>();

  // Insert courses (parents first)
  const courseInsertOrder: any[] = [];
  const remaining = [...allCourses];
  const inserted = new Set<number>();
  while (remaining.length > 0) {
    const beforeLen = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const c = remaining[i];
      const parentInTree = c.parent_id !== null && courseIdSet.has(c.parent_id);
      if (!parentInTree || inserted.has(c.parent_id)) {
        courseInsertOrder.push(c);
        inserted.add(c.id);
        remaining.splice(i, 1);
      }
    }
    if (remaining.length === beforeLen) throw new Error("Circular reference in course hierarchy");
  }

  const insertCourse = localDb.prepare(`
    INSERT INTO course (parent_id, user_id, name, description, color, is_active, position,
      estimated_hours, public_id, visibility, root_course_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', NULL, ?, ?)
  `);

  for (const c of courseInsertOrder) {
    const newParentId = c.parent_id !== null && courseMap.has(c.parent_id)
      ? courseMap.get(c.parent_id)! : null;
    const publicId = randomBytes(16).toString("hex");
    const result = insertCourse.run(newParentId, targetUserId, c.name, c.description, c.color, 0, c.position, c.estimated_hours, publicId, now, now);
    courseMap.set(c.id, Number(result.lastInsertRowid));
  }

  const newRootId = courseMap.get(sourceCourseId)!;
  const newCourseIds = [...courseMap.values()];
  if (newCourseIds.length > 0) {
    localDb.prepare(`UPDATE course SET root_course_id = ? WHERE id IN (${newCourseIds.join(",")})`).run(newRootId);
  }

  // Insert materials
  const insertMaterial = localDb.prepare(`
    INSERT INTO material (title, description, content, external_url, notes, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of sourceMaterials) {
    const result = insertMaterial.run(m.title, m.description, m.content, m.external_url, m.notes, targetUserId, now, now);
    materialMap.set(m.id, Number(result.lastInsertRowid));
  }

  // Insert quizzes
  const insertQuiz = localDb.prepare(`INSERT INTO quiz (title, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`);
  for (const q of sourceQuizzes) {
    const result = insertQuiz.run(q.title, q.description, targetUserId, now, now);
    quizMap.set(q.id, Number(result.lastInsertRowid));
  }

  // Insert decks
  const insertDeck = localDb.prepare(`INSERT INTO deck (name, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`);
  for (const d of sourceDecks) {
    const result = insertDeck.run(d.name, d.description, targetUserId, now, now);
    deckMap.set(d.id, Number(result.lastInsertRowid));
  }

  // Insert flashcards
  const insertFlashcard = localDb.prepare(`
    INSERT INTO flashcard (deck_id, front, back, ease_factor, interval, repetitions, next_review_at, source_material_id, created_at)
    VALUES (?, ?, ?, 2.5, 0, 0, ?, ?, ?)
  `);
  for (const f of allFlashcards) {
    const newDeckId = deckMap.get(f.deck_id);
    if (!newDeckId) continue;
    const newSourceMaterialId = f.source_material_id ? materialMap.get(f.source_material_id) ?? null : null;
    const result = insertFlashcard.run(newDeckId, f.front, f.back, now, newSourceMaterialId, now);
    flashcardMap.set(f.id, Number(result.lastInsertRowid));
  }

  // Insert quiz questions
  const insertQuestion = localDb.prepare(`
    INSERT INTO quiz_question (deck_id, quiz_id, type, question, explanation, correct_answer, source_material_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const q of allQuizQuestions) {
    const newQuizId = quizMap.get(q.quiz_id);
    if (!newQuizId) continue;
    const newDeckId = q.deck_id ? deckMap.get(q.deck_id) ?? null : null;
    const newSourceMaterialId = q.source_material_id ? materialMap.get(q.source_material_id) ?? null : null;
    const result = insertQuestion.run(newDeckId, newQuizId, q.type, q.question, q.explanation, q.correct_answer, newSourceMaterialId, now);
    questionMap.set(q.id, Number(result.lastInsertRowid));
  }

  // Insert question options
  const insertOption = localDb.prepare(`INSERT INTO question_option (question_id, option_text, is_correct) VALUES (?, ?, ?)`);
  for (const o of allQuestionOptions) {
    const newQuestionId = questionMap.get(o.question_id);
    if (!newQuestionId) continue;
    insertOption.run(newQuestionId, o.option_text, o.is_correct);
  }

  // Insert course steps
  const insertStep = localDb.prepare(`INSERT INTO course_step (course_id, position, step_type, material_id, quiz_id) VALUES (?, ?, ?, ?, ?)`);
  for (const s of allCourseSteps) {
    const newCourseId = courseMap.get(s.course_id);
    if (!newCourseId) continue;
    const newMaterialId = s.material_id ? materialMap.get(s.material_id) ?? null : null;
    const newQuizId = s.quiz_id ? quizMap.get(s.quiz_id) ?? null : null;
    insertStep.run(newCourseId, s.position, s.step_type, newMaterialId, newQuizId);
  }

  // Insert course decks
  const insertCourseDeck = localDb.prepare(`INSERT OR IGNORE INTO course_deck (course_id, deck_id, position) VALUES (?, ?, ?)`);
  for (const cd of allCourseDecks) {
    const newCourseId = courseMap.get(cd.course_id);
    const newDeckId = deckMap.get(cd.deck_id);
    if (!newCourseId || !newDeckId) continue;
    insertCourseDeck.run(newCourseId, newDeckId, cd.position);
  }

  // Insert material decks
  const insertMaterialDeck = localDb.prepare(`INSERT OR IGNORE INTO material_deck (material_id, deck_id) VALUES (?, ?)`);
  for (const md of allMaterialDecks) {
    const newMaterialId = materialMap.get(md.material_id);
    const newDeckId = deckMap.get(md.deck_id);
    if (!newMaterialId || !newDeckId) continue;
    insertMaterialDeck.run(newMaterialId, newDeckId);
  }

  // Insert material quizzes
  const insertMaterialQuiz = localDb.prepare(`INSERT OR IGNORE INTO material_quiz (material_id, quiz_id) VALUES (?, ?)`);
  for (const mq of allMaterialQuizzes) {
    const newMaterialId = materialMap.get(mq.material_id);
    const newQuizId = quizMap.get(mq.quiz_id);
    if (!newMaterialId || !newQuizId) continue;
    insertMaterialQuiz.run(newMaterialId, newQuizId);
  }

  // Insert material resources
  const insertResource = localDb.prepare(`INSERT INTO material_resource (material_id, url, title, type, created_at) VALUES (?, ?, ?, ?, ?)`);
  for (const mr of allMaterialResources) {
    const newMaterialId = materialMap.get(mr.material_id);
    if (!newMaterialId) continue;
    insertResource.run(newMaterialId, mr.url, mr.title, mr.type, now);
  }

  // Insert tags
  const findTag = localDb.prepare(`SELECT id FROM tag WHERE name = ? AND user_id = ? LIMIT 1`);
  const insertTag = localDb.prepare(`INSERT INTO tag (name, user_id, color) VALUES (?, ?, ?)`);
  for (const t of sourceTags) {
    const existing = findTag.get(t.name, targetUserId) as any;
    if (existing) {
      tagMap.set(t.id, existing.id);
    } else {
      const result = insertTag.run(t.name, targetUserId, t.color);
      tagMap.set(t.id, Number(result.lastInsertRowid));
    }
  }

  // Insert tag joins
  const insertFlashcardTag = localDb.prepare(`INSERT OR IGNORE INTO flashcard_tag (flashcard_id, tag_id) VALUES (?, ?)`);
  for (const ft of allFlashcardTags) {
    const nf = flashcardMap.get(ft.flashcard_id);
    const nt = tagMap.get(ft.tag_id);
    if (nf && nt) insertFlashcardTag.run(nf, nt);
  }

  const insertQuestionTag = localDb.prepare(`INSERT OR IGNORE INTO question_tag (question_id, tag_id) VALUES (?, ?)`);
  for (const qt of allQuestionTags) {
    const nq = questionMap.get(qt.question_id);
    const nt = tagMap.get(qt.tag_id);
    if (nq && nt) insertQuestionTag.run(nq, nt);
  }

  const insertMaterialTag = localDb.prepare(`INSERT OR IGNORE INTO material_tag (material_id, tag_id) VALUES (?, ?)`);
  for (const mt of allMaterialTags) {
    const nm = materialMap.get(mt.material_id);
    const nt = tagMap.get(mt.tag_id);
    if (nm && nt) insertMaterialTag.run(nm, nt);
  }

  // Insert learning materials
  const insertLearningMaterial = localDb.prepare(`
    INSERT INTO learning_material (flashcard_id, question_id, url, title, type, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const lm of allLearningMaterials) {
    const nf = lm.flashcard_id ? flashcardMap.get(lm.flashcard_id) ?? null : null;
    const nq = lm.question_id ? questionMap.get(lm.question_id) ?? null : null;
    if (!nf && !nq) continue;
    insertLearningMaterial.run(nf, nq, lm.url, lm.title, lm.type, lm.position, now);
  }

  // Insert learning dependencies
  const insertDep = localDb.prepare(`
    INSERT INTO learning_dependency (course_item_id, material_item_id, depends_on_course_id, depends_on_material_id)
    VALUES (?, ?, ?, ?)
  `);
  for (const dep of allLearningDeps) {
    const nci = dep.course_item_id ? courseMap.get(dep.course_item_id) : undefined;
    const nmi = dep.material_item_id ? materialMap.get(dep.material_item_id) : undefined;
    const ndc = dep.depends_on_course_id ? courseMap.get(dep.depends_on_course_id) : undefined;
    const ndm = dep.depends_on_material_id ? materialMap.get(dep.depends_on_material_id) : undefined;
    if (dep.course_item_id && nci === undefined) continue;
    if (dep.material_item_id && nmi === undefined) continue;
    if (dep.depends_on_course_id && ndc === undefined) continue;
    if (dep.depends_on_material_id && ndm === undefined) continue;
    insertDep.run(nci ?? null, nmi ?? null, ndc ?? null, ndm ?? null);
  }

  console.log(`Copied course "${allCourses[0].name}" (prod id=${sourceCourseId}) → local id=${newRootId}`);
  console.log(`  ${allCourses.length} courses, ${sourceMaterials.length} materials, ${sourceQuizzes.length} quizzes`);
  console.log(`  ${sourceDecks.length} decks, ${allFlashcards.length} flashcards, ${allQuizQuestions.length} questions`);
  console.log(`  ${allQuestionOptions.length} options, ${allCourseSteps.length} steps, ${sourceTags.length} tags`);
});

run();

localDb.exec("DETACH DATABASE prod");
localDb.pragma("foreign_keys = ON");
localDb.close();
