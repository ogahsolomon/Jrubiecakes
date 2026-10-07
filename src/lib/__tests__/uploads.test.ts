import { describe, expect, it } from "vitest";
import { verifyUploadImage } from "../uploads";

describe("verifyUploadImage", () => {
  it("accepts a PNG by its signature", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const file = new File([bytes], "cake.png", { type: "image/png" });
    const verified = await verifyUploadImage(file);
    expect(verified.contentType).toBe("image/png");
    expect(verified.extension).toBe("png");
  });

  it("rejects a non-image masquerading as a PNG", async () => {
    const bytes = new TextEncoder().encode("<script>alert(1)</script>");
    const file = new File([bytes], "cake.png", { type: "image/png" });
    await expect(verifyUploadImage(file)).rejects.toThrow("Unsupported format");
  });
});
