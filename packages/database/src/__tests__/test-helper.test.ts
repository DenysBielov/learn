import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-helper";
import { courses } from "../schema";

describe("createTestDb", () => {
  it("creates tables successfully", () => {
    const { db, sqlite } = createTestDb();
    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain("course");
    expect(tableNames).toContain("course_deck");
    expect(tableNames).toContain("study_session");
    sqlite.close();
  });

  it("can insert and query a course", () => {
    const { db, sqlite } = createTestDb();
    db.insert(courses).values({ name: "Test Course" }).run();
    const result = db.select().from(courses).all();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Course");
    sqlite.close();
  });
});
