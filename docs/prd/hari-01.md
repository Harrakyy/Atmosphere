# PRD Hari 1 — Fondasi & Mesin Reservasi (Backend)

> **Target hari ini:** reservasi bisa dibuat lewat API dengan semua aturan bisnis ditegakkan, dan booking ganda terbukti mustahil. Pembayaran masih memakai `FakeGateway`.
> **Acuan:** [`00-overview.md`](00-overview.md) (aturan R-*, model data, kontrak API).
> **Cara pakai dengan Claude Code:** *"Kerjakan docs/prd/hari-01.md bagian per bagian dengan TDD. Centang checklist setiap kali satu bagian selesai."*

## 1. Setup Proyek (±1 jam)
- [ ] `create-next-app`: TypeScript, App Router, `src/`, Tailwind, ESLint. Lalu aktifkan `strict` di `tsconfig`.
- [ ] Install dependensi: `prisma @prisma/client zod better-auth`, dan dev dependency `vitest @vitest/coverage-v8 tsx`.
- [ ] Buat `docker-compose.yml` dengan `postgres:16`, user/password `atm`, volume bernama. Tambahkan init script yang membuat database `atmosphere` dan `atmosphere_test`.
- [ ] Buat `.env.example` sesuai §10 overview. Pastikan `.env` masuk `.gitignore`.
- [ ] Buat `src/server/env.ts` untuk validasi env dengan Zod.
- [ ] Siapkan script npm: `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test`, `test:coverage`, `db:migrate`, `db:seed`, `db:reset`.
- [ ] Buat `vitest.config.ts`. Tes integrasi memakai `DATABASE_URL_TEST` dan berjalan **berurutan** (`fileParallelism: false`).

**Selesai bila:** `docker compose up -d` dan `npm run dev` jalan, dan `npm test` lulus (boleh 0 tes).

## 2. Skema Database (±1 jam)
- [ ] Salin model dari §6 overview ke `prisma/schema.prisma` (tabel Better Auth ditambahkan hari 2).
- [ ] Jalankan `prisma migrate dev --name init`.
- [ ] Jalankan `prisma migrate dev --create-only --name reservation_constraints`, tempelkan SQL exclusion constraint + CHECK dari §6, lalu jalankan migrasinya.
- [ ] Buat `src/server/db.ts` berisi Prisma client singleton.

**Selesai bila:** `INSERT` manual dua reservasi `CONFIRMED` yang bertumpuk di ruangan yang sama ditolak dengan error `23P01`.

## 3. Seed (±45 menit)
- [ ] Buat `prisma/seed.ts` (dijalankan dengan `tsx`) yang mengisi:
  - [ ] `Setting` id=1 dengan nilai default
  - [ ] 3 ruangan sesuai §11 overview
  - [ ] 4 kategori: Makanan (FOOD, urutan 1), Snack (FOOD, 2), Minuman (DRINK, 3), Ice Cream (FOOD, 4)
  - [ ] 80 produk dari [`../data/menu-awal.csv`](../data/menu-awal.csv): kolom `pilihan` dipecah dengan `|` menjadi `options`
- [ ] Seed harus **idempoten** (pakai upsert berdasarkan nama/slug), jadi aman dijalankan berulang.
- [ ] Tes integrasi: setelah seed ada 80 produk, dan 15 minuman punya opsi `["Hot","Ice"]`.

## 4. Modul Domain Murni (TDD, ±3 jam)
Tulis tes dulu (RED), lalu implementasinya (GREEN). Setiap fungsi berupa fungsi murni yang tidak menyentuh database.

- [ ] **`time.ts`:** helper WIB.
  - `toWib(date)` dan `wibDateTime(dateStr, "HH:mm") → Date` (offset +07:00)
  - `formatJadwal(start, end)` → `"Sab, 18 Okt 2026, 10.00–12.00"`
  - `todayWib(now)`
- [ ] **`phone.ts`:** `normalizePhone()` sesuai R-D2.
  - Tes: `0812-3456-7890` → `6281234567890`, `+62 812…` → `62812…`, `812…` → `62812…`, `12345` → error.
- [ ] **`codes.ts`:** `generateCode()` dan `generateTicketToken()` sesuai R-I1 dan R-I2.
  - Tes format regex dan tes bahwa karakter terlarang (0/O/1/I/L) tidak pernah muncul dalam 10.000 sampel.
- [ ] **`pricing.ts`:** `onlinePrice(base, settings)` sesuai R-P1 (semua vektor tes wajib lulus) dan `enabledPayments(total, settings)` sesuai R-P4.
- [ ] **`time-rules.ts`:** `validateSchedule({date, start, end}, settings, now)`. Hasilnya `{ ok: true, startAt, endAt, blockEndAt }` atau `{ ok: false, rule: "R-T1".."R-T5", message }`.
  - Satu tes per aturan, termasuk tepat di batas: H-1 pukul 21.00 masih boleh, 21.01 sudah ditolak.
