import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminCreateBlockSchema } from "@/contracts";
import { getRoomBlocks, createRoomBlock } from "@/server/blocks";
import { ok, handleError } from "@/server/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const data = await getRoomBlocks(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const json = await request.json();
    const validated = adminCreateBlockSchema.parse(json);

    const data = await createRoomBlock(id, validated, session.user.id);
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}
