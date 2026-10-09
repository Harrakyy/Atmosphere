import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminUpdateCategorySchema } from "@/contracts";
import { updateCategory, deleteCategory } from "@/server/categories";
import { ok, handleError } from "@/server/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const json = await request.json();
    const validated = adminUpdateCategorySchema.parse(json);
    const data = await updateCategory(id, validated);
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
    const data = await deleteCategory(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
