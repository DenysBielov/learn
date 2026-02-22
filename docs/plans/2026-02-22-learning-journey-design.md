# Learning Journey & Platform Restructuring Design

Date: 2026-02-22

## Overview

Transform the app from a flashcards/quiz tool into a structured learning platform. Courses become learning journeys with three main entity types: **materials** (reading/video content), **quizzes** (standalone assessments), and **flashcard decks** (spaced repetition, linked but separate from the journey flow).

## Key Decisions

- **Flow model:** Suggested order (playlist-style). Steps are numbered and ordered, but all accessible — no gates.
- **Flashcards:** Linked to courses via `course_deck` (unchanged), but NOT part of the sequential journey. Flashcards are an ongoing review tool.
- **Quizzes:** Become standalone entities (new `quiz` table), independent of decks. Decks become purely flashcard containers.
- **Materials:** Support both embedded markdown content and external URLs (videos, articles).
- **Topics:** Use existing course hierarchy. Sub-courses serve as topics (e.g., AI/ML → Linear Algebra → Dot Product). No new entity needed.
- **Progress:** Simple checkmarks — each step is done/not done. Materials are manually marked as read. Quizzes auto-complete on finish.
- **Migration:** Auto-migrate existing quiz questions from decks to standalone quizzes.

## Data Model

### New Tables

#### `material`

| Column       | Type      | Notes                              |
|--------------|-----------|-------------------------------------|
| id           | INTEGER   | PK, auto-increment                  |
| title        | TEXT      | NOT NULL                             |
| content      | TEXT      | Markdown body (nullable)             |
| external_url | TEXT      | Link to external resource (nullable) |
| user_id      | INTEGER   | FK → users                           |
| created_at   | INTEGER   | Timestamp                            |
| updated_at   | INTEGER   | Timestamp                            |

Constraints:
- `CHECK (content IS NOT NULL OR external_url IS NOT NULL)` — a material must have at least content or an external URL.

Indexes: `idx_material_user (user_id)`.

#### `quiz`

| Column      | Type      | Notes                  |
|-------------|-----------|------------------------|
| id          | INTEGER   | PK, auto-increment     |
| title       | TEXT      | NOT NULL                |
| description | TEXT      | Default ""              |
| user_id     | INTEGER   | FK → users              |
| created_at  | INTEGER   | Timestamp               |
| updated_at  | INTEGER   | Timestamp               |

Indexes: `idx_quiz_user (user_id)`.

#### `course_step`

| Column       | Type      | Notes                                              |
|--------------|-----------|----------------------------------------------------|
| id           | INTEGER   | PK, auto-increment                                 |
| course_id    | INTEGER   | FK → course, NOT NULL, ON DELETE CASCADE            |
| position     | INTEGER   | NOT NULL, ordering within course                    |
| step_type    | TEXT      | 'material' or 'quiz'                                |
| material_id  | INTEGER   | FK → material (nullable), ON DELETE CASCADE         |
| quiz_id      | INTEGER   | FK → quiz (nullable), ON DELETE CASCADE             |

Constraints:
- `CHECK ((step_type = 'material' AND material_id IS NOT NULL AND quiz_id IS NULL) OR (step_type = 'quiz' AND quiz_id IS NOT NULL AND material_id IS NULL))` — enforces that exactly one FK is set and matches `step_type`.
- `UNIQUE (material_id)` — prevents a material from being used as multiple steps (makes CASCADE deletion safe). This also makes the relationship 1:1 between `material` and `course_step`. The 1:1 constraint is intentional — keeping materials as separate entities enables future features (material library, AI-generated materials, sharing across courses) while the UNIQUE constraint keeps things simple for now.
- `UNIQUE (quiz_id)` — prevents a quiz from being used as multiple steps (makes CASCADE deletion safe).

Indexes: `(course_id, position)`, `(material_id)`, `(quiz_id)`.

Note: `course_step` has no `user_id`. Ownership is derived from `course.user_id`, matching the pattern used by `course_deck`.

Note: No `UNIQUE (course_id, position)` constraint. SQLite checks UNIQUE per-statement (not per-transaction), so reordering steps by swapping positions would fail with intermediate constraint violations. This matches the existing codebase pattern — `course.position` and `course_deck.position` have no UNIQUE constraint either.

