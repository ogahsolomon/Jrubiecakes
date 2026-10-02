import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Custom cake reference image upload.
 *
 * The browser never talks to Storage directly: the file is POSTed here and
 * written server-side with the service-role client into the private
 * `cake-references` bucket. Only a signed URL (1 hour) is returned for a
 * preview — the stored path is what gets attached to the order.
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported format — please upload a PNG, JPG or WebP image" },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 5 MB)" }, { status: 413 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `references/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("cake-references")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[custom-cake] upload failed:", error.message);
    return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }

  // Short-lived signed URL so the customer can preview their upload
  const { data: signed } = await admin.storage.from("cake-references").createSignedUrl(path, 3600);

  return NextResponse.json({ ok: true, path, previewUrl: signed?.signedUrl ?? null });
}
