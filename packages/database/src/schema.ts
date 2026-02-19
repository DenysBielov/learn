// packages/database/src/schema.ts
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey, unique, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// --- User ---
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mcpTokenHash: text("mcp_token_hash"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// --- Deck ---
export const decks = sqliteTable("deck", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").default(""),
  userId: integer("user_id").notNull().references(() => users.id).default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_deck_user").on(table.userId),
]);

// --- Course ---
export const courses = sqliteTable("course", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id").references((): AnySQLiteColumn => courses.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id).default(1),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#6366f1"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_course_parent_position").on(table.parentId, table.position),
  index("idx_course_user").on(table.userId),
]);

// --- CourseDeck (join) ---
export const courseDecks = sqliteTable("course_deck", {
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.courseId, table.deckId] }),
  index("idx_course_deck_deck").on(table.deckId),
]);

// --- Tag ---
export const tags = sqliteTable("tag", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  userId: integer("user_id").notNull().references(() => users.id).default(1),
  color: text("color").default("#6366f1"),
}, (table) => [
  uniqueIndex("idx_tag_name_user").on(table.name, table.userId),
]);

// --- Flashcard ---
export const flashcards = sqliteTable("flashcard", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  easeFactor: real("ease_factor").notNull().default(2.5),
  interval: integer("interval").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  nextReviewAt: integer("next_review_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_flashcard_next_review").on(table.nextReviewAt, table.deckId),
  index("idx_flashcard_deck").on(table.deckId),
]);

// --- FlashcardTag (join) ---
export const flashcardTags = sqliteTable("flashcard_tag", {
  flashcardId: integer("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.flashcardId, table.tagId] }),
  index("idx_flashcard_tag_flashcard").on(table.flashcardId),
  index("idx_flashcard_tag_tag").on(table.tagId),
]);

// --- QuizQuestion ---
export const quizQuestions = sqliteTable("quiz_question", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["multiple_choice", "true_false", "free_text", "matching", "ordering", "open_ended", "cloze", "multi_select", "code_eval"] }).notNull(),
  question: text("question").notNull(),
  explanation: text("explanation").default(""),
  correctAnswer: text("correct_answer"), // JSON for free_text, matching, ordering types
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_question_deck").on(table.deckId),
  index("idx_question_type").on(table.type),
]);

// --- QuestionOption (normalized for multiple_choice / true_false) ---
export const questionOptions = sqliteTable("question_option", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  index("idx_option_question").on(table.questionId),
]);

// --- QuestionTag (join) ---
export const questionTags = sqliteTable("question_tag", {
  questionId: integer("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.questionId, table.tagId] }),
  index("idx_question_tag_question").on(table.questionId),
  index("idx_question_tag_tag").on(table.tagId),
]);

// --- StudySession ---
export const studySessions = sqliteTable("study_session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id).default(1),
  deckId: integer("deck_id").references(() => decks.id, { onDelete: "cascade" }),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["flashcard", "quiz"] }).notNull(),
  subMode: text("sub_mode"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  notes: text("notes"),
}, (table) => [
  index("idx_study_session_deck").on(table.deckId),
  index("idx_study_session_course").on(table.courseId),
  index("idx_study_session_started_at").on(table.startedAt),
  index("idx_study_session_user").on(table.userId),
]);

// --- FlashcardResult ---
export const flashcardResults = sqliteTable("flashcard_result", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }),
  flashcardId: integer("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  userAnswer: text("user_answer").default(""),
  timeSpentMs: integer("time_spent_ms").default(0),
}, (table) => [
  index("idx_flashcard_result_session").on(table.sessionId),
  index("idx_flashcard_result_card_correct").on(table.flashcardId, table.correct),
]);

// --- QuizResult ---
export const quizResults = sqliteTable("quiz_result", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  userAnswer: text("user_answer").default(""),
  timeSpentMs: integer("time_spent_ms").default(0),
}, (table) => [
  index("idx_quiz_result_session").on(table.sessionId),
  index("idx_quiz_result_question_correct").on(table.questionId, table.correct),
]);

// --- CardFlag ---
export const cardFlags = sqliteTable("card_flag", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  flashcardId: integer("flashcard_id").references(() => flashcards.id, { onDelete: "cascade" }),
  questionId: integer("question_id").references(() => quizQuestions.id, { onDelete: "cascade" }),
  flagType: text("flag_type").notNull(), // 'requires_review' | 'requires_more_study'
  comment: text("comment"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_card_flag_user").on(table.userId),
  index("idx_card_flag_flashcard").on(table.flashcardId),
  index("idx_card_flag_question").on(table.questionId),
]);

// --- ChatConversation ---
export const chatConversations = sqliteTable("chat_conversation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  flashcardId: integer("flashcard_id").references(() => flashcards.id, { onDelete: "cascade" }),
  questionId: integer("question_id").references(() => quizQuestions.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => studySessions.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("idx_conv_user_flashcard").on(table.userId, table.flashcardId).where(sql`${table.flashcardId} IS NOT NULL`),
  uniqueIndex("idx_conv_user_question").on(table.userId, table.questionId).where(sql`${table.questionId} IS NOT NULL`),
  uniqueIndex("idx_conv_user_session").on(table.userId, table.sessionId).where(sql`${table.sessionId} IS NOT NULL`),
]);

