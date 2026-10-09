import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminUpdateRoomSchema } from "@/contracts";
import { updateRoom, archiveRoom } from "@/server/rooms";
import { ok, handleError } from "@/server/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const json = await request.json();
    const validated = adminUpdateRoomSchema.parse(json);
    const data = await updateRoom(id, validated);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const data = await archiveRoom(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
