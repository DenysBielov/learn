import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "./test-helper";
import { courses, courseDecks, decks, flashcards } from "../schema";
import {
  checkCircularReference,
  getAncestorDepth,
  getDescendantDeckIds,
  getDescendantCourseIds,
  getCourseBreadcrumbs,
  getDashboardCourseStats,
  getNextPosition,
  getActiveCoursesDueCount,
} from "../courses";
import type { AppDatabase } from "../index";

let db: AppDatabase;
let sqlite: Database.Database;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
});

afterEach(() => {
  sqlite.close();
});

describe("checkCircularReference", () => {
  it("returns false when no cycle exists", () => {
    db.insert(courses).values([
      { id: 1, name: "A" },
      { id: 2, name: "B", parentId: 1 },
    ]).run();
    expect(checkCircularReference(db, 2, 1)).toBe(false);
  });

  it("returns true when target parent is the course itself", () => {
    db.insert(courses).values({ id: 1, name: "A" }).run();
    expect(checkCircularReference(db, 1, 1)).toBe(true);
  });

  it("returns true when target parent is a descendant", () => {
    db.insert(courses).values([
      { id: 1, name: "A" },
      { id: 2, name: "B", parentId: 1 },
      { id: 3, name: "C", parentId: 2 },
    ]).run();
    expect(checkCircularReference(db, 1, 3)).toBe(true);
  });

  it("returns false for valid reparenting", () => {
    db.insert(courses).values([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C", parentId: 2 },
    ]).run();
    expect(checkCircularReference(db, 3, 1)).toBe(false);
  });
});

describe("getAncestorDepth", () => {
  it("returns 0 for null parent (top-level)", () => {
    expect(getAncestorDepth(db, null)).toBe(0);
  });

  it("returns 1 for child of top-level", () => {
    db.insert(courses).values({ id: 1, name: "Root" }).run();
    expect(getAncestorDepth(db, 1)).toBe(1);
  });

  it("returns correct depth for nested courses", () => {
    db.insert(courses).values([
      { id: 1, name: "L1" },
      { id: 2, name: "L2", parentId: 1 },
      { id: 3, name: "L3", parentId: 2 },
    ]).run();
    expect(getAncestorDepth(db, 3)).toBe(3);
  });

  it("throws when depth exceeds 10", () => {
    for (let i = 1; i <= 10; i++) {
      db.insert(courses).values({
        id: i,
        name: `L${i}`,
        parentId: i === 1 ? null : i - 1,
      }).run();
    }
    expect(() => getAncestorDepth(db, 10, true)).toThrow("exceeds maximum");
  });
});

describe("getDescendantDeckIds", () => {
  it("returns empty array for course with no decks", () => {
    db.insert(courses).values({ id: 1, name: "Empty" }).run();
    expect(getDescendantDeckIds(db, 1)).toEqual([]);
  });

  it("returns direct deck ids", () => {
    db.insert(courses).values({ id: 1, name: "Course" }).run();
    db.insert(decks).values([
      { id: 1, name: "Deck A" },
      { id: 2, name: "Deck B" },
    ]).run();
    db.insert(courseDecks).values([
      { courseId: 1, deckId: 1 },
      { courseId: 1, deckId: 2 },
    ]).run();
    const ids = getDescendantDeckIds(db, 1);
    expect(ids.sort()).toEqual([1, 2]);
  });

  it("returns deck ids from nested sub-courses", () => {
    db.insert(courses).values([
      { id: 1, name: "Parent" },
      { id: 2, name: "Child", parentId: 1 },
    ]).run();
    db.insert(decks).values([
      { id: 1, name: "Deck A" },
      { id: 2, name: "Deck B" },
    ]).run();
    db.insert(courseDecks).values([
      { courseId: 1, deckId: 1 },
      { courseId: 2, deckId: 2 },
    ]).run();
    const ids = getDescendantDeckIds(db, 1);
    expect(ids.sort()).toEqual([1, 2]);
  });

  it("deduplicates decks shared across sub-courses", () => {
    db.insert(courses).values([
      { id: 1, name: "Parent" },
      { id: 2, name: "Child", parentId: 1 },
    ]).run();
    db.insert(decks).values({ id: 1, name: "Shared Deck" }).run();
    db.insert(courseDecks).values([
      { courseId: 1, deckId: 1 },
      { courseId: 2, deckId: 1 },
    ]).run();
    expect(getDescendantDeckIds(db, 1)).toEqual([1]);
  });
});

