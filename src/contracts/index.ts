import { z } from "zod";

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam mulai harus HH:mm"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Format jam selesai harus HH:mm"),
  guests: z.coerce.number().int().positive("Jumlah tamu harus lebih dari 0"),
});

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

export const dayBusyQuerySchema = z.object({
  roomId: z.string().min(1, "roomId wajib diisi"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
});

export const cartItemInputSchema = z.object({
  productId: z.string().min(1, "productId wajib diisi"),
  option: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(200),
});

export const createReservationSchema = z.object({
  roomId: z.string().min(1, "roomId wajib diisi"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam mulai harus HH:mm"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Format jam selesai harus HH:mm"),
  guestCount: z.number().int().positive("Jumlah tamu harus lebih dari 0"),
  items: z.array(cartItemInputSchema).min(1, "Keranjang pesanan tidak boleh kosong"),
  servingTime: z.enum(["ON_ARRIVAL", "AFTER_30_MIN", "CUSTOM"]),
  servingAt: z.string().nullable().optional(),
  kitchenNote: z.string().max(300, "Catatan dapur maksimal 300 karakter").nullable().optional(),
  customer: z.object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(80, "Nama maksimal 80 karakter"),
    phone: z.string().min(5, "Nomor WhatsApp wajib diisi"),
    email: z
      .string()
      .email("Format email tidak valid")
      .nullable()
      .optional()
      .or(z.literal("")),
  }),
});

export type CreateReservationInputSchema = z.infer<typeof createReservationSchema>;

export const lookupTicketSchema = z.object({
  code: z.string().min(1, "Kode booking wajib diisi"),
  phone: z.string().min(1, "Nomor WhatsApp wajib diisi"),
});

export const adminCancelSchema = z.object({
  by: z.enum(["CAFE", "CUSTOMER"]),
  reason: z.string().min(1, "Alasan pembatalan wajib diisi"),
  refundAmount: z.number().int().min(0, "Nominal refund tidak boleh negatif").optional(),
});

export const adminRefundDoneSchema = z.object({
  note: z.string().optional(),
});

export const adminRescheduleSchema = z.object({
  roomId: z.string().min(1, "roomId wajib diisi"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam mulai harus HH:mm"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Format jam selesai harus HH:mm"),
});

export const adminCreateRoomSchema = z
  .object({
    name: z.string().min(1, "Nama ruangan wajib diisi"),
    slug: z.string().min(1, "Slug wajib diisi"),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    minGuests: z.number().int().min(1, "Min tamu minimal 1"),
    maxGuests: z.number().int().min(1, "Max tamu minimal 1"),
    facilities: z.array(z.string()).default([]),
    photoUrl: z.string().nullable().optional(),
    sortOrder: z.number().int().default(0),
  })
  .refine((data) => data.maxGuests >= data.minGuests, {
    message: "Max tamu harus lebih besar atau sama dengan min tamu",
    path: ["maxGuests"],
  });

export const adminUpdateRoomSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    minGuests: z.number().int().min(1).optional(),
    maxGuests: z.number().int().min(1).optional(),
    facilities: z.array(z.string()).optional(),
    photoUrl: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (data) => {
      if (data.minGuests !== undefined && data.maxGuests !== undefined) {
        return data.maxGuests >= data.minGuests;
      }
      return true;
    },
    {
      message: "Max tamu harus lebih besar atau sama dengan min tamu",
      path: ["maxGuests"],
    }
  );

export const adminCreateBlockSchema = z.object({
  startAt: z.string().min(1, "Waktu mulai blokir wajib diisi"),
  endAt: z.string().nullable().optional(),
  reason: z.string().min(1, "Alasan blokir wajib diisi"),
});

export const adminCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  kind: z.enum(["FOOD", "DRINK"]),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const adminUpdateCategorySchema = adminCategorySchema.partial();

export const adminProductSchema = z.object({
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  name: z.string().min(1, "Nama produk wajib diisi"),
  description: z.string().nullable().optional(),
  basePrice: z
    .number()
    .int()
    .min(500, "Harga kasir minimal 500")
    .max(10_000_000, "Harga kasir maksimal 10.000.000"),
  options: z
    .array(z.string().min(1, "Opsi tidak boleh kosong"))
    .max(10, "Maksimal 10 opsi")
    .refine((opts) => new Set(opts).size === opts.length, "Setiap opsi harus unik")
    .default([]),
  label: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const adminUpdateProductSchema = adminProductSchema.partial();

export const adminUpdateSettingSchema = z
  .object({
    markupBps: z.number().int().min(0, "Markup minimal 0 bps").max(2000, "Markup maksimal 2000 bps").optional(),
    roundingUnit: z.number().int().positive().optional(),
    vaMinTotal: z.number().int().min(0).optional(),
    openTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm").optional(),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm").optional(),
    slotStepMinutes: z.number().int().positive().optional(),
    minDurationMinutes: z.number().int().positive().optional(),
    maxDurationMinutes: z.number().int().positive().optional(),
    bufferMinutes: z.number().int().min(0).optional(),
    leadDays: z.number().int().min(0).optional(),
    leadCutoffTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm").optional(),
    maxAdvanceDays: z.number().int().positive().optional(),
    holdMinutes: z.number().int().positive().optional(),
    paymentExpiryMinutes: z.number().int().positive().optional(),
    cafeWhatsapp: z
      .string()
      .regex(/^62\d+$/, "Nomor WhatsApp harus berformat 62...")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.openTime && data.closeTime) {
        return data.openTime < data.closeTime;
      }
      return true;
    },
    {
      message: "Jam buka (openTime) harus lebih awal dari jam tutup (closeTime)",
      path: ["openTime"],
    }
  )
  .refine(
    (data) => {
      if (data.paymentExpiryMinutes !== undefined && data.holdMinutes !== undefined) {
        return data.paymentExpiryMinutes < data.holdMinutes;
      }
      return true;
    },
    {
      message: "Waktu kedaluwarsa pembayaran (paymentExpiryMinutes) harus lebih kecil dari waktu hold (holdMinutes)",
      path: ["paymentExpiryMinutes"],
    }
  );

