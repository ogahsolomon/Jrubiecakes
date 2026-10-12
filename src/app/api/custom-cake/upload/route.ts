import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";
import { verifyUploadImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Custom cake reference image upload.
 *
 * The browser never talks to Storage directly: the file is POSTed here and
 * written server-side with the service-role client into the private
 * `cake-references` bucket. Only a signed URL (1 hour) is returned for a
 * preview — the stored path is what gets attached to the order.
 */
export async function POST(request: NextRequest) {
  // Reference uploads write to private Storage through the service-role key.
  // Require a verified user so anonymous callers cannot fill the bucket.
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to upload a reference image." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  let image;
  try {
    image = await verifyUploadImage(form.get("file"), MAX_BYTES);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid image";
    const status = message.startsWith("Image is too large") ? 413 : 415;
    return NextResponse.json({ error: message }, { status });
  }

  const path = `references/${Date.now()}-${crypto.randomUUID()}.${image.extension}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("cake-references")
    .upload(path, image.bytes, {
      contentType: image.contentType,
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