describe("getDashboardCourseStats", () => {
  it("returns stats for top-level courses", () => {
    db.insert(courses).values([
      { id: 1, name: "Course A" },
      { id: 2, name: "Sub", parentId: 1 },
    ]).run();
    db.insert(decks).values({ id: 1, name: "Deck" }).run();
    db.insert(courseDecks).values({ courseId: 2, deckId: 1 }).run();
    db.insert(flashcards).values({
      id: 1, deckId: 1, front: "Q", back: "A",
    }).run();

    const stats = getDashboardCourseStats(db);
    expect(stats).toHaveLength(1);
    expect(stats[0].rootId).toBe(1);
    expect(stats[0].totalDecks).toBe(1);
    expect(stats[0].dueCards).toBe(1);
  });

  it("returns empty for courses with no decks", () => {
    db.insert(courses).values({ id: 1, name: "Empty" }).run();
    const stats = getDashboardCourseStats(db);
    expect(stats).toHaveLength(0);
  });
});

describe("getDescendantCourseIds", () => {
  it("returns all descendants deepest first", () => {
    db.insert(courses).values([
      { id: 1, name: "Root" },
      { id: 2, name: "Child", parentId: 1 },
      { id: 3, name: "Grandchild", parentId: 2 },
    ]).run();
    const ids = getDescendantCourseIds(db, 1);
    expect(ids).toEqual([3, 2, 1]);
  });
});

describe("getCourseBreadcrumbs", () => {
  it("returns path from root to course", () => {
    db.insert(courses).values([
      { id: 1, name: "Root" },
      { id: 2, name: "Child", parentId: 1 },
      { id: 3, name: "Grandchild", parentId: 2 },
    ]).run();
    const crumbs = getCourseBreadcrumbs(db, 3);
    expect(crumbs).toEqual([
      { id: 1, name: "Root" },
      { id: 2, name: "Child" },
      { id: 3, name: "Grandchild" },
    ]);
  });
});

describe("getNextPosition", () => {
  it("returns 0 for first child", () => {
    expect(getNextPosition(db, null)).toBe(0);
  });

  it("returns max+1 for existing siblings", () => {
    db.insert(courses).values([
      { id: 1, name: "A", position: 0 },
      { id: 2, name: "B", position: 3 },
    ]).run();
    expect(getNextPosition(db, null)).toBe(4);
  });
});

describe("getActiveCoursesDueCount", () => {
  it("returns due count for explicitly active courses and their descendants", () => {
    db.insert(courses).values([
      { id: 1, name: "Parent", isActive: true },
      { id: 2, name: "Child", parentId: 1 },
    ]).run();
    db.insert(decks).values([
      { id: 1, name: "Deck A" },
      { id: 2, name: "Deck B" },
    ]).run();
    db.insert(courseDecks).values([
      { courseId: 1, deckId: 1 },
      { courseId: 2, deckId: 2 },
    ]).run();
    // Both decks have due cards (default nextReviewAt is in the past)
    db.insert(flashcards).values([
      { id: 1, deckId: 1, front: "Q1", back: "A1" },
      { id: 2, deckId: 2, front: "Q2", back: "A2" },
    ]).run();

    const result = getActiveCoursesDueCount(db, 1);
    expect(result).toBe(2);
  });

  it("returns 0 when no courses are active", () => {
    db.insert(courses).values({ id: 1, name: "Inactive" }).run();
    db.insert(decks).values({ id: 1, name: "Deck" }).run();
    db.insert(courseDecks).values({ courseId: 1, deckId: 1 }).run();
    db.insert(flashcards).values({ id: 1, deckId: 1, front: "Q", back: "A" }).run();

    const result = getActiveCoursesDueCount(db, 1);
    expect(result).toBe(0);
  });

  it("includes descendant decks when non-leaf course is active", () => {
    db.insert(courses).values([
      { id: 1, name: "Parent", isActive: true },
      { id: 2, name: "Child", parentId: 1 },
      { id: 3, name: "Grandchild", parentId: 2 },
    ]).run();
    db.insert(decks).values({ id: 1, name: "Deck" }).run();
    db.insert(courseDecks).values({ courseId: 3, deckId: 1 }).run();
    db.insert(flashcards).values({ id: 1, deckId: 1, front: "Q", back: "A" }).run();

    const result = getActiveCoursesDueCount(db, 1);
    expect(result).toBe(1);
  });

  it("does not double-count a deck shared across two courses in the active tree", () => {
    db.insert(courses).values([
      { id: 1, name: "Parent", isActive: true },
      { id: 2, name: "Child", parentId: 1 },
    ]).run();
    db.insert(decks).values({ id: 1, name: "Shared" }).run();
    db.insert(courseDecks).values([
      { courseId: 1, deckId: 1 },
      { courseId: 2, deckId: 1 },
    ]).run();
    db.insert(flashcards).values({ id: 1, deckId: 1, front: "Q", back: "A" }).run();

    expect(getActiveCoursesDueCount(db, 1)).toBe(1);
  });
});