// --- ChatMessage ---
export const chatMessages = sqliteTable("chat_message", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content"),
  imageUrl: text("image_url"), // filename only, e.g. "abc-def.png"
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_chat_message_conversation").on(table.conversationId),
]);

// --- PushSubscription ---
export const pushSubscriptions = sqliteTable("push_subscription", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  unique().on(table.userId, table.endpoint),
]);

// --- Relations ---
export const deckRelations = relations(decks, ({ one, many }) => ({
  user: one(users, { fields: [decks.userId], references: [users.id] }),
  flashcards: many(flashcards),
  quizQuestions: many(quizQuestions),
  studySessions: many(studySessions),
  courseDecks: many(courseDecks),
}));

export const flashcardRelations = relations(flashcards, ({ one, many }) => ({
  deck: one(decks, { fields: [flashcards.deckId], references: [decks.id] }),
  tags: many(flashcardTags),
  results: many(flashcardResults),
  flags: many(cardFlags),
}));

export const quizQuestionRelations = relations(quizQuestions, ({ one, many }) => ({
  deck: one(decks, { fields: [quizQuestions.deckId], references: [decks.id] }),
  options: many(questionOptions),
  tags: many(questionTags),
  results: many(quizResults),
  flags: many(cardFlags),
}));

export const questionOptionRelations = relations(questionOptions, ({ one }) => ({
  question: one(quizQuestions, { fields: [questionOptions.questionId], references: [quizQuestions.id] }),
}));

export const flashcardTagRelations = relations(flashcardTags, ({ one }) => ({
  flashcard: one(flashcards, { fields: [flashcardTags.flashcardId], references: [flashcards.id] }),
  tag: one(tags, { fields: [flashcardTags.tagId], references: [tags.id] }),
}));

export const questionTagRelations = relations(questionTags, ({ one }) => ({
  question: one(quizQuestions, { fields: [questionTags.questionId], references: [quizQuestions.id] }),
  tag: one(tags, { fields: [questionTags.tagId], references: [tags.id] }),
}));

export const courseRelations = relations(courses, ({ one, many }) => ({
  user: one(users, { fields: [courses.userId], references: [users.id] }),
  parent: one(courses, { fields: [courses.parentId], references: [courses.id], relationName: "courseParent" }),
  children: many(courses, { relationName: "courseParent" }),
  courseDecks: many(courseDecks),
  studySessions: many(studySessions),
}));

export const courseDeckRelations = relations(courseDecks, ({ one }) => ({
  course: one(courses, { fields: [courseDecks.courseId], references: [courses.id] }),
  deck: one(decks, { fields: [courseDecks.deckId], references: [decks.id] }),
}));

export const studySessionRelations = relations(studySessions, ({ one, many }) => ({
  user: one(users, { fields: [studySessions.userId], references: [users.id] }),
  deck: one(decks, { fields: [studySessions.deckId], references: [decks.id] }),
  course: one(courses, { fields: [studySessions.courseId], references: [courses.id] }),
  flashcardResults: many(flashcardResults),
  quizResults: many(quizResults),
}));

export const flashcardResultRelations = relations(flashcardResults, ({ one }) => ({
  session: one(studySessions, { fields: [flashcardResults.sessionId], references: [studySessions.id] }),
  flashcard: one(flashcards, { fields: [flashcardResults.flashcardId], references: [flashcards.id] }),
}));

export const quizResultRelations = relations(quizResults, ({ one }) => ({
  session: one(studySessions, { fields: [quizResults.sessionId], references: [studySessions.id] }),
  question: one(quizQuestions, { fields: [quizResults.questionId], references: [quizQuestions.id] }),
}));

export const cardFlagRelations = relations(cardFlags, ({ one }) => ({
  user: one(users, { fields: [cardFlags.userId], references: [users.id] }),
  flashcard: one(flashcards, { fields: [cardFlags.flashcardId], references: [flashcards.id] }),
  question: one(quizQuestions, { fields: [cardFlags.questionId], references: [quizQuestions.id] }),
}));

export const chatConversationRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, { fields: [chatConversations.userId], references: [users.id] }),
  flashcard: one(flashcards, { fields: [chatConversations.flashcardId], references: [flashcards.id] }),
  question: one(quizQuestions, { fields: [chatConversations.questionId], references: [quizQuestions.id] }),
  session: one(studySessions, { fields: [chatConversations.sessionId], references: [studySessions.id] }),
  messages: many(chatMessages),
}));

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, { fields: [chatMessages.conversationId], references: [chatConversations.id] }),
}));

export const tagRelations = relations(tags, ({ one }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
}));

export const userRelations = relations(users, ({ many }) => ({
  decks: many(decks),
  courses: many(courses),
  tags: many(tags),
  studySessions: many(studySessions),
  chatConversations: many(chatConversations),
}));
