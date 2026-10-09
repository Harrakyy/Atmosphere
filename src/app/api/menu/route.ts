import { getPublicMenu } from "@/server/menu";
import { ok, handleError } from "@/server/http";

export async function GET() {
  try {
    const data = await getPublicMenu();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