Note: Currently only two step types are supported (`material` and `quiz`). If additional step types are needed in the future, consider migrating to a single-column polymorphic approach (e.g., a `content_id` + `step_type` discriminator) instead of adding more nullable FK columns.

Note: Step numbers displayed in the UI should be computed from the array index of the ordered steps (not from the `position` column values) to avoid gaps after step deletion.

#### `step_progress`

| Column        | Type      | Notes                                        |
|---------------|-----------|----------------------------------------------|
| id            | INTEGER   | PK, auto-increment                           |
| course_step_id| INTEGER   | FK → course_step, NOT NULL, ON DELETE CASCADE |
| user_id       | INTEGER   | FK → users, NOT NULL                          |
| is_completed  | INTEGER   | Boolean, default false                        |
| completed_at  | INTEGER   | Timestamp (nullable)                          |

Constraints:
- `UNIQUE (course_step_id, user_id)` — one progress record per step per user.

### Modified Tables

#### `quiz_question`

Add column:
- `quiz_id` INTEGER FK → quiz (nullable initially, required after migration), ON DELETE CASCADE

Change existing `deck_id` column:
- Make nullable (currently NOT NULL)
- Change FK cascade from ON DELETE CASCADE to ON DELETE SET NULL

This means deleting a deck sets `deck_id = NULL` on its questions rather than destroying them. During migration, questions retain both `deck_id` (backward compat) and `quiz_id` (new path). Existing queries continue working through `deck_id` during the transition period.

**Important:** SQLite cannot ALTER COLUMN to change NOT NULL or cascade behavior. This requires a table rebuild: create new table with updated schema, copy data, drop old table, rename new table. This is handled in Phase 2 (hand-written migration), not Phase 1.

**Affected existing queries referencing `quiz_question.deck_id`:**

The following callsites currently join or filter through `deck_id` and must be updated to use `quiz_id` for quiz-sourced questions:

1. **`packages/web/src/app/actions/quiz.ts` — `submitQuizAnswer`**: Joins `quiz_question` on `deck_id → deck.user_id` for authorization. Must add parallel path joining through `quiz_id → quiz.user_id`.
2. **`packages/web/src/app/actions/quiz.ts` — `getRevisionQuizQuestions`**: Filters by `deck_id`. Add parallel path filtering by `quiz_id`.
3. **`packages/web/src/app/actions/quiz.ts` — `getNewQuizQuestions`**: Filters by `deck_id` to find quiz questions for a deck. Must be updated to also support finding questions by `quiz_id`. This function is completely broken for migrated questions after `deck_id` is nulled.
4. **`packages/web/src/app/actions/quiz.ts` — `getCourseQuizQuestions`**: Uses `deck_id` to find quiz questions across courses via `course_deck` join. Must be updated to also resolve questions through `course_step.quiz_id → quiz_question.quiz_id`. This function is completely broken for migrated questions after `deck_id` is nulled.
5. **`packages/web/src/app/actions/decks.ts` — `getDeck`**: Counts quiz questions per deck using `deck_id`. After migration, decks with migrated questions will show zero quiz questions — this is correct (decks are now purely flashcard containers).
6. **`packages/mcp-server/src/tools/quiz.ts` — `create_quiz`**: Creates quiz questions referencing `deck_id`. This tool is replaced by `add_questions_to_quiz` which uses `quiz_id`.
7. **`packages/web/src/app/actions/courses.ts` — `getCourse`**: Counts questions per deck via `quiz_question.deck_id`. After migration this correctly shows zero for pure flashcard decks.
8. **`packages/mcp-server/src/tools/decks.ts` — `list_questions`**: Filters by `deck_id`. Add `list_quiz_questions` tool that filters by `quiz_id`.

Each of these must be updated to: (a) check `quiz_id` first, (b) fall back to `deck_id` for legacy data, (c) use the appropriate FK for authorization joins.

#### `study_session`

Add column:
- `quiz_id` INTEGER FK → quiz (nullable), ON DELETE SET NULL

Update the existing CHECK constraint to allow `quiz_id` as a valid session type. A study session must reference exactly one of `deck_id` (flashcard session), `quiz_id` (standalone quiz session), or `course_id` (course-level study session):

