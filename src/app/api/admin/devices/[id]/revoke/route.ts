import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { revokeDevice } from "@/server/devices";
import { ok, handleError } from "@/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    await revokeDevice(id, session.user.id);
    return ok({ revoked: true });
  } catch (error) {
    return handleError(error);
  }
}
