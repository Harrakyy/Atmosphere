-- K-35 Fase 2: HP kasir melaporkan pembayaran QRIS dari notifikasi DANA

-- Tabel log webhook Midtrans tidak dipakai lagi sejak QRIS (K-32)
DROP TABLE "PaymentNotification";

CREATE TYPE "IncomingResult" AS ENUM ('MATCHED', 'ALREADY_PAID', 'LATE_SLOT_TAKEN', 'NO_MATCH', 'DISMISSED');

CREATE TABLE "PaymentDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "PaymentDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentDevice_tokenHash_key" ON "PaymentDevice"("tokenHash");

CREATE TABLE "PairingCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PairingCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PairingCode_codeHash_key" ON "PairingCode"("codeHash");

CREATE TABLE "IncomingPayment" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "notifId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "text" TEXT NOT NULL,
    "result" "IncomingResult" NOT NULL,
    "reservationId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomingPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IncomingPayment_deviceId_notifId_key" ON "IncomingPayment"("deviceId", "notifId");
CREATE INDEX "IncomingPayment_result_createdAt_idx" ON "IncomingPayment"("result", "createdAt");
ALTER TABLE "IncomingPayment" ADD CONSTRAINT "IncomingPayment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PaymentDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
