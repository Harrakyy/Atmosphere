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
