import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  type AppDatabase,
  materials,
  decks,
  quizzes,
  tags,
  materialDecks,
  materialQuizzes,
  materialResources,
  materialTags,
  writeTransaction,
} from "@flashcards/database";

export function registerMaterialLinkTools(server: McpServer, db: AppDatabase, userId: number) {
  // --- Deck links ---

  server.tool(
    "link_deck_to_material",
    "Link a deck to a learning material so the material references the deck's flashcards",
    {
      materialId: z.number().int().positive(),
      deckId: z.number().int().positive(),
    },
    async ({ materialId, deckId }) => {
      try {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        const deck = db.select({ userId: decks.userId }).from(decks)
          .where(eq(decks.id, deckId)).get();
        if (!material || !deck || material.userId !== userId || deck.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Material or deck not found" }], isError: true };
        }

        writeTransaction(db, () => {
          db.insert(materialDecks).values({ materialId, deckId }).onConflictDoNothing().run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ linked: true, materialId, deckId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "unlink_deck_from_material",
    "Remove the link between a deck and a learning material",
    {
      materialId: z.number().int().positive(),
      deckId: z.number().int().positive(),
    },
    async ({ materialId, deckId }) => {
      try {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        const deck = db.select({ userId: decks.userId }).from(decks)
          .where(eq(decks.id, deckId)).get();
        if (!material || !deck || material.userId !== userId || deck.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Material or deck not found" }], isError: true };
        }

        writeTransaction(db, () => {
          db.delete(materialDecks)
            .where(and(eq(materialDecks.materialId, materialId), eq(materialDecks.deckId, deckId)))
            .run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ unlinked: true, materialId, deckId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  // --- Quiz links ---

  server.tool(
    "link_quiz_to_material",
    "Link a standalone quiz to a learning material",
    {
      materialId: z.number().int().positive(),
      quizId: z.number().int().positive(),
    },
    async ({ materialId, quizId }) => {
      try {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        const quiz = db.select({ userId: quizzes.userId }).from(quizzes)
          .where(eq(quizzes.id, quizId)).get();
        if (!material || !quiz || material.userId !== userId || quiz.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Material or quiz not found" }], isError: true };
        }

        writeTransaction(db, () => {
          db.insert(materialQuizzes).values({ materialId, quizId }).onConflictDoNothing().run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ linked: true, materialId, quizId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "unlink_quiz_from_material",
    "Remove the link between a quiz and a learning material",
    {
      materialId: z.number().int().positive(),
      quizId: z.number().int().positive(),
    },
    async ({ materialId, quizId }) => {
      try {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        const quiz = db.select({ userId: quizzes.userId }).from(quizzes)
          .where(eq(quizzes.id, quizId)).get();
        if (!material || !quiz || material.userId !== userId || quiz.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Material or quiz not found" }], isError: true };
        }

        writeTransaction(db, () => {
          db.delete(materialQuizzes)
            .where(and(eq(materialQuizzes.materialId, materialId), eq(materialQuizzes.quizId, quizId)))
            .run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ unlinked: true, materialId, quizId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  // --- Resources ---

  server.tool(
    "add_material_resource",
    "Add an external resource URL to a learning material (article, video, documentation, etc.)",
    {
      materialId: z.number().int().positive(),
      url: z.string().min(1).max(2000),
      title: z.string().max(200).optional(),
      type: z.enum(["article", "video", "documentation", "obsidian", "other"]).optional(),
    },
    async ({ materialId, url, title, type }) => {
      try {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          return { content: [{ type: "text" as const, text: "URL must start with http:// or https://" }], isError: true };
        }

        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        if (!material || material.userId !== userId) {
          return { content: [{ type: "text" as const, text: `Material ${materialId} not found` }], isError: true };
        }

        const [created] = writeTransaction(db, () =>
          db.insert(materialResources).values({
            materialId,
            url,
            title: title ?? null,
            type: type ?? "other",
          }).returning().all()
        );

        return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "remove_material_resource",
    "Remove an external resource from a learning material",
    {
      resourceId: z.number().int().positive(),
    },
    async ({ resourceId }) => {
      try {
        const resource = db.select({ materialId: materialResources.materialId })
          .from(materialResources)
          .where(eq(materialResources.id, resourceId)).get();
        if (!resource) {
          return { content: [{ type: "text" as const, text: `Resource ${resourceId} not found` }], isError: true };
        }

        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, resource.materialId)).get();
        if (!material || material.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Not authorized" }], isError: true };
        }

        writeTransaction(db, () => {
          db.delete(materialResources).where(eq(materialResources.id, resourceId)).run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, resourceId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  // --- Tags ---

  server.tool(
    "assign_material_tag",
    "Assign a tag to a learning material",
    {
      materialId: z.number().int().positive(),
      tagId: z.number().int().positive(),
    },
    async ({ materialId, tagId }) => {
      try {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        const tag = db.select({ userId: tags.userId }).from(tags)
          .where(eq(tags.id, tagId)).get();
        if (!material || !tag || material.userId !== userId || tag.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Material or tag not found" }], isError: true };
        }

        writeTransaction(db, () => {
          db.insert(materialTags).values({ materialId, tagId }).onConflictDoNothing().run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ assigned: true, materialId, tagId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "remove_material_tag",
    "Remove a tag from a learning material",
    {
      materialId: z.number().int().positive(),
      tagId: z.number().int().positive(),
    },
    async ({ materialId, tagId }) => {
      try {
        const material = db.select({ userId: materials.userId }).from(materials)
          .where(eq(materials.id, materialId)).get();
        const tag = db.select({ userId: tags.userId }).from(tags)
          .where(eq(tags.id, tagId)).get();
        if (!material || !tag || material.userId !== userId || tag.userId !== userId) {
          return { content: [{ type: "text" as const, text: "Material or tag not found" }], isError: true };
        }

        writeTransaction(db, () => {
          db.delete(materialTags)
            .where(and(eq(materialTags.materialId, materialId), eq(materialTags.tagId, tagId)))
            .run();
        });

        return { content: [{ type: "text" as const, text: JSON.stringify({ removed: true, materialId, tagId }) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: String(err) }], isError: true };
      }
    }
  );
}