```sql
CHECK (
  (deck_id IS NOT NULL AND quiz_id IS NULL AND course_id IS NULL) OR
  (deck_id IS NULL AND quiz_id IS NOT NULL AND course_id IS NULL) OR
  (deck_id IS NULL AND quiz_id IS NULL AND course_id IS NOT NULL)
)
```

This preserves existing course-level sessions (which have `deck_id = NULL` and `course_id` set) while adding `quiz_id` as a third alternative.

The `quiz_id` FK uses ON DELETE SET NULL (not CASCADE) to preserve historical session records when a quiz is deleted.

**Known trade-off:** When a quiz is deleted, `study_session.quiz_id` is set to NULL (session survives), but `quiz_question` rows CASCADE-delete, which in turn CASCADE-deletes `quiz_result` rows. The surviving session has `quiz_id = NULL` and zero results — it is a historical shell. This is acceptable because the alternative (CASCADE delete on `study_session.quiz_id`) would destroy the session entirely, which is worse for audit/history purposes. The session history UI should handle this gracefully by showing "Quiz deleted" or filtering out sessions with zero results.

**Important:** SQLite cannot ALTER a CHECK constraint in place. Changing the CHECK requires a table rebuild (create new table, copy data, drop old, rename). This is handled in Phase 2 (hand-written migration), not Phase 1.

### Unchanged

- `deck` — becomes purely a flashcard container
- `course_deck` — stays for linking flashcard decks to courses
- `flashcard` — no changes
- All result tables (`flashcard_result`, `quiz_result`) — no changes

### Cascade Behavior Summary

| FK | Cascade | Rationale |
|----|---------|-----------|
| `course_step.course_id → course` | ON DELETE CASCADE | Deleting a course removes its steps |
| `course_step.material_id → material` | ON DELETE CASCADE | Deleting a material removes its step |
| `course_step.quiz_id → quiz` | ON DELETE CASCADE | Deleting a quiz removes its step |
| `step_progress.course_step_id → course_step` | ON DELETE CASCADE | Deleting a step removes its progress |
| `quiz_question.quiz_id → quiz` | ON DELETE CASCADE | Deleting a quiz removes its questions |
| `quiz_question.deck_id → deck` | ON DELETE SET NULL | Deleting a deck preserves questions (nulls out deck_id) |
| `study_session.quiz_id → quiz` | ON DELETE SET NULL | Deleting a quiz preserves session history |
| `material.user_id → users` | No cascade | User deletion requires manual cleanup (matches existing pattern — `deck.user_id` and `course.user_id` also have no cascade) |
| `quiz.user_id → users` | No cascade | Same as above |

## Migration Strategy

Run in two phases:

**Phase 1: Schema changes (Drizzle-generated via `pnpm generate`)**

Only safe auto-generatable DDL (new tables and new nullable columns):

1. Create `material`, `quiz`, `course_step`, and `step_progress` tables
2. Add `quiz_id` column to `quiz_question` (nullable)
3. Add `quiz_id` column to `study_session` (nullable)

Note: The CHECK constraint change on `study_session` and the `quiz_question` table rebuild are NOT included here — Drizzle Kit does not safely handle SQLite table recreation. Those are in Phase 2.

**Phase 2: Data migration (hand-written TypeScript migration script)**

This phase handles table rebuilds, CHECK constraint changes, and data transformations that cannot be safely auto-generated. Write as a standalone script (e.g., `packages/database/src/migrations/migrate-quizzes.ts`).

**Wrap the entire Phase 2 in a single `writeTransaction`** to prevent partial migration state if the script crashes.

4. **Rebuild `quiz_question` table** (SQLite table recreation):
   a. Create `quiz_question_new` with: `deck_id` nullable + ON DELETE SET NULL (was NOT NULL + CASCADE), plus new `quiz_id` column with ON DELETE CASCADE
   b. Copy data with explicit column lists:
      ```sql
      INSERT INTO quiz_question_new (id, deck_id, type, question, explanation, correct_answer, created_at, quiz_id)
      SELECT id, deck_id, type, question, explanation, correct_answer, created_at, quiz_id
      FROM quiz_question
      ```
      Explicit columns are required because `SELECT *` is fragile when the source table (altered by Phase 1) may have columns in a different order than the new table definition.
   c. `DROP TABLE quiz_question`
   d. `ALTER TABLE quiz_question_new RENAME TO quiz_question`
   e. Recreate all indexes on `quiz_question`
