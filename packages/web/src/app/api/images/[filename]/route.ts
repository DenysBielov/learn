import { NextRequest, NextResponse } from "next/server";
import { open } from "fs/promises";
import { requireAuth } from "@/lib/auth";
import {
  FILENAME_REGEX,
  getImagePath,
  getContentType,
} from "@flashcards/shared/images";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  await requireAuth();

  const { filename } = await params;

  if (!FILENAME_REGEX.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filepath = getImagePath(filename);
  if (!filepath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop() ?? "";
  const contentType = getContentType(ext);

  let fh;
  try {
    fh = await open(filepath, "r");
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = fh.createReadStream();
  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => {
        controller.close();
        fh.close();
      });
      stream.on("error", (err) => {
        controller.error(err);
        fh.close();
      });
    },
    cancel() {
      stream.destroy();
      fh.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
