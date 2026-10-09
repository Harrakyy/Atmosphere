import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminCategorySchema } from "@/contracts";
import { getAdminCategories, createCategory } from "@/server/categories";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const data = await getAdminCategories();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const json = await request.json();
    const validated = adminCategorySchema.parse(json);
    const data = await createCategory(validated);
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}
