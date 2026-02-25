// packages/database/src/schema.ts
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey, unique, check, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
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
  estimatedHours: integer("estimated_hours"),
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

// --- Material ---
export const materials = sqliteTable("material", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content"),
  externalUrl: text("external_url"),
  notes: text("notes"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_material_user").on(table.userId),
]);

// --- Quiz (standalone) ---
export const quizzes = sqliteTable("quiz", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_quiz_user").on(table.userId),
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

// --- CourseStep ---
export const courseSteps = sqliteTable("course_step", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  stepType: text("step_type", { enum: ["material", "quiz"] }).notNull(),
  materialId: integer("material_id").references(() => materials.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_course_step_course_pos").on(table.courseId, table.position),
  uniqueIndex("idx_course_step_material").on(table.materialId),
  uniqueIndex("idx_course_step_quiz").on(table.quizId),
]);

// --- StepProgress ---
export const stepProgress = sqliteTable("step_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseStepId: integer("course_step_id").notNull().references(() => courseSteps.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("idx_step_progress_step_user").on(table.courseStepId, table.userId),
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
  sourceMaterialId: integer("source_material_id").references(() => materials.id, { onDelete: "set null" }),
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
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["multiple_choice", "true_false", "free_text", "matching", "ordering", "open_ended", "cloze", "multi_select", "code_eval"] }).notNull(),
  question: text("question").notNull(),
  explanation: text("explanation").default(""),
  correctAnswer: text("correct_answer"), // JSON for free_text, matching, ordering types
  sourceMaterialId: integer("source_material_id").references(() => materials.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_question_deck").on(table.deckId),
  index("idx_question_quiz").on(table.quizId),
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
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: "set null" }),
  materialId: integer("material_id").references(() => materials.id, { onDelete: "set null" }),
  mode: text("mode", { enum: ["flashcard", "quiz", "reading"] }).notNull(),
  subMode: text("sub_mode"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  summary: text("summary"),
  notes: text("notes"),
  title: text("title"),
  insights: text("insights"), // JSON array of { author, content, createdAt }
}, (table) => [
  index("idx_study_session_deck").on(table.deckId),
  index("idx_study_session_course").on(table.courseId),
  index("idx_study_session_quiz").on(table.quizId),
  index("idx_study_session_material").on(table.materialId),
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

// --- LearningMaterial ---
export const learningMaterials = sqliteTable("learning_material", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  flashcardId: integer("flashcard_id").references(() => flashcards.id, { onDelete: "cascade" }),
  questionId: integer("question_id").references(() => quizQuestions.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  type: text("type", { enum: ["article", "video", "obsidian", "other"] }).notNull().default("article"),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_learning_material_flashcard").on(table.flashcardId),
  index("idx_learning_material_question").on(table.questionId),
]);

// --- ChatConversation ---
export const chatConversations = sqliteTable("chat_conversation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  flashcardId: integer("flashcard_id").references(() => flashcards.id, { onDelete: "cascade" }),
  questionId: integer("question_id").references(() => quizQuestions.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => studySessions.id, { onDelete: "cascade" }),
  materialId: integer("material_id").references(() => materials.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("idx_conv_user_flashcard").on(table.userId, table.flashcardId).where(sql`${table.flashcardId} IS NOT NULL`),
  uniqueIndex("idx_conv_user_question").on(table.userId, table.questionId).where(sql`${table.questionId} IS NOT NULL`),
  uniqueIndex("idx_conv_user_session").on(table.userId, table.sessionId).where(sql`${table.sessionId} IS NOT NULL`),
  uniqueIndex("idx_conv_user_material").on(table.userId, table.materialId).where(sql`${table.materialId} IS NOT NULL`),
  check("chk_conv_scope_exactly_one", sql`
  (CASE WHEN ${table.flashcardId} IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN ${table.questionId} IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN ${table.sessionId} IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN ${table.materialId} IS NOT NULL THEN 1 ELSE 0 END) = 1
`),
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

// --- LearningDependency ---
export const learningDependencies = sqliteTable("learning_dependency", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseItemId: integer("course_item_id").references(() => courses.id, { onDelete: "cascade" }),
  materialItemId: integer("material_item_id").references(() => materials.id, { onDelete: "cascade" }),
  dependsOnCourseId: integer("depends_on_course_id").references(() => courses.id, { onDelete: "cascade" }),
  dependsOnMaterialId: integer("depends_on_material_id").references(() => materials.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("idx_dep_cc").on(table.courseItemId, table.dependsOnCourseId)
    .where(sql`${table.courseItemId} IS NOT NULL AND ${table.dependsOnCourseId} IS NOT NULL`),
  uniqueIndex("idx_dep_cm").on(table.courseItemId, table.dependsOnMaterialId)
    .where(sql`${table.courseItemId} IS NOT NULL AND ${table.dependsOnMaterialId} IS NOT NULL`),
  uniqueIndex("idx_dep_mc").on(table.materialItemId, table.dependsOnCourseId)
    .where(sql`${table.materialItemId} IS NOT NULL AND ${table.dependsOnCourseId} IS NOT NULL`),
  uniqueIndex("idx_dep_mm").on(table.materialItemId, table.dependsOnMaterialId)
    .where(sql`${table.materialItemId} IS NOT NULL AND ${table.dependsOnMaterialId} IS NOT NULL`),
  check("chk_dep_item_xor", sql`(course_item_id IS NOT NULL AND material_item_id IS NULL) OR (course_item_id IS NULL AND material_item_id IS NOT NULL)`),
  check("chk_dep_target_xor", sql`(depends_on_course_id IS NOT NULL AND depends_on_material_id IS NULL) OR (depends_on_course_id IS NULL AND depends_on_material_id IS NOT NULL)`),
]);

// --- MaterialTag (join) ---
export const materialTags = sqliteTable("material_tag", {
  materialId: integer("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.materialId, table.tagId] }),
  index("idx_material_tag_material").on(table.materialId),
  index("idx_material_tag_tag").on(table.tagId),
]);

// --- MaterialDeck (join) ---
export const materialDecks = sqliteTable("material_deck", {
  materialId: integer("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.materialId, table.deckId] }),
  index("idx_material_deck_deck").on(table.deckId),
]);

// --- MaterialQuiz (join) ---
export const materialQuizzes = sqliteTable("material_quiz", {
  materialId: integer("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.materialId, table.quizId] }),
  index("idx_material_quiz_quiz").on(table.quizId),
]);

// --- MaterialResource ---
export const materialResources = sqliteTable("material_resource", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  materialId: integer("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  type: text("type", { enum: ["article", "video", "documentation", "obsidian", "other"] }).notNull().default("other"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_material_resource_material").on(table.materialId),
  check("chk_url_protocol", sql`url LIKE 'http://%' OR url LIKE 'https://%'`),
]);

// --- Event ---
export const events = sqliteTable("event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("idx_events_created_at").on(table.createdAt),
  index("idx_events_user_created").on(table.userId, table.createdAt),
]);

// --- Relations ---
export const deckRelations = relations(decks, ({ one, many }) => ({
  user: one(users, { fields: [decks.userId], references: [users.id] }),
  flashcards: many(flashcards),
  quizQuestions: many(quizQuestions),
  studySessions: many(studySessions),
  courseDecks: many(courseDecks),
  materialDecks: many(materialDecks),
}));

export const flashcardRelations = relations(flashcards, ({ one, many }) => ({
  deck: one(decks, { fields: [flashcards.deckId], references: [decks.id] }),
  sourceMaterial: one(materials, { fields: [flashcards.sourceMaterialId], references: [materials.id] }),
  tags: many(flashcardTags),
  results: many(flashcardResults),
  flags: many(cardFlags),
  learningMaterials: many(learningMaterials),
}));

export const materialRelations = relations(materials, ({ one, many }) => ({
  user: one(users, { fields: [materials.userId], references: [users.id] }),
  courseStep: many(courseSteps),
  materialTags: many(materialTags),
  materialDecks: many(materialDecks),
  materialQuizzes: many(materialQuizzes),
  materialResources: many(materialResources),
  sourcedFlashcards: many(flashcards),
  sourcedQuestions: many(quizQuestions),
  studySessions: many(studySessions),
  dependenciesAsItem: many(learningDependencies, { relationName: "depMaterialItem" }),
  dependenciesAsTarget: many(learningDependencies, { relationName: "depOnMaterial" }),
}));

export const quizRelations = relations(quizzes, ({ one, many }) => ({
  user: one(users, { fields: [quizzes.userId], references: [users.id] }),
  questions: many(quizQuestions),
  courseStep: many(courseSteps),
  studySessions: many(studySessions),
  materialQuizzes: many(materialQuizzes),
}));

export const courseStepRelations = relations(courseSteps, ({ one, many }) => ({
  course: one(courses, { fields: [courseSteps.courseId], references: [courses.id] }),
  material: one(materials, { fields: [courseSteps.materialId], references: [materials.id] }),
  quiz: one(quizzes, { fields: [courseSteps.quizId], references: [quizzes.id] }),
  progress: many(stepProgress),
}));

export const stepProgressRelations = relations(stepProgress, ({ one }) => ({
  courseStep: one(courseSteps, { fields: [stepProgress.courseStepId], references: [courseSteps.id] }),
  user: one(users, { fields: [stepProgress.userId], references: [users.id] }),
}));

export const quizQuestionRelations = relations(quizQuestions, ({ one, many }) => ({
  deck: one(decks, { fields: [quizQuestions.deckId], references: [decks.id] }),
  quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }),
  sourceMaterial: one(materials, { fields: [quizQuestions.sourceMaterialId], references: [materials.id] }),
  options: many(questionOptions),
  tags: many(questionTags),
  results: many(quizResults),
  flags: many(cardFlags),
  learningMaterials: many(learningMaterials),
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
  courseSteps: many(courseSteps),
  studySessions: many(studySessions),
  dependenciesAsItem: many(learningDependencies, { relationName: "depCourseItem" }),
  dependenciesAsTarget: many(learningDependencies, { relationName: "depOnCourse" }),
}));

export const courseDeckRelations = relations(courseDecks, ({ one }) => ({
  course: one(courses, { fields: [courseDecks.courseId], references: [courses.id] }),
  deck: one(decks, { fields: [courseDecks.deckId], references: [decks.id] }),
}));

export const studySessionRelations = relations(studySessions, ({ one, many }) => ({
  user: one(users, { fields: [studySessions.userId], references: [users.id] }),
  deck: one(decks, { fields: [studySessions.deckId], references: [decks.id] }),
  course: one(courses, { fields: [studySessions.courseId], references: [courses.id] }),
  quiz: one(quizzes, { fields: [studySessions.quizId], references: [quizzes.id] }),
  material: one(materials, { fields: [studySessions.materialId], references: [materials.id] }),
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

export const learningMaterialRelations = relations(learningMaterials, ({ one }) => ({
  flashcard: one(flashcards, { fields: [learningMaterials.flashcardId], references: [flashcards.id] }),
  question: one(quizQuestions, { fields: [learningMaterials.questionId], references: [quizQuestions.id] }),
}));

export const chatConversationRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, { fields: [chatConversations.userId], references: [users.id] }),
  flashcard: one(flashcards, { fields: [chatConversations.flashcardId], references: [flashcards.id] }),
  question: one(quizQuestions, { fields: [chatConversations.questionId], references: [quizQuestions.id] }),
  session: one(studySessions, { fields: [chatConversations.sessionId], references: [studySessions.id] }),
  material: one(materials, { fields: [chatConversations.materialId], references: [materials.id] }),
  messages: many(chatMessages),
}));

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, { fields: [chatMessages.conversationId], references: [chatConversations.id] }),
}));

