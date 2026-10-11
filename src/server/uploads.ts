import crypto from "node:crypto";
import { AppError } from "./http";

export interface UploadResult {
  url: string;
}

export function detectImageMime(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: ".png" };
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }

  return null;
}

export async function uploadImage(file: File | Blob): Promise<UploadResult> {
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    throw new AppError("FILE_TOO_LARGE", "Ukuran file maksimal 2 MB.", 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detected = detectImageMime(buffer);
  if (!detected) {
    throw new AppError(
      "INVALID_FILE_TYPE",
      "Format file tidak didukung. Hanya menerima JPG, PNG, atau WebP.",
      400
    );
  }

  const filename = `${crypto.randomUUID()}${detected.ext}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token || token.includes("placeholder")) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("INTERNAL", "Penyimpanan foto belum dikonfigurasi.", 500);
    }
    // shortcut: URL palsu untuk dev/tes tanpa token Blob, produksi wajib punya BLOB_READ_WRITE_TOKEN
    return { url: `https://blob.vercel-storage.com/${filename}` };
  }

  const { put } = await import("@vercel/blob");
  const blob = await put(filename, buffer, {
    access: "public",
    contentType: detected.mime,
    token,
  });

  return { url: blob.url };
}
