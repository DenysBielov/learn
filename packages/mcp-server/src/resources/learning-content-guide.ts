import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const LEARNING_CONTENT_GUIDE = `# Learning Content Creation Guide

## Quiz Question Best Practices

### Per-Type Detailed Guidance

**multiple_choice** — Best for factual recall and distinguishing similar concepts.
- Write clear, concise stems (the question part). Avoid negative phrasing ("Which is NOT...") when possible.
- Use plausible distractors — wrong answers should represent common misconceptions, not obviously wrong choices.
- Avoid "All of the above" and "None of the above" — they reduce discrimination and often create logically flawed items.
- Keep options parallel in structure and length — the correct answer should not stand out by being longer or more detailed.

**true_false** — Best for testing common misconceptions and verifying understanding of rules/principles.
- Target specific misconceptions — a good T/F question addresses something learners commonly get wrong.
- Avoid trivially obvious statements — if everyone gets it right, it's not testing anything.
- Always include an explanation, especially for false statements — the explanation is where the learning happens.
- Mix true and false answers roughly equally across a quiz — don't make all statements false (or true).

**free_text** — Best for testing recall without cues (definitions, key terms, short explanations).
- List multiple accepted answer variants (synonyms, abbreviations, alternate phrasings) — e.g., accepted: ["mitochondria", "the mitochondria", "mitochondrion"].
- Use unambiguous phrasing so there's only one concept being tested.
- Keep expected answers short (1-3 words ideally) to make auto-scoring reliable.

**matching** — Best for associating related pairs (term↔definition, cause↔effect, input↔output, author↔work).
- Ensure balanced difficulty between left and right sides — don't make one side trivially easy.
- Use homogeneous options — all items in a matching set should be from the same category (all terms, all dates, etc.).
- Include 4-8 pairs for optimal challenge without overwhelming.

**ordering** — Best for sequential processes, timelines, priority rankings, algorithm steps.
- Ensure there's one objectively correct order — avoid items where multiple orderings are defensible.
- Use 4-7 items for optimal difficulty.
- Good for: historical events, algorithm steps, biological processes, mathematical proof steps.

**cloze** — Best for in-context recall: formulas, code snippets, key phrases, definitions within context.
- Use {{c1::answer}} syntax. Optional hints: {{c1::answer::hint text}}.
- Preserve enough surrounding context so the blank is answerable — don't remove too much.
- For complex concepts, use multiple cloze groups (c1, c2, c3) to test different parts of the same passage.
- Particularly effective for: mathematical formulas, code syntax, foreign language grammar, fill-in definitions.

**multi_select** — Best when multiple answers are correct (testing nuanced understanding, "select all that apply").
- Ensure each option is independently evaluable — selecting one shouldn't logically force another.
- Avoid "All of the above" and "None of the above" — they're even more problematic here than in MCQ.
- Include at least 1 correct and 1 incorrect option to prevent trivial "select all" answers.
- Good for: properties of a concept, symptoms of a condition, features of a system.

**code_eval** — Best for programming topics (predict output, find bugs, trace execution, evaluate expressions).
- Use realistic code snippets — contrived examples don't test real understanding.
- Frame the task clearly: "What is the output?" / "What error does this produce?" / "What does this function return for input X?"
- For auto mode: provide multiple accepted answers covering formatting variations (e.g., "[2, 4, 6]" and "[2,4,6]").
- For AI mode: write a detailed reference answer that captures the key points to evaluate against.
- Specify the language for proper syntax highlighting.

**open_ended** — Best for deeper analysis, explanations, design questions (Bloom's Apply/Analyze/Evaluate/Create).
- Write a quality reference answer that covers the key points an evaluator should look for.
- Good for: "Explain why...", "Compare and contrast...", "Design a solution for...", "What would happen if..."
- Reserve for questions where simple recall isn't sufficient — these test higher-order thinking.

### Type Distribution Rules

When creating a quiz, use a variety of question types:
- **10+ questions:** Use 4+ distinct types. No single type should exceed 40% of questions.
- **5-9 questions:** Use at least 3 distinct types.
- **Under 5 questions:** Use at least 2 distinct types.
- **Always match type to what's being tested** — diversity should serve learning goals, not be arbitrary.

### Bloom's Taxonomy Coverage

Aim to cover multiple cognitive levels:
- **Remember** (recall facts): multiple_choice, true_false, free_text, cloze
- **Understand** (explain concepts): matching, multi_select, free_text, true_false (misconception-based)
- **Apply** (use in new situations): code_eval (auto mode), ordering, cloze (procedural steps)
- **Analyze** (break down, compare): multi_select, open_ended, code_eval (AI mode)
- **Evaluate** (judge, justify): open_ended
- **Create** (design, construct): open_ended

A well-designed quiz should touch at least 2-3 cognitive levels.

### Topic-Specific Recommendations

**Mathematics:** cloze (formulas, equations), ordering (proof steps, solution procedures), free_text (definitions, theorem names), code_eval (computation, expression evaluation)

**Programming:** code_eval (output prediction, bug finding, trace execution), ordering (algorithm steps, execution order), cloze (syntax, API calls), multi_select (language features, valid approaches)

**Languages:** matching (vocabulary pairs), cloze (grammar fill-in, sentence completion), free_text (translation), ordering (sentence construction, word order)

**Sciences:** true_false (common misconceptions), matching (cause↔effect, structure↔function), multi_select (properties, characteristics), ordering (processes, life cycles)

**History/Social Sciences:** ordering (timelines, cause-and-effect sequences), multiple_choice (events, dates, figures), open_ended (analysis, interpretation), matching (person↔achievement, era↔characteristics)

**General/Mixed topics:** Use a balanced distribution across available types, weighted by what best tests the specific concepts.

### Common Pitfalls to Avoid

- **Obvious distractors** — Wrong answers that no reasonable learner would select waste a question.
- **Answer pattern bias** — Don't always put the correct answer in the same position (A) or make it the longest option.
- **Trivial true/false** — Statements so obvious they test nothing. Target real misconceptions.
- **Uniform true/false answers** — Mix true and false roughly equally across the quiz.
- **Testing the question, not the subject** — Confusing wording that tests reading comprehension rather than domain knowledge.
- **"All of the above" / "None of the above"** — Avoid in both multiple_choice and multi_select.
- **Trivial recall over understanding** — Prefer questions that test comprehension and application over rote memorization of trivia.

## Flashcard Creation Principles

### Core Rules

1. **Understand before memorizing** — Don't create cards for material that hasn't been comprehended. Cards should reinforce understanding, not replace it.
2. **One concept per card** — Test exactly one thing. Break complex ideas into multiple cards. Simple cards are easier to schedule and review.
3. **Keep answers short** — Ideally one word or brief phrase. Long answers are hard to self-grade.
4. **Use cloze deletions** — Fill-in-the-blank format is easy to create and effective for retention. Good for formulas, definitions, code syntax.
5. **Avoid enumerations** — Don't ask "List all X" or "Name the three Y." Test individual items as separate cards.
6. **Combat interference** — For easily confused concepts (e.g., similar terms, related formulas), add cards that explicitly distinguish them.
7. **Include context cues** — Add topic labels or category indicators. Cards should be comprehensible when reviewed in mixed decks.
8. **Use precise wording** — Ambiguous questions cause unreliable self-grading. Each card should have exactly one correct answer.
9. **Avoid yes/no questions** — Replace with direct questions or cloze format. "Is X true?" is weaker than "What is X?"
10. **Provide sources** — Include where the information comes from, so learners can verify or dive deeper.

### Card Quality Checklist

Before creating a flashcard, verify:
- Tests exactly one thing (not multiple sub-concepts)
- Answer is unambiguous (only one correct response possible)
- Context-independent (comprehensible without seeing other cards)
- Precise, concise wording (no unnecessary words)
- No enumeration (not "list all..." or "name the three...")

## Learning Science Principles

### Why Varied Formats Matter
- **Variable retrieval** (different formats for the same concept) boosts learning beyond simple spacing alone.
- The effectiveness of different question formats (short-answer vs. MCQ) is debated in research — meta-analyses show mixed results. Using a **mix of formats** is the safest strategy for maximizing the testing effect.
- **Free recall** produces strong learning effects when learners have sufficient prior exposure. For new or poorly encoded material, start with more supportive formats (recognition, cued recall) before progressing to free recall.
- **Transfer-appropriate processing** — Practice format should match the format in which knowledge will actually be used.

### Desirable Difficulty
- Higher effort during retrieval = stronger long-term retention. Easy, fluent studying feels productive but builds weak memory traces.
- Questions should challenge without being impossible — tasks near the boundary of a learner's current ability produce the strongest retention gains.
- If a question is too easy (everyone gets it right), it's not creating enough retrieval effort. If too hard (no one gets it right), it's creating frustration, not learning.

### Bloom's Taxonomy
- Flashcards and simple quizzes mainly cover **Remember** and **Understand**.
- **Application, analysis, evaluation, and creation** require different question types: code_eval for applying knowledge, open_ended for analysis and evaluation, ordering for procedural application.
- A well-designed quiz should touch **multiple cognitive levels**, not just test recall.
`;

export function registerResources(server: McpServer) {
  server.resource(
    "learning_content_guide",
    "flashcards://guides/learning-content",
    {
      description: "Best practices guide for creating effective flashcards and quiz questions. Read this before generating learning content.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: LEARNING_CONTENT_GUIDE,
        mimeType: "text/plain",
      }],
    })
  );
}
