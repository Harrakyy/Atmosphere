import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { FakeGateway } from "@/server/payments/fake";
import { auth, seedAdminUser } from "@/server/auth";
import {
  checkInReservation,
  completeReservation,
  noShowReservation,
  cancelReservation,
  markRefundDone,
  rescheduleReservation,
} from "@/server/reservations/transitions";
import { createRoomBlock, deleteRoomBlock, getRoomBlocks } from "@/server/blocks";
import { getKitchenRecap } from "@/server/kitchen";
import { archiveRoom, getAdminRooms, createRoom, updateRoom } from "@/server/rooms";
import { deleteCategory, getAdminCategories, createCategory, updateCategory } from "@/server/categories";
import { getAdminProducts, archiveProduct, createProduct, updateProduct } from "@/server/products";
import { getSettings, updateSettings } from "@/server/settings";
import { uploadImage } from "@/server/uploads";
import {
  getAdminReservations,
  getAdminReservationDetail,
  getNeedsActionReservations,
  getCheckInSummaryByCode,
} from "@/server/reservations/queries";
import {
  AppError,
  InvalidTransitionError,
  SlotTakenError,
} from "@/server/http";

// Next.js Route handlers to test end-to-end admin session verification
import { GET as getAdminReservationsRoute } from "@/app/api/admin/reservations/route";
import { PATCH as patchSettingsRoute } from "@/app/api/admin/settings/route";
import { POST as postBlocksRoute } from "@/app/api/admin/rooms/[id]/blocks/route";
import { GET as getKitchenRoute } from "@/app/api/admin/kitchen/route";
import { NextRequest } from "next/server";

