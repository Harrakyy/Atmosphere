import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminUpdateProductSchema } from "@/contracts";
import { updateProduct, archiveProduct } from "@/server/products";
import { ok, handleError } from "@/server/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const json = await request.json();
    const validated = adminUpdateProductSchema.parse(json);
    const { categoryId, ...rest } = validated;

    const updateData: Record<string, unknown> = { ...rest };
    if (categoryId) {
      updateData.category = { connect: { id: categoryId } };
    }

    const data = await updateProduct(id, updateData);
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
    const data = await archiveProduct(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
