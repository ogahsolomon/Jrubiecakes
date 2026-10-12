import "server-only";

export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;

export type VerifiedUploadImage = {
  bytes: ArrayBuffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
};

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  );
}

/**
 * Validate an uploaded image by its actual bytes, not its client-supplied
 * MIME type or filename. This rejects renamed executables, scripts, SVGs,
 * and unsupported formats before anything reaches Storage.
 */
export async function verifyUploadImage(
  file: unknown,
  maxBytes = MAX_UPLOAD_IMAGE_BYTES
): Promise<VerifiedUploadImage> {
  if (!(file instanceof File)) {
    throw new Error("No file provided");
  }
  if (file.size > maxBytes) {
    throw new Error(`Image is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  }

  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes);

  if (isPng(signature)) {
    return { bytes, contentType: "image/png", extension: "png" };
  }
  if (isJpeg(signature)) {
    return { bytes, contentType: "image/jpeg", extension: "jpg" };
  }
  if (isWebP(signature)) {
    return { bytes, contentType: "image/webp", extension: "webp" };
  }

  throw new Error("Unsupported format — please upload a PNG, JPG or WebP image");
}
