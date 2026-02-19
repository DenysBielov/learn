import { getDb, closeDb } from "@flashcards/database";
import { chatMessages } from "@flashcards/database/schema";
import { isNotNull } from "drizzle-orm";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data");
const IMAGES_DIR = path.join(DATA_DIR, "chat-images");
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log("No chat-images directory found. Nothing to clean.");
    return;
  }

  const db = getDb();

  // Get all filenames referenced in DB
  const dbImages = db
    .select({ imageUrl: chatMessages.imageUrl })
    .from(chatMessages)
    .where(isNotNull(chatMessages.imageUrl))
    .all();

  const referencedFiles = new Set(dbImages.map((r) => r.imageUrl));

  // Scan disk
  const diskFiles = fs.readdirSync(IMAGES_DIR);
  const cutoff = Date.now() - MAX_AGE_MS;
  let removed = 0;

  for (const file of diskFiles) {
    if (referencedFiles.has(file)) continue;

    const filepath = path.join(IMAGES_DIR, file);
    const stat = fs.statSync(filepath);

    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filepath);
      removed++;
    }
  }

  console.log(`Cleanup complete: removed ${removed} orphaned image(s)`);
  closeDb();
}

main();
