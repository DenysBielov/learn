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

## 4. Change how answers are shown for particular question types

For types like match questions we need to show answers inline somehow, so it is easier to understad. maybe croos incorrect answer and show correct answer.

## 5. Make match questions drag and drop

Current select implemenatition is fine, but lacks interactivity and requires too many clicks.
