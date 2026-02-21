# Roadmap

## 1. "Learned" / Archive mechanism

Currently some quiz questions and flashcards have been answered so many times that reviewing them no longer adds value. We need a way to mark items as "learned", which effectively archives them and removes them from active rotation.

- Applies to both flashcards and quiz questions
- "Learned" items should be excluded from study sessions and the learning queue
- Should be reversible (un-archive if needed)
- Could be triggered manually or automatically based on streak/confidence threshold

## 2. Tag system for cards and questions

Add tags to flashcards and quiz questions for granular subtopic filtering without needing separate courses/subcourses.

- Example: learning linear algebra — tag cards with `null-vectors`, `determinant`, `eigenvalues`, `matrix-multiplication`, etc.
- Should be able to filter/review by any combination of tags
- Tags are cross-cutting — a card can belong to a course AND have multiple tags
- Tags complement the course/topic hierarchy, not replace it
- Useful for targeted revision of specific subtopics within a broader subject
- Auto-suggest existing tags when adding new ones
- Possibly AI-assisted tagging for bulk operations

## 3. Full learning platform restructuring

Transform the app from a flashcards/quiz tool into a comprehensive learning platform. Based on research (see `docs/research/`), the rework should incorporate:

### Content types
- **Flashcards** (existing) — with FSRS-based spaced repetition for 20-30% efficiency gain over current SM-2
- **Quizzes** (existing) — multiple question types (MCQ, short answer, cloze, code eval)
- **Materials** — learning content, notes, reference docs
- **Learning plans** — structured study paths with prerequisite graphs (currently in Obsidian, migrate here)

### Organizational model
- **Courses/Topics** as the top-level container, grouping materials + flashcards + quizzes
- **Tags** for cross-cutting subtopic filtering (see item 2)
- **Learning paths** that sequence courses with prerequisite dependencies (Khan Academy model)
- **Mastery levels** per topic (Not Started -> Familiar -> Proficient -> Mastered) instead of just percentages
- Decks become a flat view within a course, not the primary organizational unit
- Migration path from current deck-based structure

### Learning science principles to apply
- **FSRS algorithm** — ML-based personalized scheduling (highest ROI single change)
- **Varied retrieval formats** — don't just flip cards, mix question types for same concept
- **Interleaving strategy** — block new topics first, then interleave during review
- **Objective mastery criteria** — use interval + accuracy thresholds for "learned" status, not subjective judgment
- **Bloom's taxonomy coverage** — flashcards cover Remember/Understand, need projects/practice for Apply/Analyze/Create
- **Active recall over passive review** — 57% vs 29% retention

### Features borrowed from other platforms
- **Bidirectional notes <-> cards** (RemNote model) — cards always link to source material
- **AI card generation** from notes/materials
- **Incremental reading** (SuperMemo model) — extract -> simplify -> card workflow for large reading lists
- **Progress visualization** — mastery levels, knowledge maps, optional streaks
- **Microlearning sessions** — short focused review sessions (5-15 min)

### Key design challenges
- How to migrate existing decks into the new course/topic structure
- Balancing complexity of a full platform with simplicity of the current UX
- FSRS implementation — from scratch or adapt existing open-source
- How to handle the notes/materials editor (markdown? rich text? notion-like blocks?)

## 4. MCP server instructions for AI-driven quiz generation

AI agents creating quizzes via the MCP server tend to default to 2-3 question types (mostly `multiple_choice` and `true_false`), ignoring the full variety available. The MCP server should provide explicit guidance so agents generate pedagogically effective, varied quizzes.

### Problem

- The `create_quiz` tool lists supported types but gives no guidance on when to use each
- No information about what makes a good question of each type
- No recommended distribution across types for a given topic
- Agents have no context on learning science principles (varied retrieval, Bloom's taxonomy coverage, etc.)

### Solution: Add MCP server instructions / resources

- **Tool description enrichment** — expand `create_quiz` description with per-type guidance:
  - `multiple_choice` — best for factual recall, distinguish similar concepts; use plausible distractors
  - `true_false` — good for common misconceptions; always include explanation for false statements
  - `free_text` — tests recall without cues; use for definitions, key terms, short explanations
  - `matching` — great for associating related pairs (term↔definition, cause↔effect, input↔output)
  - `ordering` — ideal for sequential processes, timelines, priority rankings, algorithm steps
  - `cloze` — tests in-context recall; use `{{c1::answer}}` syntax; good for formulas, code snippets, key phrases
  - `multi_select` — when multiple answers are correct; tests nuanced understanding ("select all that apply")
  - `code_eval` — for programming topics; provide starter code or ask to write functions/expressions
  - `open_ended` — for deeper analysis, essay-style responses, design questions (Bloom's Apply/Analyze/Create)
- **Recommended type distribution** — suggest a mix per quiz (e.g., no more than 40% of any single type; aim for 4+ distinct types per quiz of 10+ questions)
- **MCP resource or prompt** — consider exposing a `quiz_generation_guide` resource that agents can read before generating, covering:
  - Learning science principles (varied retrieval formats, interleaving)
  - Per-type best practices and examples
  - Common pitfalls (too-easy true/false, obvious distractors, etc.)
  - Topic-specific recommendations (math → cloze + ordering, programming → code_eval + free_text, languages → matching + cloze, etc.)

## 5. Navigate back to previous quiz questions

Currently there's no way to go back to a previous question during a quiz session. If you accidentally skip or want to review/change a previous answer, you're stuck.

- Add a "Previous" button alongside the existing "Next" in quiz sessions
- Should restore the previous question with the user's submitted answer visible
- Respect already-answered state — navigating back shows what was selected, not a blank question
- Consider whether to allow changing answers (probably yes, since it's a learning tool, not an exam)

## 6. Change how answers are shown for particular question types

For types like match questions we need to show answers inline somehow, so it is easier to understad. maybe croos incorrect answer and show correct answer.

## 7. Make match questions drag and drop

Current select implemenatition is fine, but lacks interactivity and requires too many clicks.
