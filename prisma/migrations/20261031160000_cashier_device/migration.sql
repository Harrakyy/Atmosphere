-- K-35: HP kasir (SetorPantau) + notifikasi pembayaran masuk

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMPTZ(3),
    "tokenHash" TEXT,
    "pairedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrisNotification" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "notifId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "text" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reservationId" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrisNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_pairingCode_key" ON "Device"("pairingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");

-- CreateIndex
CREATE INDEX "QrisNotification_amount_idx" ON "QrisNotification"("amount");

-- CreateIndex
CREATE UNIQUE INDEX "QrisNotification_deviceId_notifId_key" ON "QrisNotification"("deviceId", "notifId");

-- AddForeignKey
ALTER TABLE "QrisNotification" ADD CONSTRAINT "QrisNotification_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

