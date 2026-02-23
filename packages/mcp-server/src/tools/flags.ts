import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { type AppDatabase, cardFlags, flashcards, quizQuestions, questionOptions, decks, courses, courseDecks, writeTransaction } from "@flashcards/database";
import { emitEvent } from "@flashcards/database/events";

export function registerFlagTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "list_flagged_items",
    "List all flagged flashcards and quiz questions with their details. Filterable by flag_type and resolved status.",
    {
      flag_type: z.enum(["requires_review", "requires_more_study"]).optional().describe("Filter by flag type"),
      include_resolved: z.boolean().optional().default(false).describe("Include resolved flags"),
    },
    async ({ flag_type, include_resolved }) => {
      const conditions = [eq(cardFlags.userId, userId)];
      if (flag_type) conditions.push(eq(cardFlags.flagType, flag_type));
      if (!include_resolved) conditions.push(isNull(cardFlags.resolvedAt));

      const flags = db.select({
        id: cardFlags.id,
        flagType: cardFlags.flagType,
        comment: cardFlags.comment,
        resolvedAt: cardFlags.resolvedAt,
        createdAt: cardFlags.createdAt,
        flashcardId: cardFlags.flashcardId,
        questionId: cardFlags.questionId,
        // Flashcard details
        flashcardFront: flashcards.front,
        flashcardBack: flashcards.back,
        // Question details
        questionText: quizQuestions.question,
        questionType: quizQuestions.type,
        // Deck info
        deckName: decks.name,
      })
        .from(cardFlags)
        .leftJoin(flashcards, eq(cardFlags.flashcardId, flashcards.id))
        .leftJoin(quizQuestions, eq(cardFlags.questionId, quizQuestions.id))
        .leftJoin(decks, sql`${decks.id} = COALESCE(${flashcards.deckId}, ${quizQuestions.deckId})`)
        .where(and(...conditions))
        .all();

      const result = flags.map(f => ({
        id: f.id,
        flagType: f.flagType,
        comment: f.comment,
        resolvedAt: f.resolvedAt,
        createdAt: f.createdAt,
        item: f.flashcardId ? {
          type: "flashcard" as const,
          id: f.flashcardId,
          front: f.flashcardFront,
          back: f.flashcardBack,
          deckName: f.deckName,
        } : {
          type: "question" as const,
          id: f.questionId,
          question: f.questionText,
          questionType: f.questionType,
          deckName: f.deckName,
        },
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "resolve_flag",
    "Mark a flag as resolved (sets resolved_at timestamp)",
    {
      flag_id: z.number().int().positive().describe("The flag ID to resolve"),
    },
    async ({ flag_id }) => {
      const flag = db.select({ id: cardFlags.id })
        .from(cardFlags)
        .where(and(eq(cardFlags.id, flag_id), eq(cardFlags.userId, userId)))
        .get();

      if (!flag) {
        return { content: [{ type: "text" as const, text: "Flag not found" }], isError: true };
      }

      writeTransaction(db, () =>
        db.update(cardFlags)
          .set({ resolvedAt: new Date() })
          .where(eq(cardFlags.id, flag_id))
          .run()
      );

      emitEvent(db, userId, "flag.resolved", { flagId: flag_id });
      return { content: [{ type: "text" as const, text: `Flag ${flag_id} resolved` }] };
    }
  );

  server.tool(
    "add_flag",
    "Flag a flashcard or quiz question programmatically",
    {
      flashcard_id: z.number().int().positive().optional().describe("Flashcard ID to flag"),
      question_id: z.number().int().positive().optional().describe("Quiz question ID to flag"),
      flag_type: z.enum(["requires_review", "requires_more_study"]).describe("Type of flag"),
      comment: z.string().optional().describe("Optional comment"),
    },
    async ({ flashcard_id, question_id, flag_type, comment }) => {
      if (!flashcard_id && !question_id) {
        return { content: [{ type: "text" as const, text: "Must specify either flashcard_id or question_id" }], isError: true };
      }
      if (flashcard_id && question_id) {
        return { content: [{ type: "text" as const, text: "Specify only one of flashcard_id or question_id" }], isError: true };
      }

      // Check for existing unresolved flag of same type
      const conditions = [
        eq(cardFlags.userId, userId),
        eq(cardFlags.flagType, flag_type),
        isNull(cardFlags.resolvedAt),
      ];
      if (flashcard_id) conditions.push(eq(cardFlags.flashcardId, flashcard_id));
      if (question_id) conditions.push(eq(cardFlags.questionId, question_id));

      const existing = db.select({ id: cardFlags.id })
        .from(cardFlags)
        .where(and(...conditions))
        .get();

      if (existing) {
        if (comment) {
          writeTransaction(db, () =>
            db.update(cardFlags)
              .set({ comment })
              .where(eq(cardFlags.id, existing.id))
              .run()
          );
          emitEvent(db, userId, "flag.created", { flagId: existing.id });
          return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, flagId: existing.id }, null, 2) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ alreadyExists: true, flagId: existing.id }, null, 2) }] };
      }

      const [flag] = writeTransaction(db, () =>
        db.insert(cardFlags).values({
          userId,
          flashcardId: flashcard_id ?? null,
          questionId: question_id ?? null,
          flagType: flag_type,
          comment: comment ?? null,
        }).returning().all()
      );

      emitEvent(db, userId, "flag.created", { flagId: flag.id });
      return { content: [{ type: "text" as const, text: JSON.stringify(flag, null, 2) }] };
    }
  );

  server.tool(
    "get_learning_queue",
    "Get quiz questions the user skipped or flagged as needing more study. Returns full question context including options, explanation, deck name, and course hierarchy. Use this to identify topics the user needs help with, then create flashcards or teach relevant concepts.",
    {
      deck_id: z.number().int().positive().optional().describe("Filter to a specific deck"),
      course_id: z.number().int().positive().optional().describe("Filter to a specific course (includes all decks in course tree)"),
      include_resolved: z.boolean().optional().default(false).describe("Include items already resolved"),
    },
    async ({ deck_id, course_id, include_resolved }) => {
      const conditions = [
        eq(cardFlags.userId, userId),
        eq(cardFlags.flagType, "requires_more_study"),
      ];
      if (!include_resolved) conditions.push(isNull(cardFlags.resolvedAt));

      let deckFilter: number[] | null = null;
      if (course_id) {
        // Get all deck IDs in the course tree
        const courseDeckRows = db.all<{ deck_id: number }>(sql`
          WITH RECURSIVE course_tree(id) AS (
            SELECT id FROM course WHERE id = ${course_id} AND user_id = ${userId}
            UNION ALL
            SELECT c.id FROM course c JOIN course_tree ct ON c.parent_id = ct.id
          )
          SELECT cd.deck_id FROM course_deck cd
          JOIN course_tree ct ON cd.course_id = ct.id
        `);
        deckFilter = courseDeckRows.map(r => r.deck_id);
        if (deckFilter.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify([], null, 2) }] };
        }
      }

      const flags = db.select({
        flagId: cardFlags.id,
        comment: cardFlags.comment,
        createdAt: cardFlags.createdAt,
        questionId: cardFlags.questionId,
        flashcardId: cardFlags.flashcardId,
        questionText: quizQuestions.question,
        questionType: quizQuestions.type,
        explanation: quizQuestions.explanation,
        correctAnswer: quizQuestions.correctAnswer,
        questionDeckId: quizQuestions.deckId,
        flashcardFront: flashcards.front,
        flashcardBack: flashcards.back,
        flashcardDeckId: flashcards.deckId,
        deckName: decks.name,
      })
        .from(cardFlags)
        .leftJoin(quizQuestions, eq(cardFlags.questionId, quizQuestions.id))
        .leftJoin(flashcards, eq(cardFlags.flashcardId, flashcards.id))
        .leftJoin(decks, sql`${decks.id} = COALESCE(${quizQuestions.deckId}, ${flashcards.deckId})`)
        .where(and(...conditions))
        .all();

      // Apply deck filtering
      let filtered = flags;
      if (deck_id) {
        filtered = flags.filter(f => (f.questionDeckId ?? f.flashcardDeckId) === deck_id);
      } else if (deckFilter) {
        filtered = flags.filter(f => deckFilter!.includes((f.questionDeckId ?? f.flashcardDeckId)!));
      }

      // Fetch options for quiz questions
      const questionIds = filtered.filter(f => f.questionId).map(f => f.questionId!);
      const optionsMap = new Map<number, { optionText: string; isCorrect: boolean }[]>();
      if (questionIds.length > 0) {
        const options = db.select({
          questionId: questionOptions.questionId,
          optionText: questionOptions.optionText,
          isCorrect: questionOptions.isCorrect,
        })
          .from(questionOptions)
          .where(sql`${questionOptions.questionId} IN (${sql.raw(questionIds.join(","))})`)
          .all();
        for (const opt of options) {
          const list = optionsMap.get(opt.questionId) ?? [];
          list.push({ optionText: opt.optionText, isCorrect: opt.isCorrect });
          optionsMap.set(opt.questionId, list);
        }
      }

      const result = filtered.map(f => {
        if (f.questionId) {
          return {
            flagId: f.flagId,
            type: "question" as const,
            comment: f.comment,
            createdAt: f.createdAt,
            deckName: f.deckName,
            question: {
              id: f.questionId,
              text: f.questionText,
              type: f.questionType,
              explanation: f.explanation,
              correctAnswer: f.correctAnswer,
              options: optionsMap.get(f.questionId) ?? [],
            },
          };
        }
        return {
          flagId: f.flagId,
          type: "flashcard" as const,
          comment: f.comment,
          createdAt: f.createdAt,
          deckName: f.deckName,
          flashcard: {
            id: f.flashcardId,
            front: f.flashcardFront,
            back: f.flashcardBack,
          },
        };
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
