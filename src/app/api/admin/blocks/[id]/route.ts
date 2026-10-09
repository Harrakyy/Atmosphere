import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { deleteRoomBlock } from "@/server/blocks";
import { ok, handleError } from "@/server/http";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const data = await deleteRoomBlock(id, session.user.id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
