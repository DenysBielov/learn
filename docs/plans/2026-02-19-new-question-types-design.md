# New Question Types Design

Date: 2026-02-19

## Summary

Add 3 new question types to the flashcards app: **Cloze Deletion**, **Multi-Select**, and **Code Evaluation**. All follow the existing pattern of extending the `quizQuestions` table type enum and storing type-specific data in the `correctAnswer` JSON column.

## New Types

### 1. Cloze Deletion (`cloze`)

Anki-style cloze deletions where hidden words are replaced with text inputs.

**Storage** (`correctAnswer` JSON):
```json
{
  "text": "{{c1::Paris}} is the capital of {{c2::France}}",
  "hints": { "c1": "City of Light", "c2": "European country" }
}
```

**Behavior:**
- Creator writes text with `{{c1::hidden word}}` syntax; optional hint via `{{c1::hidden::hint}}`
- During study, one cloze group is tested at a time (c1, then c2) — each group is a sub-question
- Hidden word replaced with text input; surrounding text shown as context
- Auto-scored: case-insensitive, whitespace-trimmed match against the hidden word
- Multiple markers with the same group number (e.g. two `{{c1::...}}`) are hidden simultaneously

**Validation:**
- 1-10 cloze groups
- Text max 10,240 chars
- At least one `{{c#::...}}` marker required

### 2. Multi-Select (`multi_select`)

Like multiple choice, but multiple correct answers. User must select all correct options.

**Storage:** Uses `questionOptions` table (same as `multiple_choice`), with multiple `isCorrect: true` options.

**Behavior:**
- Rendered as checkboxes instead of radio buttons
- User must select ALL correct answers and NO incorrect ones to score correct
- After submission, shows which selections were right/wrong
- Displays "Select all that apply" badge/hint

**Validation:**
- 2-20 options
- At least 1 correct option
- At least 1 incorrect option (prevents trivial "select all" questions)

### 3. Code Evaluation (`code_eval`)

Show a code snippet and ask about its behavior. Supports both auto-scoring and AI evaluation.

**Storage** (`correctAnswer` JSON):

Auto mode:
```json
{
  "code": "console.log([1,2,3].map(x => x * 2))",
  "language": "javascript",
  "mode": "auto",
  "accepted": ["[2, 4, 6]", "[2,4,6]"]
}
```

AI mode:
```json
{
  "code": "def mystery(n): ...",
  "language": "python",
  "mode": "ai",
  "referenceAnswer": "It recursively calculates factorial"
}
```

**Behavior:**
- Shows syntax-highlighted code block (uses existing markdown code fence rendering via RichContent)
- Question text asks what code does / what's the output / find the bug
- `mode: "auto"`: text input, case-insensitive match against accepted answers (like free_text)
- `mode: "ai"`: textarea, AI-evaluated against reference answer (like open_ended)
- Language field for syntax highlighting hint

**Validation:**
- Code: required, max 51,200 chars (50KB)
- Language: optional string, defaults to plaintext
- Mode: required, either "auto" or "ai"
- Auto mode: `accepted` array of 1-10 strings required
- AI mode: `referenceAnswer` string required

## Architecture

Follows the established pattern exactly:

1. **Schema** (`packages/database/src/schema.ts`): Extend `type` enum with `"cloze"`, `"multi_select"`, `"code_eval"`
2. **Validation** (`packages/database/src/validation.ts`): Add 3 Zod schemas, extend discriminated union and batch schema
3. **Migration** (`packages/database/src/migrations/`): New migration adding enum values
4. **UI Components** (`packages/web/src/components/question-types/`): One new component per type
5. **Quiz Player** (`packages/web/src/components/quiz-player.tsx`): Add 3 conditional branches
6. **MCP Server** (`packages/mcp-server/src/tools/quiz.ts`): Add 3 types to create_quiz and list_questions tools
7. **Question List** (`packages/web/src/components/question-list.tsx`): Preview updates for new types

## Decisions

- **Cloze + Fill-in-the-blank merged**: A single-blank cloze IS a fill-in-the-blank. One type handles both.
- **Image labeling deferred**: Requires coordinate-based region editor, too complex for this batch.
- **Code eval dual mode**: Some code questions have exact answers (auto), others need nuance (AI).
- **Multi-select all-or-nothing scoring**: Partial credit adds complexity; keep it simple.
- **SQLite enum**: SQLite doesn't enforce enums at the DB level, so the migration just documents the new values. Validation happens in Zod schemas.