5. For each deck that has quiz questions:
   a. Create a `quiz` row with the same name, description, and `user_id` (copied from `deck.user_id`)
   b. Update all `quiz_question` rows for that deck: set `quiz_id` to the new quiz (KEEP `deck_id` populated — the ON DELETE SET NULL cascade now protects questions if the deck is later deleted)
   c. For EACH course linked to that deck via `course_deck`, create a `course_step` for that quiz. Use the deck's `course_deck.position` value as the `course_step.position` to preserve ordering within the course.
6. **Backfill `quiz_id` on existing quiz-mode `study_session` rows:** For each deck that was migrated to a quiz, update `study_session` rows with `mode = 'quiz'` and matching `deck_id`: set `quiz_id` to the new quiz AND set `deck_id = NULL`. Setting `deck_id = NULL` is required because the rebuilt table's CHECK constraint (step 7) enforces that exactly one of `deck_id`/`quiz_id`/`course_id` is NOT NULL — rows with both `deck_id` and `quiz_id` set would violate the constraint.
7. **Rebuild `study_session` table** (SQLite table recreation):
   a. Create `study_session_new` with the updated CHECK constraint (three-way mutual exclusion: exactly one of deck_id, quiz_id, course_id is NOT NULL) and the new `quiz_id` FK with ON DELETE SET NULL
   b. Copy data with explicit column lists:
      ```sql
      INSERT INTO study_session_new (id, user_id, deck_id, course_id, mode, sub_mode, started_at, completed_at, notes, quiz_id)
      SELECT id, user_id, deck_id, course_id, mode, sub_mode, started_at, completed_at, notes, quiz_id
      FROM study_session
      ```
      Explicit columns are required because `SELECT *` is fragile when the source table (altered by Phase 1) may have columns in a different order than the new table definition.
   c. `DROP TABLE study_session`
   d. `ALTER TABLE study_session_new RENAME TO study_session`
   e. Recreate all indexes on `study_session`
8. Make `quiz_id` the primary reference for quiz questions going forward
9. Keep `deck_id` on `quiz_question` as nullable legacy (can be dropped in a future migration)

## Server Actions (packages/web)

**Authorization requirement:** All server actions below MUST call `requireAuth()` and filter all database queries by the authenticated `userId`. This applies to all CRUD operations, read actions, and especially to `toggleStepComplete`, `reorderCourseSteps`, and `getCourseJourney`. For `course_step` operations, authorization is enforced by joining through `course.user_id`. For materials and quizzes, through `material.user_id` and `quiz.user_id` respectively. This matches the existing pattern used throughout the codebase.

### Materials
- `createMaterial(courseId, { title, content?, externalUrl? })` — creates material + auto-creates course step at next position. Validates `externalUrl` using the `new URL()` constructor (which normalizes schemes to lowercase, preventing case-based bypasses like `JAVASCRIPT:`), then checks the parsed protocol against an allowlist of `https:` and `http:` only; rejects all other protocols (`javascript:`, `data:`, `vbscript:`, `file:`, etc.). The `content` field must be sanitized using `sanitizeMarkdownImageUrls` (the same sanitization used for flashcard content) before storing. The `RichContent` component used for rendering already handles safe output (it uses `react-markdown` which does not render raw HTML by default).
- `updateMaterial(id, { title?, content?, externalUrl? })` — edits material content. Same URL validation. Same markdown sanitization for `content`.
- `deleteMaterial(id)` — deletes material; associated course step is removed via ON DELETE CASCADE on `course_step.material_id`.
- `getMaterial(id)` — fetches single material with course context (via `course_step` join).

### Quizzes
- `createQuiz(courseId, { title, description? })` — creates quiz + auto-creates course step
- `updateQuiz(id, { title?, description? })` — edits quiz metadata
- `deleteQuiz(id)` — deletes quiz. ON DELETE CASCADE removes associated quiz questions, course steps, and study sessions. **Note:** this intentionally destroys historical quiz results (via `quiz_question` cascade to `quiz_result`). This matches the current behavior where deleting a deck destroys its associated data. A soft-delete/archive pattern may be added in a future iteration if data preservation is needed.
- `getQuiz(id)` — fetches quiz with questions and options

