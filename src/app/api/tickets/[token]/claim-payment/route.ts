import { NextRequest } from "next/server";
import { claimPayment } from "@/server/reservations/transitions";
import { ok, handleError } from "@/server/http";

// Token tiket 32 karakter acak dan klaim hanya memperpanjang hold sekali, jadi tidak perlu rate limit
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const res = await claimPayment(token);
    return ok({ paymentClaimedAt: res.paymentClaimedAt, holdExpiresAt: res.holdExpiresAt });
  } catch (error) {
    return handleError(error);
  }
}