export const tagRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  flashcardTags: many(flashcardTags),
  questionTags: many(questionTags),
  materialTags: many(materialTags),
}));

export const learningDependenciesRelations = relations(learningDependencies, ({ one }) => ({
  courseItem: one(courses, { fields: [learningDependencies.courseItemId], references: [courses.id], relationName: "depCourseItem" }),
  materialItem: one(materials, { fields: [learningDependencies.materialItemId], references: [materials.id], relationName: "depMaterialItem" }),
  dependsOnCourse: one(courses, { fields: [learningDependencies.dependsOnCourseId], references: [courses.id], relationName: "depOnCourse" }),
  dependsOnMaterial: one(materials, { fields: [learningDependencies.dependsOnMaterialId], references: [materials.id], relationName: "depOnMaterial" }),
}));

export const materialTagsRelations = relations(materialTags, ({ one }) => ({
  material: one(materials, { fields: [materialTags.materialId], references: [materials.id] }),
  tag: one(tags, { fields: [materialTags.tagId], references: [tags.id] }),
}));

export const materialDecksRelations = relations(materialDecks, ({ one }) => ({
  material: one(materials, { fields: [materialDecks.materialId], references: [materials.id] }),
  deck: one(decks, { fields: [materialDecks.deckId], references: [decks.id] }),
}));

export const materialQuizzesRelations = relations(materialQuizzes, ({ one }) => ({
  material: one(materials, { fields: [materialQuizzes.materialId], references: [materials.id] }),
  quiz: one(quizzes, { fields: [materialQuizzes.quizId], references: [quizzes.id] }),
}));

export const materialResourcesRelations = relations(materialResources, ({ one }) => ({
  material: one(materials, { fields: [materialResources.materialId], references: [materials.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, { fields: [events.userId], references: [users.id] }),
}));

export const userRelations = relations(users, ({ many }) => ({
  decks: many(decks),
  courses: many(courses),
  materials: many(materials),
  quizzes: many(quizzes),
  tags: many(tags),
  studySessions: many(studySessions),
  chatConversations: many(chatConversations),
}));
