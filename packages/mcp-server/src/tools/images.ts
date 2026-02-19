import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateBase64Image, saveImage, checkStorageQuota,
} from "@flashcards/shared/images";

// Simple in-memory rate limiter
const uploadCounts = new Map<number, { count: number; windowStart: number }>();
const RATE_LIMIT = 20; // max uploads per window
const RATE_WINDOW_MS = 60_000; // 60 seconds

function checkUploadRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = uploadCounts.get(userId);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    uploadCounts.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export function registerImageTools(server: McpServer, userId: number) {
  server.tool(
    "upload_image",
    "Upload an image for use in flashcards or quiz questions. Returns a URL to embed in markdown as ![alt](url). Upload images BEFORE creating flashcards/quiz questions that reference them.",
    {
      name: z.string().min(1).max(200).describe("Descriptive name for the image (used as alt text)"),
      base64: z.string().min(1).describe("Base64-encoded image data (JPEG, PNG, WebP, or GIF, max 4MB)"),
    },
    async ({ name, base64 }) => {
      if (!checkUploadRateLimit(userId)) {
        return { content: [{ type: "text" as const, text: "Rate limit exceeded. Max 20 uploads per minute." }], isError: true };
      }

      const validation = validateBase64Image(base64);
      if (!validation.valid) {
        return { content: [{ type: "text" as const, text: validation.error! }], isError: true };
      }

      const quota = checkStorageQuota();
      if (!quota.allowed) {
        return { content: [{ type: "text" as const, text: quota.error! }], isError: true };
      }

      const filename = await saveImage(validation.buffer!, validation.ext!);
      const url = `/api/images/${filename}`;

      return {
        content: [{ type: "text" as const, text: `Image uploaded. Use in markdown: ![${name}](${url})` }],
      };
    }
  );
}
