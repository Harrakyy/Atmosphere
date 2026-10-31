-- K-32: Midtrans diganti QRIS dinamis

-- Setting
ALTER TABLE "Setting" DROP COLUMN "paymentExpiryMinutes",
DROP COLUMN "vaMinTotal",
ADD COLUMN "claimHoldMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "qrisPayload" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "markupBps" SET DEFAULT 0;

-- K-36: markup 0%
UPDATE "Setting" SET "markupBps" = 0;

-- Reservation
ALTER TABLE "Reservation" DROP COLUMN "snapRedirectUrl",
DROP COLUMN "snapToken",
ADD COLUMN "payAmount" INTEGER,
ADD COLUMN "uniqueDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentClaimedAt" TIMESTAMPTZ(3);

UPDATE "Reservation" SET "payAmount" = "totalAmount";
ALTER TABLE "Reservation" ALTER COLUMN "payAmount" SET NOT NULL;

-- Tagihan Midtrans yang masih menunggu tidak bisa dibayar lagi; lepaskan slotnya
UPDATE "Reservation" SET status = 'EXPIRED' WHERE status = 'PENDING_PAYMENT';

-- R-Q3: nominal bayar unik di antara reservasi yang sedang menunggu bayar
CREATE UNIQUE INDEX "reservation_pending_pay_amount" ON "Reservation"("payAmount") WHERE status = 'PENDING_PAYMENT';

-- R-Q5: refund tidak boleh melebihi uang yang benar-benar diterima
ALTER TABLE "Reservation" DROP CONSTRAINT "reservation_amount_nonneg";
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_amount_nonneg" CHECK ("totalAmount" >= 0 AND "payAmount" > 0 AND "payAmount" <= "totalAmount" AND "refundAmount" >= 0 AND "refundAmount" <= "payAmount");
