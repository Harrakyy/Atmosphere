import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminCreateRoomSchema } from "@/contracts";
import { getAdminRooms, createRoom } from "@/server/rooms";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const data = await getAdminRooms();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const json = await request.json();
    const validated = adminCreateRoomSchema.parse(json);
    const data = await createRoom(validated);
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}