- [ ] **`cart.ts`:** `validateCart(items, productsById)` sesuai R-C1–R-C4. Hasilnya baris yang sudah digabung, lengkap dengan snapshot dan total (memakai `pricing`).
  - Tes: tanpa minuman → `CART_RULE`; opsi salah; opsi wajib tapi kosong; dua baris (produk, opsi) sama digabung; produk tidak tersedia.
- [ ] **`wa.ts`:** `saveTicketLink`, `contactCafeLink`, dan `cancelLink` sesuai R-W1–R-W4. Tes dengan snapshot teks yang sudah di-decode.

## 5. Ketersediaan & Pembuatan Reservasi (±2,5 jam)
- [ ] **`availability.ts`**
  - `getAvailability({date,start,end,guests}, now)`: validasi R-T, lalu untuk setiap ruangan non-arsip hitung `available` dan `reason` (R-A2 → R-A4).
  - Saat mengecek R-A3, reservasi `PENDING_PAYMENT` yang `holdExpiresAt ≤ now` dianggap **tidak aktif**.
  - `getDayBusy(roomId, date)` mengembalikan blok jam yang terisi.
- [ ] **`payments/gateway.ts` + `payments/fake.ts`:** interface sesuai §8. `FakeGateway` mengembalikan token palsu dan bisa diatur supaya gagal (untuk tes 502).
- [ ] **`reservations/create.ts`:** `createReservation(input, deps: { gateway, now })`
  1. Validasi R-T, R-D, dan R-C (tanpa database selain membaca produk, ruangan, dan setting)
  2. `prisma.$transaction` interaktif:
     - `SELECT … FROM "Room" WHERE id=$1 FOR UPDATE`
     - Lazy expiry: `UPDATE "Reservation" SET status='EXPIRED' WHERE "roomId"=$1 AND status='PENDING_PAYMENT' AND "holdExpiresAt" <= now()`
     - Cek R-A1, R-A2, R-A4 (blokir)
     - Insert reservasi + item (generate ulang kode kalau bentrok unique)
     - `ActivityLog RESERVATION_CREATED`
  3. Tangkap `23P01` → lempar `SlotTakenError` (409)
  4. **Di luar transaksi:** `gateway.createPayment(...)`.
     - Sukses → simpan `snapToken` dan `snapRedirectUrl`.
     - Gagal → ubah reservasi jadi `EXPIRED`, catat log, lempar `PaymentGatewayError` (502).
- [ ] **`http.ts`:** helper `ok(data)` dan `fail(error)` untuk envelope, plus pemetaan error domain → kode HTTP (§7).

## 6. Endpoint Publik (±1 jam)
- [ ] `GET /api/menu`
- [ ] `GET /api/availability` dan `GET /api/availability/day`
- [ ] `POST /api/reservations` (gateway dipilih dari `PAYMENT_GATEWAY`; hari ini pakai `fake`)
- [ ] `GET /api/tickets/[token]`
- [ ] Schema Zod untuk request/response di `src/contracts/`. Route handler hanya parse → panggil `src/server` → kembalikan envelope.

## 7. Tes Integrasi Wajib Hari Ini
Dari daftar §12 overview: **#1, #2, #3, #4, #5** (bagian ketersediaan, tanpa endpoint admin), ditambah:
- [ ] `FakeGateway` gagal → reservasi `EXPIRED`, respons 502, dan slot langsung bisa dipesan lagi
- [ ] Pesan tanggal H-0 → 422 `TIME_RULE`
- [ ] Jumlah tamu di luar `min/maxGuests` → ruangan `available=false` dengan `reason` yang benar

Tes #2 (paralel): jalankan `Promise.allSettled([create(a), create(b)])` untuk slot yang sama. Pastikan tepat 1 `fulfilled`, dan yang `rejected` adalah `SlotTakenError`.

## ✅ Definition of Done Hari 1
- [ ] `npm run lint && npm run typecheck && npm test` hijau
- [ ] Coverage `src/server/**` ≥ 80%
- [ ] Bisa dicoba manual: `curl` ke `/api/availability` → `/api/reservations` → `/api/tickets/<token>` mengembalikan data yang benar (simpan contohnya di `docs/api.http`)
- [ ] Commit: `feat: fondasi database dan mesin reservasi`

## Risiko & Antisipasi
| Risiko | Antisipasi |
|---|---|
| Prisma tidak mendukung exclusion constraint | Constraint dibuat lewat SQL manual di migrasi. Jangan pakai `prisma db push` (akan melewati SQL manual), selalu pakai `migrate` |
| Zona waktu meleset | Semua konversi hanya lewat `time.ts`. Tes memakai `now` yang di-inject, tidak memanggil `new Date()` langsung |
| Tes paralel tidak stabil | Tes integrasi dijalankan berurutan per file dan setiap file melakukan `TRUNCATE … CASCADE` |
