# PRD Hari 2 — Pembayaran Midtrans & Backend Admin

> **Target hari ini:** alur penuh *checkout → bayar di simulator Midtrans → webhook → CONFIRMED* berjalan, dan semua endpoint admin selesai serta teruji. Di akhir hari, **backend selesai 100%**.
> **Acuan:** [`00-overview.md`](00-overview.md) §4 (status), §5 R-PAY / R-B / R-W, §7 (API admin), §8 (Midtrans).

## 1. Midtrans Gateway (±1,5 jam)
- [ ] **`payments/midtrans.ts`:** implementasi `PaymentGateway` memakai `fetch`.
  - Base URL dipilih dari `MIDTRANS_IS_PRODUCTION`.
  - `createPayment` mengirim `enabled_payments` sesuai R-P4 dan `expiry` = `paymentExpiryMinutes`.
  - `item_details` diambil dari item reservasi (nama dipotong maksimal 50 karakter). **Pastikan jumlahnya sama dengan `gross_amount`.**
- [ ] **`verifyNotification`:**
  1. Validasi signature (R-PAY1). Bandingkan dengan `crypto.timingSafeEqual`.
  2. Panggil `GET /v2/{order_id}/status` (R-PAY2).
  3. Petakan statusnya (§8).
- [ ] Unit test: signature yang benar dan salah (memakai contoh payload + server key palsu), serta pemetaan setiap `transaction_status`. `fetch` di-mock.

## 2. Webhook & Transisi Status (±2 jam)
- [ ] **`reservations/transitions.ts`:** satu fungsi per transisi di tabel §4.
  - Setiap fungsi mengecek status asal. Kalau tidak sesuai → `InvalidTransitionError` (422).
  - Setiap fungsi menulis `ActivityLog` (dengan `actorId` dari admin, atau `null` untuk sistem).
- [ ] **`payments/notification.ts`:** `handleNotification(body)`
  1. Simpan `PaymentNotification`. Ini selalu dilakukan, termasuk saat signature tidak valid.
  2. Signature tidak valid → 401. Kode reservasi tidak dikenal → 404.
  3. `PAID` + `PENDING_PAYMENT` → cek nominal (R-PAY4) → `CONFIRMED` (`paidAt`, `paymentType`).
  4. `PAID` + `EXPIRED` → coba `CONFIRMED`. Kalau gagal dengan `23P01` → `CANCELLED`, `cancelledBy=SYSTEM`, refund penuh `PENDING`, log `LATE_PAYMENT_SLOT_TAKEN`.
  5. `PAID` + `CONFIRMED`/`CHECKED_IN`/`COMPLETED` → tidak melakukan apa-apa (idempoten).
  6. `FAILED` + `PENDING_PAYMENT` → `EXPIRED`.
- [ ] Route `POST /api/payments/midtrans/notification`.
- [ ] Set `PAYMENT_GATEWAY=midtrans` di `.env` lokal.

## 3. Tiket & Lookup (±30 menit)
- [ ] `GET /api/tickets/[token]` diperluas dengan `checkInUrl` (`{APP_URL}/admin/check-in/{code}`) dan `wa.saveLink`/`wa.contactCafeLink`. `snapToken` hanya dikirim kalau status masih menunggu bayar dan belum kedaluwarsa.
- [ ] `POST /api/tickets/lookup`. Nomor yang dikirim dinormalisasi dulu, dan respons gagal dibuat sama persis apa pun penyebabnya.

## 4. Auth Admin (±1 jam)
- [ ] Setup Better Auth di `src/server/auth.ts`: email + password, **sign-up publik dimatikan**, adapter Prisma. Tambahkan tabelnya ke schema lalu jalankan migrasi.
- [ ] Route `src/app/api/auth/[...all]/route.ts`.
- [ ] Buat helper `requireAdmin(request)`. Tanpa sesi → 401. Panggil di **setiap** route `/api/admin/*`.
- [ ] Buat `middleware.ts` yang mengarahkan halaman `/admin/*` (kecuali `/admin/login`) ke halaman login kalau belum ada sesi. Ini hanya untuk kenyamanan. Pengecekan yang sebenarnya tetap `requireAdmin` di setiap route.
- [ ] Script seed admin dari `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` (cek dokumentasi Better Auth untuk cara membuat user dari server saat sign-up dimatikan).
- [ ] Rate limit bawaan Better Auth untuk endpoint login dibiarkan aktif.

