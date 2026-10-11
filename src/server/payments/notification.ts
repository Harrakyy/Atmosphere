import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { PaymentGateway } from "./gateway";
import { midtransGateway } from "./midtrans";
import { fakeGateway } from "./fake";
import { UnauthorizedError, NotFoundError, InvalidTransitionError } from "../http";
import { orderIdToCode } from "../codes";
import {
  confirmReservation,
  expireReservation,
  cancelReservation,
} from "../reservations/transitions";

export function getPaymentGateway(): PaymentGateway {
  if (process.env.PAYMENT_GATEWAY === "fake") {
    // FakeGateway menerima webhook apa pun sebagai lunas, jadi tidak boleh aktif di produksi
    if (process.env.NODE_ENV === "production") {
      throw new Error("PAYMENT_GATEWAY=fake tidak boleh dipakai di produksi");
    }
    return fakeGateway;
  }
  return midtransGateway;
}

export async function handleNotification(
  body: unknown,
  deps: {
    gateway?: PaymentGateway;
    db?: typeof prisma;
  } = {}
) {
  const db = deps.db ?? prisma;
  const gateway = deps.gateway ?? getPaymentGateway();

  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const orderId = String(payload.order_id || payload.orderId || "unknown");
  const transactionStatus = String(payload.transaction_status || payload.status || "unknown");

  // 1. Verifikasi notification lewat gateway
  const verified = await gateway.verifyNotification(body);

  // Simpan PaymentNotification untuk audit trail (selalu disimpan)
  await db.paymentNotification.create({
    data: {
      orderId,
      transactionStatus,
      signatureValid: verified.valid,
      payload: body as Prisma.InputJsonValue,
    },
  });

  // 2. Jika signature salah -> 401
  if (!verified.valid) {
    throw new UnauthorizedError("Signature webhook tidak valid.");
  }

  // 3. Cari reservasi berdasarkan orderId (code)
  // R-I3: order_id Midtrans = kode + sufiks acak; order_id lama (tanpa sufiks) dipakai apa adanya
  const code = orderIdToCode(verified.orderId);
  const res = await db.reservation.findUnique({ where: { code } });

  if (!res) {
    throw new NotFoundError(`Reservasi dengan kode ${code} tidak ditemukan.`);
  }

  // Webhook duplikat yang datang bersamaan kalah di guard status: abaikan (R-PAY3)
  try {
    // 4. Proses status PAID
    if (verified.status === "PAID") {
      // R-PAY4: Gross amount mismatch check
      if (verified.grossAmount !== res.totalAmount) {
        await db.activityLog.create({
          data: {
            reservationId: res.id,
            action: "PAYMENT_AMOUNT_MISMATCH",
            detail: {
              expected: res.totalAmount,
              received: verified.grossAmount,
            },
          },
        });
        return { received: true, mismatch: true };
      }
  
      if (res.status === "PENDING_PAYMENT") {
        await confirmReservation(
          res.id,
          { paidAt: new Date(), paymentType: verified.paymentType },
          null,
          db
        );
      } else if (res.status === "EXPIRED") {
        // Late payment handling: coba confirm, jika slot bentrok -> cancel dengan refund SYSTEM
        try {
          await confirmReservation(
            res.id,
            { paidAt: new Date(), paymentType: verified.paymentType },
            null,
            db
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("23P01") || msg.includes("reservation_no_overlap")) {
            await cancelReservation(
              res.id,
              {
                by: "SYSTEM",
                reason: "Slot sudah terisi saat pembayaran diterima terlambat",
                refundAmount: res.totalAmount,
              },
              null,
              new Date(),
              db
            );
  
            await db.activityLog.create({
              data: {
                reservationId: res.id,
                action: "LATE_PAYMENT_SLOT_TAKEN",
                detail: { grossAmount: verified.grossAmount },
              },
            });
          } else {
            throw err;
          }
        }
      }
      // Jika status CONFIRMED, CHECKED_IN, COMPLETED -> idempoten, diamkan
    } else if (verified.status === "FAILED") {
      if (res.status === "PENDING_PAYMENT") {
        await expireReservation(res.id, null, db);
      }
    }
  } catch (err: unknown) {
    if (err instanceof InvalidTransitionError) return { received: true };
    throw err;
  }

  return { received: true };
}
