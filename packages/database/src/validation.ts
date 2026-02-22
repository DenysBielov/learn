// packages/database/src/validation.ts
import { z } from "zod";

// --- Max sizes (from design doc) ---
const MAX_QUESTION_TEXT = 10240; // 10KB
const MAX_EXPLANATION = 5120; // 5KB
const MAX_FLASHCARD_SIDE = 10240; // 10KB
const MAX_OPTION_TEXT = 500;
const MAX_OPTIONS = 20;
const MAX_USER_ANSWER = 10000;

// --- Deck ---
export const createDeckSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
});

// --- Tag ---
export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

// --- Flashcard ---
export const createFlashcardSchema = z.object({
  deckId: z.number().int().positive(),
  front: z.string().min(1).max(MAX_FLASHCARD_SIDE),
  back: z.string().min(1).max(MAX_FLASHCARD_SIDE),
  sourceMaterialId: z.number().int().positive().optional(),
});

export const createFlashcardBatchSchema = z.object({
  deckId: z.number().int().positive(),
  sourceMaterialId: z.number().int().positive().optional(),
  cards: z.array(z.object({
    front: z.string().min(1).max(MAX_FLASHCARD_SIDE),
    back: z.string().min(1).max(MAX_FLASHCARD_SIDE),
  })).min(1).max(100),
});

// --- Quiz Question: per-type correct answer schemas ---
export const matchingAnswerSchema = z.array(z.object({
  left: z.string().max(MAX_OPTION_TEXT),
  right: z.string().max(MAX_OPTION_TEXT),
})).min(2).max(MAX_OPTIONS);

export const orderingAnswerSchema = z.array(
  z.string().max(MAX_OPTION_TEXT)
).min(2).max(MAX_OPTIONS);

export const freeTextAnswerSchema = z.object({
  accepted: z.array(z.string().max(1000)).min(1).max(10),
});

// --- Quiz Question: option for multiple_choice / true_false ---
export const questionOptionSchema = z.object({
  optionText: z.string().min(1).max(MAX_OPTION_TEXT),
  isCorrect: z.boolean(),
});

// --- Quiz Question: create schema per type ---
const baseQuestionSchema = z.object({
  deckId: z.number().int().positive(),
  question: z.string().min(1).max(MAX_QUESTION_TEXT),
  explanation: z.string().max(MAX_EXPLANATION).default(""),
  sourceMaterialId: z.number().int().positive().optional(),
});

export const createMultipleChoiceSchema = baseQuestionSchema.extend({
  type: z.literal("multiple_choice"),
  options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS)
    .refine(opts => opts.some(o => o.isCorrect), "At least one option must be correct"),
});

export const createTrueFalseSchema = baseQuestionSchema.extend({
  type: z.literal("true_false"),
  options: z.array(questionOptionSchema).length(2)
    .refine(opts => opts.filter(o => o.isCorrect).length === 1, "Exactly one option must be correct"),
});

export const createFreeTextSchema = baseQuestionSchema.extend({
  type: z.literal("free_text"),
  correctAnswer: freeTextAnswerSchema,
});

export const createMatchingSchema = baseQuestionSchema.extend({
  type: z.literal("matching"),
  correctAnswer: matchingAnswerSchema,
});

export const createOrderingSchema = baseQuestionSchema.extend({
  type: z.literal("ordering"),
  correctAnswer: orderingAnswerSchema,
});

export const createOpenEndedSchema = baseQuestionSchema.extend({
  type: z.literal("open_ended"),
  correctAnswer: z.object({
    referenceAnswer: z.string().max(MAX_QUESTION_TEXT),
  }),
});

// --- Cloze deletion ---
export const clozeAnswerSchema = z.object({
  text: z.string().min(1).max(MAX_QUESTION_TEXT)
    .refine(val => /\{\{c(\d+)::([^}]+)\}\}/.test(val), "Must contain at least one cloze marker like {{c1::word}}"),
});

export const createClozeSchema = baseQuestionSchema.extend({
  type: z.literal("cloze"),
  correctAnswer: clozeAnswerSchema,
});

// --- Multi-select ---
export const createMultiSelectSchema = baseQuestionSchema.extend({
  type: z.literal("multi_select"),
  options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS)
    .refine(opts => opts.some(o => o.isCorrect), "At least one option must be correct")
    .refine(opts => opts.some(o => !o.isCorrect), "At least one option must be incorrect"),
});

// --- Code evaluation ---
const codeEvalAutoSchema = z.object({
  code: z.string().min(1).max(51200),
  language: z.string().max(50).default("plaintext"),
  mode: z.literal("auto"),
  accepted: z.array(z.string().max(1000)).min(1).max(10),
});

const codeEvalAiSchema = z.object({
  code: z.string().min(1).max(51200),
  language: z.string().max(50).default("plaintext"),
  mode: z.literal("ai"),
  referenceAnswer: z.string().min(1).max(MAX_QUESTION_TEXT),
});

export const codeEvalAnswerSchema = z.discriminatedUnion("mode", [
  codeEvalAutoSchema,
  codeEvalAiSchema,
]);

export const createCodeEvalSchema = baseQuestionSchema.extend({
  type: z.literal("code_eval"),
  correctAnswer: codeEvalAnswerSchema,
});

