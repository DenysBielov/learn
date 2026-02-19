import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const DATA_DIR = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : "/app/data";
export const IMAGES_DIR = path.join(DATA_DIR, "images");

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_GLOBAL_STORAGE = 1024 * 1024 * 1024; // 1GB total

export const FILENAME_REGEX = /^[\w-]+\.(jpg|jpeg|png|webp|gif)$/;

// Magic bytes for image format detection
const MAGIC_BYTES: Array<{ bytes: number[]; ext: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], ext: "png" },
  { bytes: [0xff, 0xd8, 0xff], ext: "jpg" },
  { bytes: [0x47, 0x49, 0x46], ext: "gif" },
  // WebP: RIFF....WEBP
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: "webp" },
];

// Semaphore to limit concurrent sharp operations
let activeSharpJobs = 0;
const MAX_SHARP_JOBS = 2;
const waitQueue: Array<() => void> = [];

async function acquireSharpSlot(): Promise<void> {
  if (activeSharpJobs < MAX_SHARP_JOBS) {
    activeSharpJobs++;
    return;
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeSharpJobs++;
      resolve();
    });
  });
}

function releaseSharpSlot(): void {
  activeSharpJobs--;
  const next = waitQueue.shift();
  if (next) next();
}

export function ensureImagesDir(): void {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

export function detectImageType(buffer: Buffer): string | null {
  for (const { bytes, ext } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buffer[i] === b)) {
      // Extra check for WebP: bytes 8-11 must be "WEBP"
      if (ext === "webp") {
        const webpSig = buffer.subarray(8, 12).toString("ascii");
        if (webpSig !== "WEBP") return null;
      }
      return ext;
    }
  }
  return null;
}

export function validateBase64Image(base64: string): {
  valid: boolean;
  error?: string;
  buffer?: Buffer;
  ext?: string;
} {
  // Check size before decoding
  const sizeBytes = Math.ceil((base64.length * 3) / 4);
  if (sizeBytes > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image exceeds 4MB limit" };
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image exceeds 4MB limit" };
  }
  const ext = detectImageType(buffer);
  if (!ext) {
    return {
      valid: false,
      error: "Unsupported image format. Allowed: JPEG, PNG, WebP, GIF",
    };
  }

  return { valid: true, buffer, ext };
}

export async function saveImage(
  buffer: Buffer,
  ext: string
): Promise<string> {
  ensureImagesDir();

  await acquireSharpSlot();
  try {
    // Let sharp auto-detect the input format, then re-encode to the same format.
    // This strips any non-image payloads that may be appended to the file (polyglot defense).
    // For GIF, read all frames so animation is preserved during re-encode.
    const isAnimated = ext === "gif";
    let pipeline = sharp(buffer, { animated: isAnimated });
    switch (ext) {
      case "png":
        pipeline = pipeline.png();
        break;
      case "jpg":
      case "jpeg":
        pipeline = pipeline.jpeg();
        break;
      case "webp":
        pipeline = pipeline.webp();
        break;
      case "gif":
        pipeline = pipeline.gif();
        break;
    }
    const reencoded = await pipeline.toBuffer();

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);
    await fs.promises.writeFile(filepath, reencoded);
    return filename;
  } finally {
    releaseSharpSlot();
  }
}

export function getImagePath(filename: string): string | null {
  if (!FILENAME_REGEX.test(filename)) return null;
  const filepath = path.resolve(IMAGES_DIR, filename);
  if (!filepath.startsWith(IMAGES_DIR + path.sep)) return null;
  if (!fs.existsSync(filepath)) return null;
  return filepath;
}

export function deleteImage(filename: string): boolean {
  if (!FILENAME_REGEX.test(filename)) return false;
  const filepath = path.resolve(IMAGES_DIR, filename);
  // Path traversal check
  if (!filepath.startsWith(IMAGES_DIR + path.sep)) return false;
  try {
    fs.unlinkSync(filepath);
    return true;
  } catch {
    return false;
  }
}

export function getContentType(ext: string): string {
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return types[ext] ?? "application/octet-stream";
}

export function checkStorageQuota(): { allowed: boolean; error?: string } {
  ensureImagesDir();
  let totalSize = 0;
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    for (const file of files) {
      const stat = fs.statSync(path.join(IMAGES_DIR, file));
      totalSize += stat.size;
    }
  } catch {
    // If we can't read, allow the upload
    return { allowed: true };
  }

  if (totalSize >= MAX_GLOBAL_STORAGE) {
    return { allowed: false, error: "Global image storage quota exceeded" };
  }
  return { allowed: true };
}
