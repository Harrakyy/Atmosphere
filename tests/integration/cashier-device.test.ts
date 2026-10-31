import { setTestQris } from "../helpers/qris";
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { markPaid } from "@/server/reservations/transitions";
import { createPairingCode, listDevices, recordQrisNotification, revokeDevice } from "@/server/devices";
import { POST as pairRoute } from "@/app/api/devices/pair/route";
import { POST as notificationRoute } from "@/app/api/payments/qris/notification/route";
import { wibDateTime } from "@/server/time";

const NOW = wibDateTime("2026-10-16", "12:00");
const MIN = 60 * 1000;
const at = (min: number) => new Date(NOW.getTime() + min * MIN);

const post = (url: string, body: unknown, token?: string) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe("HP kasir SetorPantau → reservasi otomatis Lunas (K-35)", () => {
  let roomId: string;
  let items: { productId: string; option: string | null; quantity: number }[];

  beforeEach(async () => {
    await prisma.qrisNotification.deleteMany();
    await prisma.device.deleteMany();
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

  const book = async (now = NOW) => {
    const r = await createReservation(
      {
        roomId, date: "2026-10-18", start: "10:00", end: "12:00", guestCount: 4, items,
        servingTime: "ON_ARRIVAL",
        customer: { name: "Budi Santoso", phone: "081234567890" },
      },
      { now, db: prisma }
    );
    // createdAt diisi jam database; samakan dengan jam tes supaya aturan "bayar setelah pesan" bisa diuji
    await prisma.reservation.update({ where: { code: r.code }, data: { createdAt: now } });
    return r;
  };

  async function pairedDevice() {
    const { pairingCode } = await createPairingCode("admin");
    const res = await pairRoute(post("http://x/api/devices/pair", { code: pairingCode!.toLowerCase(), name: "HP Kasir Depan" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    return { code: pairingCode!, token: json.data.token as string, deviceId: json.data.device.id as string };
  }

  const notif = (amount: number, time: Date, notifId = `id.dana|${time.getTime()}|Rp${amount}`) => ({
    notifId, amount, time: time.getTime(), text: `Rp${amount} diterima DANA Bisnis.`,
  });

  it("pairing: kode sekali pakai, token dipakai untuk kirim notifikasi, tanpa token → 401", async () => {
    const { code, token } = await pairedDevice();
    expect((await listDevices())[0]).toMatchObject({ name: "HP Kasir Depan", pairingCode: null });

    const reuse = await pairRoute(post("http://x/api/devices/pair", { code }));
    expect(reuse.status).toBe(400);

    const body = notif(1000, new Date());
    expect((await notificationRoute(post("http://x/n", body))).status).toBe(401);
    expect((await notificationRoute(post("http://x/n", body, "salah"))).status).toBe(401);
    const res = await notificationRoute(post("http://x/n", body, token));
    expect(await res.json()).toMatchObject({ success: true, data: { result: "NO_MATCH", reservationCode: null } });
  });

  it("nominal cocok → MATCHED, reservasi CONFIRMED; notifikasi yang sama dikirim ulang tidak diproses dua kali", async () => {
    const { deviceId } = await pairedDevice();
    const r = await book();
    const out = await recordQrisNotification(deviceId, notif(r.payAmount, at(3)), at(4), prisma);
    expect(out).toEqual({ result: "MATCHED", reservationCode: r.code });

    const row = await prisma.reservation.findUniqueOrThrow({ where: { code: r.code } });
    expect(row.status).toBe("CONFIRMED");
    expect(row.paidAt?.getTime()).toBe(at(3).getTime());

    const again = await recordQrisNotification(deviceId, notif(r.payAmount, at(3)), at(10), prisma);
    expect(again).toEqual(out);
    expect(await prisma.qrisNotification.count()).toBe(1);
  });

  it("nominal beda, atau uang masuk sebelum pesanan dibuat → NO_MATCH dan reservasi tetap menunggu", async () => {
    const { deviceId } = await pairedDevice();
    const r = await book();
    expect((await recordQrisNotification(deviceId, notif(r.totalAmount, at(3)), at(4), prisma)).result).toBe("NO_MATCH");
    expect((await recordQrisNotification(deviceId, notif(r.payAmount, at(-60)), at(4), prisma)).result).toBe("NO_MATCH");
    expect((await prisma.reservation.findUniqueOrThrow({ where: { code: r.code } })).status).toBe("PENDING_PAYMENT");
  });

  it("admin sudah Tandai Lunas lebih dulu → ALREADY_PAID", async () => {
    const { deviceId } = await pairedDevice();
    const r = await book();
    const row = await prisma.reservation.findUniqueOrThrow({ where: { code: r.code } });
    await markPaid(row.id, "admin", at(5), prisma);
    expect(await recordQrisNotification(deviceId, notif(r.payAmount, at(3)), at(20), prisma)).toEqual({
      result: "ALREADY_PAID", reservationCode: r.code,
    });
  });

  it("bayar terlambat dan slot sudah diambil orang → LATE_SLOT_TAKEN (batal + refund penuh)", async () => {
    const { deviceId } = await pairedDevice();
    const late = await book();
    await book(at(30)); // hold 17 menit habis, slot diambil pesanan lain
    const out = await recordQrisNotification(deviceId, notif(late.payAmount, at(31)), at(32), prisma);
    expect(out).toEqual({ result: "LATE_SLOT_TAKEN", reservationCode: late.code });
    const row = await prisma.reservation.findUniqueOrThrow({ where: { code: late.code } });
    expect(row.status).toBe("CANCELLED");
    expect(row.refundAmount).toBe(late.payAmount);
  });

  it("waktu notifikasi di masa depan ditolak; perangkat yang diputus → 401", async () => {
    const { deviceId, token } = await pairedDevice();
    await expect(recordQrisNotification(deviceId, notif(1000, at(60)), NOW, prisma)).rejects.toThrow("Waktu notifikasi");

    await revokeDevice(deviceId, "admin");
    expect((await notificationRoute(post("http://x/n", notif(1000, new Date()), token))).status).toBe(401);
    expect(await listDevices()).toHaveLength(0);
  });
});
