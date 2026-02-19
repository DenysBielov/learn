import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  detectImageType,
  checkStorageQuota,
  saveImage,
} from "@flashcards/shared/images";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(request: NextRequest) {
  await requireAuth();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing image file" },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "Image exceeds 4MB limit" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const ext = detectImageType(buffer);
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image format. Allowed: JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  const quota = checkStorageQuota();
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.error ?? "Storage quota exceeded" },
      { status: 507 }
    );
  }

  const filename = await saveImage(buffer, ext);

  return NextResponse.json({ url: `/api/images/${filename}` });
}
