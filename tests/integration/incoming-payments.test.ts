import { setTestQris } from "../helpers/qris";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { createPairingCode, pairDevice, authenticateDevice, revokeDevice, listDevices } from "@/server/devices";
import { handleIncomingPayment, listUnmatchedPayments, dismissIncomingPayment } from "@/server/payments/incoming";
import { getNeedsActionReservations } from "@/server/reservations/queries";
import { UnauthorizedError, AppError } from "@/server/http";
import { wibDateTime } from "@/server/time";
import { NextRequest } from "next/server";
import { POST as pairRoute } from "@/app/api/devices/pair/route";
import { POST as notificationRoute } from "@/app/api/payments/qris/notification/route";

const NOW = wibDateTime("2026-10-16", "12:00");
const MIN = 60_000;
const at = (min: number) => new Date(NOW.getTime() + min * MIN);

describe("Fase 2: HP kasir melaporkan pembayaran (K-35)", () => {
  let roomId: string;
  let items: { productId: string; option: string | null; quantity: number }[];

  beforeEach(async () => {
    await prisma.incomingPayment.deleteMany();
    await prisma.paymentDevice.deleteMany();
    await prisma.pairingCode.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.room.deleteMany();
    await prisma.setting.deleteMany();
    await seed(prisma);
    await setTestQris(prisma);
    roomId = (await prisma.room.findFirstOrThrow({ where: { slug: "ruangan-1" } })).id;
    const food = await prisma.product.findFirstOrThrow({ where: { name: "Pasta Aglio Olio" } });
    const drink = await prisma.product.findFirstOrThrow({ where: { name: "Jeruk" } });
    items = [
      { productId: food.id, option: null, quantity: 2 },
      { productId: drink.id, option: "Ice", quantity: 2 },
    ];
  });

  const book = (start = "10:00", end = "12:00", now = NOW) =>
    createReservation(
      { roomId, date: "2026-10-18", start, end, guestCount: 5, items, servingTime: "ON_ARRIVAL", customer: { name: "Budi", phone: "081234567890" } },
      { now, db: prisma }
    );

  async function pairedDevice(now = NOW) {
    const { code } = await createPairingCode("admin-1", now, prisma);
    return pairDevice({ code, name: "HP Kasir" }, now, prisma);
  }

  const report = (token: string, body: { notifId: string; amount: number; time: number; text?: string }, now = NOW) =>
    authenticateDevice(token, now, prisma).then((device) =>
      handleIncomingPayment(device, { text: "Rp diterima DANA Bisnis.", ...body }, now, prisma)
    );

  it("pairing: kode 8 karakter sekali pakai, token hanya diberikan sekali dan disimpan sebagai hash", async () => {
    const { code, expiresAt } = await createPairingCode("admin-1", NOW, prisma);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 10 * MIN);

    const { token, device } = await pairDevice({ code: code.toLowerCase(), name: "HP Kasir" }, NOW, prisma);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const saved = await prisma.paymentDevice.findUniqueOrThrow({ where: { id: device.id } });
    expect(saved.tokenHash).not.toContain(token);

    await expect(pairDevice({ code, name: "HP Lain" }, NOW, prisma)).rejects.toThrow(AppError); // sudah dipakai
  });

  it("pairing: kode kedaluwarsa atau salah ditolak", async () => {
    const { code } = await createPairingCode("admin-1", NOW, prisma);
    await expect(pairDevice({ code, name: "HP" }, at(11), prisma)).rejects.toThrow(AppError);
    await expect(pairDevice({ code: "ZZZZZZZZ", name: "HP" }, NOW, prisma)).rejects.toThrow(AppError);
  });

  it("nominal cocok → reservasi langsung CONFIRMED, log MATCHED, perangkat tercatat terakhir aktif", async () => {
    const { token, device } = await pairedDevice();
    const r = await book();
    const res = await report(token, { notifId: "n1", amount: r.payAmount, time: at(5).getTime() }, at(6));
    expect(res).toMatchObject({ result: "MATCHED", reservationCode: r.code });
    const row = await prisma.reservation.findUniqueOrThrow({ where: { code: r.code } });
    expect(row.status).toBe("CONFIRMED");
    expect(row.paymentType).toBe("QRIS");
    expect((await prisma.paymentDevice.findUniqueOrThrow({ where: { id: device.id } })).lastSeenAt).not.toBeNull();
  });

  it("notifikasi yang sama dikirim ulang → diproses sekali saja", async () => {
    const { token } = await pairedDevice();
    const r = await book();
    const body = { notifId: "n1", amount: r.payAmount, time: at(5).getTime() };
    const first = await report(token, body, at(6));
    const again = await report(token, body, at(7));
    expect(again).toEqual(first);
    expect(await prisma.incomingPayment.count()).toBe(1);
  });

  it("nominal tidak cocok → NO_MATCH, muncul di daftar admin, bisa ditandai sudah dicek", async () => {
    const { token } = await pairedDevice();
    await book();
    const res = await report(token, { notifId: "n9", amount: 12345, time: at(5).getTime() }, at(6));
    expect(res.result).toBe("NO_MATCH");
    const unmatched = await listUnmatchedPayments(at(6), prisma);
    expect(unmatched.map((u) => u.amount)).toEqual([12345]);
    await dismissIncomingPayment(unmatched[0].id, "admin-1", prisma);
    expect(await listUnmatchedPayments(at(6), prisma)).toHaveLength(0);
  });

  it("anti-replay: pembayaran tidak bisa cocok dengan reservasi yang dibuat SETELAH notifikasi muncul", async () => {
    const { token } = await pairedDevice();
    const r = await book("10:00", "12:00", at(30));
    const res = await report(token, { notifId: "lama", amount: r.payAmount, time: NOW.getTime() }, at(31));
    expect(res.result).toBe("NO_MATCH");
    expect((await prisma.reservation.findUniqueOrThrow({ where: { code: r.code } })).status).toBe("PENDING_PAYMENT");
  });

  it("reservasi sudah lunas lalu nominal sama dilaporkan HP lain → ALREADY_PAID, tidak dobel", async () => {
    const a = await pairedDevice();
    const b = await pairedDevice();
    const r = await book();
    await report(a.token, { notifId: "x", amount: r.payAmount, time: at(5).getTime() }, at(6));
    const res = await report(b.token, { notifId: "y", amount: r.payAmount, time: at(5).getTime() }, at(6));
    expect(res).toMatchObject({ result: "ALREADY_PAID", reservationCode: r.code });
  });

  it("bayar terlambat saat slot sudah diambil → LATE_SLOT_TAKEN, refund penuh, masuk Perlu Tindakan", async () => {
    const { token } = await pairedDevice();
    const late = await book();
    await book("10:00", "12:00", at(30)); // hold pertama habis, slot diambil orang lain
    const res = await report(token, { notifId: "telat", amount: late.payAmount, time: at(25).getTime() }, at(31));
    expect(res.result).toBe("LATE_SLOT_TAKEN");
    const row = await prisma.reservation.findUniqueOrThrow({ where: { code: late.code } });
    expect(row.status).toBe("CANCELLED");
    expect(row.refundAmount).toBe(late.payAmount);
    expect((await getNeedsActionReservations(at(31), prisma)).map((x) => x.id)).toContain(row.id);
  });

  it("token salah atau dicabut → 401, tidak ada yang diproses", async () => {
    const { token, device } = await pairedDevice();
    await expect(authenticateDevice("token-ngawur", NOW, prisma)).rejects.toThrow(UnauthorizedError);
    await revokeDevice(device.id, "admin-1", NOW, prisma);
    await expect(authenticateDevice(token, NOW, prisma)).rejects.toThrow(UnauthorizedError);
    const devices = await listDevices(prisma);
    expect(devices[0].revokedAt).not.toBeNull();
    expect(devices[0]).not.toHaveProperty("tokenHash");
  });

  it("route: pairing lewat HTTP lalu lapor dengan Bearer token; tanpa token 401; body salah 400", async () => {
    const { code } = await createPairingCode("admin-1", new Date(), prisma);
    const pairRes = await pairRoute(new NextRequest("http://x/api/devices/pair", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: "HP Kasir" }),
    }));
    expect(pairRes.status).toBe(201);
    const { token } = (await pairRes.json()).data;

    const post = (body: unknown, auth?: string) => notificationRoute(new NextRequest("http://x/api/payments/qris/notification", {
      method: "POST",
      headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
      body: JSON.stringify(body),
    }));
    const body = { notifId: "n1", amount: 999, time: Date.now(), text: "Rp999 diterima DANA Bisnis." };
    expect((await post(body)).status).toBe(401);
    expect((await post(body, "Bearer salah")).status).toBe(401);
    expect((await post({ ...body, amount: -5 }, `Bearer ${token}`)).status).toBe(400);
    const okRes = await post(body, `Bearer ${token}`);
    expect(okRes.status).toBe(200);
    expect((await okRes.json()).data).toEqual({ result: "NO_MATCH", reservationCode: null });
  });
});
