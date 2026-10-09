import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { uploadImage } from "@/server/uploads";
import { ok, fail, handleError } from "@/server/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return fail("VALIDATION_ERROR", "File gambar wajib diunggah.", 400);
    }

    const data = await uploadImage(file as File);
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}