describe("Admin Backend Integration Tests (Day 2)", () => {
  let fakeGateway: FakeGateway;
  let testRoomId: string;
  let foodProductId: string;
  let drinkProductId: string;
  let adminUserId: string;
  let adminCookie: string;

  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.paymentNotification.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.room.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    await seed(prisma);

    fakeGateway = new FakeGateway();

    const room = await prisma.room.findFirst({ where: { slug: "the-loft" } });
    testRoomId = room!.id;

    const food = await prisma.product.findFirst({ where: { name: "Pasta Aglio Olio" } });
    foodProductId = food!.id;

    const drink = await prisma.product.findFirst({ where: { name: "Jeruk" } });
    drinkProductId = drink!.id;

    // Seed admin user
    const adminUser = await seedAdminUser("admin@atmosphere.cafe", "adminpassword123", prisma);
    adminUserId = adminUser!.id;

    // Create session via better-auth signInEmail
    const signInResult = await auth.api.signInEmail({
      body: {
        email: "admin@atmosphere.cafe",
        password: "adminpassword123",
      },
      asResponse: true,
    });

    adminCookie = signInResult.headers.get("set-cookie") || "";
  });

  async function createTestRes(date = "2026-10-18", start = "10:00", end = "12:00") {
    const created = await createReservation(
      {
        roomId: testRoomId,
        date,
        start,
        end,
        guestCount: 5,
        items: [
          { productId: foodProductId, option: null, quantity: 2 },
          { productId: drinkProductId, option: "Ice", quantity: 2 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: {
          name: "Budi Santoso",
          phone: "0812-3456-7890",
          email: "budi@example.com",
        },
      },
      {
        gateway: fakeGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );

    return (await prisma.reservation.findUnique({
      where: { code: created.code },
      include: { room: true },
    }))!;
  }

  // #10. Admin session guard
  it("#10. Admin endpoints reject requests without valid session with 401 UNAUTHORIZED", async () => {
    const unauthedReq = new NextRequest("http://localhost:3000/api/admin/reservations");
    const res = await getAdminReservationsRoute(unauthedReq);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");

    // With valid session cookie
    const authedReq = new NextRequest("http://localhost:3000/api/admin/reservations", {
      headers: { cookie: adminCookie },
    });
    const authedRes = await getAdminReservationsRoute(authedReq);
    expect(authedRes.status).toBe(200);
  });

  // #9. Invalid transitions
  it("#9. Check-in on EXPIRED reservation throws 422 INVALID_TRANSITION", async () => {
    const res = await createTestRes();
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "EXPIRED" },
    });

    await expect(
      checkInReservation(res.id, adminUserId, new Date("2026-10-18T10:00:00+07:00"), prisma)
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("Check-in succeeds on CONFIRMED reservation on H-day (WIB)", async () => {
    const res = await createTestRes("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED" },
    });

    // Check-in on same day WIB
    const checkedIn = await checkInReservation(
      res.id,
      adminUserId,
      new Date("2026-10-18T10:15:00+07:00"),
      prisma
    );

    expect(checkedIn.status).toBe("CHECKED_IN");
    expect(checkedIn.checkedInAt).not.toBeNull();

    // Complete reservation
    const completed = await completeReservation(
      res.id,
      adminUserId,
      new Date("2026-10-18T12:00:00+07:00"),
      prisma
    );
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
  });

  it("No-show succeeds only after startAt has arrived", async () => {
    const res = await createTestRes("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED" },
    });

    // Before startAt -> throws
    await expect(
      noShowReservation(res.id, adminUserId, new Date("2026-10-18T09:30:00+07:00"), prisma)
    ).rejects.toThrow(InvalidTransitionError);

    // After startAt -> succeeds
    const noShow = await noShowReservation(
      res.id,
      adminUserId,
      new Date("2026-10-18T10:30:00+07:00"),
      prisma
    );
    expect(noShow.status).toBe("NO_SHOW");
  });

  // Cancel by CAFE vs CUSTOMER
  it("Cancel by=CAFE triggers full refund, refundStatus=PENDING, and waLink with amount", async () => {
    const res = await createTestRes();
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED" },
    });

    const cancelled = await cancelReservation(
      res.id,
      { by: "CAFE", reason: "Renovasi atap mendadak" },
      adminUserId,
      new Date(),
      prisma
    );

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledBy).toBe("CAFE");
    expect(cancelled.refundStatus).toBe("PENDING");
    expect(cancelled.refundAmount).toBe(res.totalAmount);

    const detail = await getAdminReservationDetail(res.id, prisma);
    expect(detail.wa.cancelLink).toContain("Atmosphere");
    expect(detail.wa.cancelLink).toContain(res.code);
    expect(detail.wa.cancelLink).toContain("refund");

    // Mark refund done
    const refundDone = await markRefundDone(res.id, { note: "BCA 12345678 a/n Budi" }, adminUserId, prisma);
    expect(refundDone.refundStatus).toBe("DONE");
    expect(refundDone.refundNote).toBe("BCA 12345678 a/n Budi");
  });

  it("Cancel by=CUSTOMER validates refundAmount between 0 and totalAmount", async () => {
    const res = await createTestRes();
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED" },
    });

    // Refund melebihi total -> reject
    await expect(
      cancelReservation(
        res.id,
        { by: "CUSTOMER", reason: "Batal sepihak", refundAmount: res.totalAmount + 1000 },
        adminUserId,
        new Date(),
        prisma
      )
    ).rejects.toThrow(InvalidTransitionError);

    // Refund valid 50%
    const cancelled = await cancelReservation(
      res.id,
      { by: "CUSTOMER", reason: "Batal sepihak", refundAmount: Math.floor(res.totalAmount / 2) },
      adminUserId,
      new Date(),
      prisma
    );
    expect(cancelled.refundStatus).toBe("PENDING");
    expect(cancelled.refundAmount).toBe(Math.floor(res.totalAmount / 2));
  });

  // Reschedule
  it("Reschedule to occupied slot throws 409 SlotTakenError; to free slot succeeds and frees old slot", async () => {
    // Reservasi 1: The Loft 10:00 - 12:00
    const res1 = await createTestRes("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res1.id },
      data: { status: "CONFIRMED" },
    });

    // Reservasi 2: The Loft 14:00 - 16:00
    const res2 = await createTestRes("2026-10-18", "14:00", "16:00");
    await prisma.reservation.update({
      where: { id: res2.id },
      data: { status: "CONFIRMED" },
    });

    // Reschedule res2 ke slot res1 (10:00 - 12:00) -> 409 SLOT_TAKEN
    await expect(
      rescheduleReservation(
        res2.id,
        {
          roomId: testRoomId,
          date: "2026-10-18",
          start: "10:00",
          end: "12:00",
        },
        adminUserId,
        new Date("2026-10-10T10:00:00+07:00"),
        prisma
      )
    ).rejects.toThrow(SlotTakenError);

    // Reschedule res2 ke slot kosong (16:30 - 18:30) -> Berhasil
    const moved = await rescheduleReservation(
      res2.id,
      {
        roomId: testRoomId,
        date: "2026-10-18",
        start: "16:30",
        end: "18:30",
      },
      adminUserId,
      new Date("2026-10-10T10:00:00+07:00"),
      prisma
    );
    expect(moved.id).toBe(res2.id);

    // Slot lama res2 (14:00 - 16:00) sekarang kosong dan bisa dipesan reservasi baru
    const res3 = await createReservation(
      {
        roomId: testRoomId,
        date: "2026-10-18",
        start: "14:00",
        end: "16:00",
        guestCount: 5,
        items: [
          { productId: foodProductId, option: null, quantity: 2 },
          { productId: drinkProductId, option: "Ice", quantity: 2 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: {
          name: "Siti",
          phone: "0812-9999-8888",
        },
      },
      {
        gateway: fakeGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );
    expect(res3.code).toBeDefined();
  });

  // #5. Block conflicts
  it("#5. Create room block returns conflicts and logs BLOCK_CREATED; delete block logs BLOCK_DELETED", async () => {
    const res = await createTestRes("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED" },
    });

    // Buat blokir yang mencakup rentang reservasi
    const { block, conflicts } = await createRoomBlock(
      testRoomId,
      {
        startAt: "2026-10-18T00:00:00+07:00",
        endAt: "2026-10-19T00:00:00+07:00",
        reason: "Pemeliharaan AC",
      },
      adminUserId,
      prisma
    );

    expect(block.id).toBeDefined();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].code).toBe(res.code);

    const log = await prisma.activityLog.findFirst({
      where: { action: "BLOCK_CREATED" },
    });
    expect(log).not.toBeNull();

    // Cek needs action menyertakan reservasi yang beririsan
    const needsAction = await getNeedsActionReservations(
      new Date("2026-10-10T00:00:00+07:00"),
      prisma
    );
    expect(needsAction.some((r) => r.id === res.id)).toBe(true);

    // Hapus blokir
    await deleteRoomBlock(block.id, adminUserId, prisma);
    const deleteLog = await prisma.activityLog.findFirst({
      where: { action: "BLOCK_DELETED" },
    });
    expect(deleteLog).not.toBeNull();
  });

  // Kitchen recap
  it("Kitchen recap separates options (Jeruk Hot vs Ice) and ignores CANCELLED/EXPIRED reservations", async () => {
    // Reservasi 1: CONFIRMED dengan Jeruk (Ice) x2 dan Jeruk (Hot) x1
    const res1 = await createReservation(
      {
        roomId: testRoomId,
        date: "2026-10-18",
        start: "10:00",
        end: "12:00",
        guestCount: 5,
        items: [
          { productId: foodProductId, option: null, quantity: 2 },
          { productId: drinkProductId, option: "Ice", quantity: 2 },
          { productId: drinkProductId, option: "Hot", quantity: 1 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: { name: "Tamu 1", phone: "0812-1111-1111" },
      },
      {
        gateway: fakeGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );
    await prisma.reservation.update({
      where: { code: res1.code },
      data: { status: "CONFIRMED" },
    });

    // Reservasi 2: CHECKED_IN dengan Jeruk (Ice) x3
    const sunroom = await prisma.room.findFirst({ where: { slug: "the-sunroom" } });
    const res2 = await createReservation(
      {
        roomId: sunroom!.id,
        date: "2026-10-18",
        start: "12:00",
        end: "14:00",
        guestCount: 3,
        items: [
          { productId: foodProductId, option: null, quantity: 1 },
          { productId: drinkProductId, option: "Ice", quantity: 3 },
        ],
        servingTime: "AFTER_30_MIN",
        customer: { name: "Tamu 2", phone: "0812-2222-2222" },
      },
      {
        gateway: fakeGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );
    await prisma.reservation.update({
      where: { code: res2.code },
      data: { status: "CHECKED_IN" },
    });

    // Reservasi 3: CANCELLED (harus diabaikan)
    const eventSpace = await prisma.room.findFirst({ where: { slug: "event-space" } });
    const res3 = await createReservation(
      {
        roomId: eventSpace!.id,
        date: "2026-10-18",
        start: "15:00",
        end: "17:00",
        guestCount: 12,
        items: [
          { productId: foodProductId, option: null, quantity: 5 },
          { productId: drinkProductId, option: "Hot", quantity: 5 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: { name: "Tamu 3", phone: "0812-3333-3333" },
      },
      {
        gateway: fakeGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );
    await prisma.reservation.update({
      where: { code: res3.code },
      data: { status: "CANCELLED" },
    });

    const recap = await getKitchenRecap("2026-10-18", prisma);
    expect(recap.reservations.length).toBe(2);

    const jerukIce = recap.totals.find((t) => t.productName === "Jeruk" && t.option === "Ice");
    const jerukHot = recap.totals.find((t) => t.productName === "Jeruk" && t.option === "Hot");

    // Jeruk Ice: 2 (dari res1) + 3 (dari res2) = 5
    expect(jerukIce?.quantity).toBe(5);
    // Jeruk Hot: 1 (dari res1), res3 diabaikan
    expect(jerukHot?.quantity).toBe(1);
  });

  // Room Archive rule
  it("Archive room is rejected (422) if active future reservations exist; allowed otherwise", async () => {
    const res = await createTestRes("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED" },
    });

    // Masih ada reservasi masa depan -> tolak 422
    await expect(
      archiveRoom(testRoomId, new Date("2026-10-10T00:00:00+07:00"), prisma)
    ).rejects.toThrow(AppError);

    // Setelah reservasi dibatalkan -> berhasil arsip
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "CANCELLED" },
    });
    const archived = await archiveRoom(testRoomId, new Date("2026-10-10T00:00:00+07:00"), prisma);
    expect(archived.isArchived).toBe(true);
  });

  // Category Delete rule
  it("Delete category with products is rejected with 422; empty category is deleted", async () => {
    const makananCat = await prisma.category.findFirst({ where: { name: "Makanan" } });
    await expect(deleteCategory(makananCat!.id, prisma)).rejects.toThrow(AppError);

    // Kategori baru tanpa produk
    const emptyCat = await prisma.category.create({
      data: { name: "Kategori Kosong", kind: "FOOD" },
    });
    const deleted = await deleteCategory(emptyCat.id, prisma);
    expect(deleted.id).toBe(emptyCat.id);
  });

  // Settings validation
  it("PATCH settings with paymentExpiryMinutes >= holdMinutes returns 400", async () => {
    const invalidReq = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        paymentExpiryMinutes: 20,
        holdMinutes: 15,
      }),
    });

    const res = await patchSettingsRoute(invalidReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");

    // Valid update
    const validReq = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        markupBps: 400,
        paymentExpiryMinutes: 10,
        holdMinutes: 15,
      }),
    });
    const validRes = await patchSettingsRoute(validReq);
    expect(validRes.status).toBe(200);
  });

  // Upload magic bytes validation
  it("Uploads reject invalid MIME magic bytes and accept valid JPG/PNG", async () => {
    // 1. Fake text buffer disguised as .jpg -> rejected
    const fakeFile = new File([Buffer.from("HELLO WORLD NOT AN IMAGE")], "fake.jpg", {
      type: "image/jpeg",
    });
    await expect(uploadImage(fakeFile)).rejects.toThrow(AppError);

    // 2. Valid PNG header (89 50 4E 47 0D 0A 1A 0A)
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const validPng = new File([pngHeader], "test.png", { type: "image/png" });
    const result = await uploadImage(validPng);
    expect(result.url).toBeDefined();
    expect(result.url).toContain(".png");
  });

  // Check-in scanner code lookup
  it("Check-in scanner summary returns reservation for valid code, throws 404 for invalid code", async () => {
    const res = await createTestRes();
    const summary = await getCheckInSummaryByCode(res.code, prisma);
    expect(summary.code).toBe(res.code);

    await expect(getCheckInSummaryByCode("INVALID-CODE", prisma)).rejects.toThrow();
  });

  // Rooms CRUD
  it("Rooms CRUD: getAdminRooms, createRoom, updateRoom work correctly", async () => {
    const initialRooms = await getAdminRooms(prisma);
    expect(initialRooms.length).toBe(3);

    const newRoom = await createRoom(
      {
        name: "VIP Lounge",
        slug: "vip-lounge",
        minGuests: 2,
        maxGuests: 8,
        facilities: ["Sofa", "AC"],
      },
      prisma
    );
    expect(newRoom.id).toBeDefined();

    const updated = await updateRoom(newRoom.id, { description: "Ruangan privat mewah" }, prisma);
    expect(updated.description).toBe("Ruangan privat mewah");
  });

  // Categories CRUD
  it("Categories CRUD: getAdminCategories, createCategory, updateCategory work correctly", async () => {
    const cats = await getAdminCategories(prisma);
    expect(cats.length).toBe(4);

    const newCat = await createCategory({ name: "Dessert", kind: "FOOD" }, prisma);
    expect(newCat.id).toBeDefined();

    const updated = await updateCategory(newCat.id, { name: "Dessert Special" }, prisma);
    expect(updated.name).toBe("Dessert Special");
  });

  // Products CRUD
  it("Products CRUD: getAdminProducts, createProduct, updateProduct, archiveProduct work correctly", async () => {
    const products = await getAdminProducts(prisma);
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].onlinePrice).toBeGreaterThan(0);

    const makananCat = await prisma.category.findFirst({ where: { name: "Makanan" } });
    const newProd = await createProduct(
      {
        name: "Nasi Goreng Spesial",
        basePrice: 35000,
        options: ["Pedas", "Sedang"],
        category: { connect: { id: makananCat!.id } },
      },
      prisma
    );
    expect(newProd.onlinePrice).toBeGreaterThan(35000);

    const updated = await updateProduct(newProd.id, { basePrice: 40000 }, prisma);
    expect(updated.basePrice).toBe(40000);

    const archived = await archiveProduct(newProd.id, prisma);
    expect(archived.isArchived).toBe(true);
  });

  // Settings getter and updater
  it("Settings getter and updater", async () => {
    const setting = await getSettings(prisma);
    expect(setting.id).toBe(1);

    const updated = await updateSettings({ markupBps: 350 }, prisma);
    expect(updated.markupBps).toBe(350);
  });

  // Room blocks list
  it("Room blocks list: getRoomBlocks returns blocks for room", async () => {
    const blocks = await getRoomBlocks(testRoomId, prisma);
    expect(Array.isArray(blocks)).toBe(true);
  });

  // Reservations list query with filters
  it("Admin reservations query filters by date and status", async () => {
    const res = await createTestRes("2026-10-18", "10:00", "12:00");
    const byDate = await getAdminReservations({ date: "2026-10-18" }, new Date(), prisma);
    expect(byDate.some((r) => r.id === res.id)).toBe(true);

    const byStatus = await getAdminReservations({ status: "PENDING_PAYMENT", date: "all" }, new Date(), prisma);
    expect(byStatus.some((r) => r.id === res.id)).toBe(true);
  });

  // Unique item IDs for multi-option items in Midtrans
  it("Cart with multiple options of same product passes unique IDs to PaymentGateway", async () => {
    let capturedItems: { id: string; name: string }[] = [];
    const spyGateway: FakeGateway = new FakeGateway();
    spyGateway.createPayment = async (input) => {
      capturedItems = input.items;
      return { token: "tok", redirectUrl: "url" };
    };

    await createReservation(
      {
        roomId: testRoomId,
        date: "2026-10-18",
        start: "10:00",
        end: "12:00",
        guestCount: 5,
        items: [
          { productId: foodProductId, option: null, quantity: 2 },
          { productId: drinkProductId, option: "Ice", quantity: 1 },
          { productId: drinkProductId, option: "Hot", quantity: 1 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: { name: "Budi", phone: "0812-3456-7890" },
      },
      {
        gateway: spyGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );

    const itemIds = capturedItems.map((i) => i.id);
    const uniqueIds = new Set(itemIds);
    expect(uniqueIds.size).toBe(itemIds.length);
  });

  // Inverted room block dates
  it("Creating room block with endAt <= startAt fails validation with 400", async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/rooms/${testRoomId}/blocks`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        startAt: "2026-10-20T10:00:00+07:00",
        endAt: "2026-10-19T10:00:00+07:00",
        reason: "Invalid dates",
      }),
    });

    const res = await postBlocksRoute(req, { params: Promise.resolve({ id: testRoomId }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  // Admin query param validations
  it("Admin reservations route returns 400 on invalid status param", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/reservations?status=INVALID_STATUS", {
      headers: { cookie: adminCookie },
    });
    const res = await getAdminReservationsRoute(req);
    expect(res.status).toBe(400);
  });

  it("Admin kitchen route returns 400 on invalid date format param", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/kitchen?date=invalid-date", {
      headers: { cookie: adminCookie },
    });
    const res = await getKitchenRoute(req);
    expect(res.status).toBe(400);
  });
});