### Course Steps (Journey)
- `getCourseJourney(courseId)` — returns ordered steps with material/quiz data and completion state (from `step_progress`)
- `reorderCourseSteps(courseId, stepIds[])` — reorders steps within a `writeTransaction`. Validates that ALL provided `stepIds` exist in `course_step` with matching `course_id`, that the course belongs to the authenticated user, and that `stepIds.length` matches the actual count of steps for the course (rejects if mismatched to prevent silent omissions). Sets `position = index` for each step in the array.
- `toggleStepComplete(stepId, completed)` — upserts `step_progress` row: marks step done/undone, sets `completed_at`. Verifies step ownership via `course_step → course.user_id`.

### Quiz Auto-Completion
When a quiz session completes, the existing `completeStudySession` action (in `packages/web/src/app/actions/flashcards.ts`) should be extended to: look up whether the session's `quiz_id` has an associated `course_step`, and if so, upsert `step_progress` to mark the step as completed. This provides automatic progress tracking without requiring the user to manually mark quiz steps as done.

**Important:** The `course_step` lookup MUST verify `course.user_id = authenticated userId` via the `course_step → course` join. Do not rely solely on session ownership — explicitly confirm the course belongs to the authenticated user before upserting `step_progress`.

### Enhanced Existing
- `getCourse(id)` — adds journey steps to the response alongside children and decks

## MCP Tools

All server actions mirrored for AI agent usage. All tools MUST receive `userId` via the `registerXxxTools(server, db, userId)` pattern and filter all queries by `userId`, matching the existing MCP tool implementation pattern.

- `create_material` / `update_material` / `delete_material` / `list_materials`
- `create_quiz` / `update_quiz` / `delete_quiz` — updated to use new quiz entity
- `add_questions_to_quiz` — adds questions to a standalone quiz (replaces deck-based question creation)
- `get_course_journey` / `reorder_course_steps` / `toggle_step_complete`
- `create_flashcards` — unchanged, still works with decks

## UI Changes

### Course Page (`/courses/[id]`)

Current layout: header, action buttons, sub-courses, decks, session history.

New layout:
1. **Header** — unchanged (title, color, active toggle, edit)
2. **Learning Journey** — new section, ordered list of steps:
   - Step number, type icon (book for material, brain for quiz), title
   - Completion checkmark (clickable to toggle)
   - "Continue where you left off" link pointing to first incomplete step
   - "Add Material" and "Add Quiz" buttons to append steps
3. **Flashcard Decks** — existing decks section (linked but separate from journey)
4. **Sub-courses** — unchanged
5. **Session History** — unchanged

### New Pages

#### `/materials/[id]`
- Material viewer: renders markdown content using the existing `RichContent` component (which already handles markdown rendering and KaTeX support)
- Shows external link button if `external_url` is set
- "Mark as Complete" button → toggles step completion (upserts `step_progress`)
- "Next Step" button → navigates to next step in the journey

#### `/quizzes/[id]`
- Quiz landing page: title, description, question count, past scores (queried via `study_session.quiz_id`)
- "Start Quiz" button → reuses existing quiz session UI, sourcing questions from the quiz entity via `quiz_question.quiz_id`
- On quiz completion → auto-marks the course step as complete (upserts `step_progress` via extended `completeStudySession`)
- "Next Step" button → navigates to next step in the journey

### Navigation Within Journey

After completing any step (material read or quiz finished), a "Next Step" button appears linking to the next step in the journey. This creates the playlist feel without enforcing gates.

## What's NOT In Scope

- FSRS algorithm (future work)
- Rich text editor / Notion-like blocks (markdown is sufficient for now)
- Mastery levels (future work)
- Gating / prerequisite enforcement (playlist model is sufficient)
- Incremental reading (future work)
- Video hosting (external links only)
- Soft-delete / archive pattern for quizzes (future work)
- Remove legacy `deck_id` from `quiz_question` (follow-up migration after transition period)
