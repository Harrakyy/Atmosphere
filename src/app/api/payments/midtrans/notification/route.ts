import { NextRequest } from "next/server";
import { handleNotification } from "@/server/payments/notification";
import { ok, fail, UnauthorizedError, NotFoundError } from "@/server/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleNotification(body);
    return ok(result);
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return fail("UNAUTHORIZED", error.message, 401);
    }
    if (error instanceof NotFoundError) {
      return fail("NOT_FOUND", error.message, 404);
    }
    console.error("Webhook processing error:", error);
    return fail("INTERNAL", "Gagal memproses webhook", 500);
  }
}
