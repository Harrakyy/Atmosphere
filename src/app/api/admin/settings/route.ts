import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminUpdateSettingSchema } from "@/contracts";
import { getSettings, updateSettings } from "@/server/settings";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const data = await getSettings();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
    const json = await request.json();
    const validated = adminUpdateSettingSchema.parse(json);
    const data = await updateSettings(validated);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
