import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminProductSchema } from "@/contracts";
import { getAdminProducts, createProduct } from "@/server/products";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const data = await getAdminProducts();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const json = await request.json();
    const validated = adminProductSchema.parse(json);
    const { categoryId, ...rest } = validated;
    const data = await createProduct({
      ...rest,
      category: { connect: { id: categoryId } },
    });
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}