export const createQuizQuestionSchema = z.discriminatedUnion("type", [
  createMultipleChoiceSchema,
  createTrueFalseSchema,
  createFreeTextSchema,
  createMatchingSchema,
  createOrderingSchema,
  createOpenEndedSchema,
  createClozeSchema,
  createMultiSelectSchema,
  createCodeEvalSchema,
]);

export type CreateQuizQuestion = z.infer<typeof createQuizQuestionSchema>;

// --- Batch quiz creation (per-type schemas without deckId) ---
const batchQuizQuestionSchema = z.discriminatedUnion("type", [
  createMultipleChoiceSchema.omit({ deckId: true }),
  createTrueFalseSchema.omit({ deckId: true }),
  createFreeTextSchema.omit({ deckId: true }),
  createMatchingSchema.omit({ deckId: true }),
  createOrderingSchema.omit({ deckId: true }),
  createOpenEndedSchema.omit({ deckId: true }),
  createClozeSchema.omit({ deckId: true }),
  createMultiSelectSchema.omit({ deckId: true }),
  createCodeEvalSchema.omit({ deckId: true }),
]);

export const createQuizBatchSchema = z.object({
  deckId: z.number().int().positive(),
  questions: z.array(batchQuizQuestionSchema).min(1).max(50),
});

// --- Study results ---
export const submitFlashcardResultSchema = z.object({
  sessionId: z.number().int().positive(),
  flashcardId: z.number().int().positive(),
  correct: z.boolean(),
  userAnswer: z.string().max(MAX_USER_ANSWER).default(""),
  timeSpentMs: z.number().int().min(0).default(0),
});

export const submitQuizResultSchema = z.object({
  sessionId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  correct: z.boolean(),
  userAnswer: z.string().max(MAX_USER_ANSWER).default(""),
  timeSpentMs: z.number().int().min(0).default(0),
});

// --- Course ---
export const createCourseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  parentId: z.number().int().positive().optional(),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const toggleCourseActiveSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

// --- Search ---
export const searchSchema = z.object({
  query: z.string().min(1).max(200),
  deckId: z.number().int().positive().optional(),
});

// --- Material ---
export const createMaterialSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100_000).optional(),
  externalUrl: z.string().max(2000).optional(),
}).refine(
  data => data.content || data.externalUrl,
  "Material must have content or an external URL"
);

export const updateMaterialSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100_000).optional(),
  externalUrl: z.string().max(2000).optional(),
});

// --- Standalone Quiz ---
export const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

// --- Quiz-based question schemas (quizId instead of deckId) ---
const baseQuizQuestionForQuizSchema = z.object({
  quizId: z.number().int().positive(),
  question: z.string().min(1).max(MAX_QUESTION_TEXT),
  explanation: z.string().max(MAX_EXPLANATION).default(""),
  sourceMaterialId: z.number().int().positive().optional(),
});

export const createQuizQuestionForQuizSchema = z.discriminatedUnion("type", [
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("multiple_choice"),
    options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS)
      .refine(opts => opts.some(o => o.isCorrect), "At least one option must be correct"),
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("true_false"),
    options: z.array(questionOptionSchema).length(2)
      .refine(opts => opts.filter(o => o.isCorrect).length === 1, "Exactly one option must be correct"),
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("free_text"),
    correctAnswer: freeTextAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("matching"),
    correctAnswer: matchingAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("ordering"),
    correctAnswer: orderingAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("open_ended"),
    correctAnswer: z.object({
      referenceAnswer: z.string().max(MAX_QUESTION_TEXT),
    }),
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("cloze"),
    correctAnswer: clozeAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("multi_select"),
    options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS)
      .refine(opts => opts.some(o => o.isCorrect), "At least one option must be correct")
      .refine(opts => opts.some(o => !o.isCorrect), "At least one option must be incorrect"),
  }),
  baseQuizQuestionForQuizSchema.extend({
    type: z.literal("code_eval"),
    correctAnswer: codeEvalAnswerSchema,
  }),
]);

export type CreateQuizQuestionForQuiz = z.infer<typeof createQuizQuestionForQuizSchema>;

// --- Batch quiz creation for standalone quizzes ---
const batchQuizQuestionForQuizSchema = z.discriminatedUnion("type", [
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("multiple_choice"),
    options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS)
      .refine(opts => opts.some(o => o.isCorrect), "At least one option must be correct"),
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("true_false"),
    options: z.array(questionOptionSchema).length(2)
      .refine(opts => opts.filter(o => o.isCorrect).length === 1, "Exactly one option must be correct"),
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("free_text"),
    correctAnswer: freeTextAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("matching"),
    correctAnswer: matchingAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("ordering"),
    correctAnswer: orderingAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("open_ended"),
    correctAnswer: z.object({
      referenceAnswer: z.string().max(MAX_QUESTION_TEXT),
    }),
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("cloze"),
    correctAnswer: clozeAnswerSchema,
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("multi_select"),
    options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS)
      .refine(opts => opts.some(o => o.isCorrect), "At least one option must be correct")
      .refine(opts => opts.some(o => !o.isCorrect), "At least one option must be incorrect"),
  }),
  baseQuizQuestionForQuizSchema.omit({ quizId: true }).extend({
    type: z.literal("code_eval"),
    correctAnswer: codeEvalAnswerSchema,
  }),
]);

export const createQuizBatchForQuizSchema = z.object({
  quizId: z.number().int().positive(),
  questions: z.array(batchQuizQuestionForQuizSchema).min(1).max(50),
});