## 5. Endpoint Admin (±3 jam)
- [ ] **Reservasi:** list (filter `date`, `status`), detail (termasuk item dan log), `check-in`, `complete`, `no-show`, `cancel`, `refund-done`, `reschedule`.
  - `cancel` dengan `by=CAFE` → `refundAmount = totalAmount`. Dengan `by=CUSTOMER` → `refundAmount` wajib diisi (0..total).
  - `refundStatus = refundAmount > 0 ? PENDING : NONE`.
  - Respons menyertakan `waLink` (R-W3/R-W4).
  - `reschedule` memakai validasi R-T1–R-T3 dan R-T5 (R-T4 dilewati) + R-A, di dalam transaksi dengan row lock yang sama seperti create. `23P01` → 409.
- [ ] **`GET /api/admin/check-in/[code]`**
- [ ] **`GET /api/admin/needs-action`** (R-B3)
- [ ] **`GET /api/admin/kitchen?date`:** reservasi `CONFIRMED`/`CHECKED_IN` di tanggal itu, diurutkan berdasarkan waktu penyajian efektif:
  - `ON_ARRIVAL` = `startAt`
  - `AFTER_30_MIN` = `startAt` + 30 menit
  - `CUSTOM` = `servingAt`

  Ditambah `totals` per (productName, option).
- [ ] **Ruangan:** CRUD. Arsip ditolak kalau masih ada reservasi aktif di masa depan.
- [ ] **Blokir:** list/create/delete. Create memakai row lock pada ruangan dan mengembalikan `conflicts` (R-B2). Log `BLOCK_CREATED`/`BLOCK_DELETED`.
- [ ] **Kategori:** CRUD. Hapus ditolak kalau kategori masih berisi produk.
- [ ] **Produk:** CRUD + arsip. Validasi Zod: `basePrice` 500–10.000.000, `options` maksimal 10 item, setiap opsi unik dan tidak kosong.
- [ ] **Upload:** `POST /api/admin/uploads` dengan validasi MIME (cek *magic bytes*, bukan hanya ekstensi), maksimal 2 MB, nama file acak, lalu `put()` ke Vercel Blob.
- [ ] **Pengaturan:** GET/PATCH dengan validasi Zod. Contohnya: `openTime < closeTime`, `paymentExpiryMinutes < holdMinutes`, `markupBps` 0–2000, format `cafeWhatsapp` mengikuti R-D2.

## 6. Tes Integrasi Wajib Hari Ini
Dari §12 overview: **#5 (bagian conflicts), #6, #7, #8, #9, #10**, ditambah:
- [ ] Cancel `by=CAFE` → refund = total, `refundStatus=PENDING`, `waLink` berisi nama + kode + nominal
- [ ] Reschedule ke slot yang terisi → 409. Reschedule ke slot kosong → jadwal berubah dan slot lama bisa dipesan
- [ ] Rekap dapur menjumlahkan `Jeruk (Hot)` dan `Jeruk (Ice)` secara terpisah, dan mengabaikan reservasi `CANCELLED`/`EXPIRED`
- [ ] Hapus kategori yang masih berisi produk → 422
- [ ] PATCH setting dengan `paymentExpiryMinutes ≥ holdMinutes` → 400

## 7. Uji Manual End-to-End dengan Sandbox (±45 menit)
1. Jalankan tunnel: `ngrok http 3000` (atau `cloudflared tunnel --url http://localhost:3000`).
2. Di dashboard Midtrans **sandbox** → Settings → Payment → Notification URL: `https://<tunnel>/api/payments/midtrans/notification`.
3. Lewat `docs/api.http`: buat reservasi → buka `snapRedirectUrl` → bayar QRIS di [Simulator Midtrans](https://simulator.sandbox.midtrans.com) → cek `/api/tickets/<token>` sudah `CONFIRMED`.
4. Ulangi tetapi **biarkan sampai kedaluwarsa** → status jadi `EXPIRED`.
5. Coba total < Rp150.000 → di Snap **tidak ada** pilihan VA.

## ✅ Definition of Done Hari 2 (= backend selesai)
- [ ] Semua checklist di atas tercentang, `lint`/`typecheck`/`test` hijau, coverage ≥80%
- [ ] Langkah 1–5 di bagian uji manual sudah dicoba dan berhasil
- [ ] `docs/api.http` berisi contoh untuk **setiap** endpoint
- [ ] Commit: `feat: integrasi midtrans dan backend admin`
