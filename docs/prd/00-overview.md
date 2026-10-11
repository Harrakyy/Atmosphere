# PRD 00 — Gambaran Umum & Spesifikasi Teknis

> Sistem Reservasi Ruangan & Pre-Order Menu — Atmosphere Cafe (MVP)
> Semua keputusan beserta alasannya ada di [`../KEPUTUSAN.md`](../KEPUTUSAN.md). Dokumen ini adalah **acuan teknis** untuk PRD harian.

## 1. Ringkasan

Customer memesan ruangan meeting di Atmosphere Cafe **sekaligus** pre-order makanan dalam satu alur di web, lalu membayar lunas lewat Midtrans dan menerima e-tiket berkode booking 4 karakter. Admin mengelola ruangan, menu, blokir jadwal, check-in, pembatalan/refund, dan melihat rekap persiapan dapur.

**Tolok ukur sukses MVP** (diambil dari Tabel 1 proposal):

| Indikator | Sekarang | Target MVP |
|---|---|---|
| Konfirmasi pesanan | Hingga 10 menit lewat WA, tidak pasti lewat IG/TikTok | **Otomatis** begitu pembayaran sukses |
| Jumlah tamu diketahui | Saat tamu tiba | **Sejak reservasi dibayar** |
| Reservasi + pesanan makanan | Terpisah | **Satu alur, satu data** |
| Booking ganda | Bisa terjadi | **Mustahil** (dijaga oleh database) |

## 2. Scope MVP

**Masuk:**
- Alur customer 5 langkah (K-20)
- Pembayaran Midtrans Snap sandbox
- E-tiket + tombol WA
- Halaman Cek Reservasi
- Login admin
- Kelola ruangan, blokir jadwal, kategori, produk (termasuk upload foto)
- Daftar dan detail reservasi
- Check-in dengan kode booking 4 karakter
- Selesai, no-show, batal + refund (dengan template WA)
- Reschedule oleh admin
- Rekap dapur per tanggal
- Daftar "Perlu Tindakan"
- Pengaturan
- Log aktivitas

**Tidak masuk:** lihat KEPUTUSAN.md bagian E.

## 3. Halaman

**Customer (tanpa login):**

| Rute | Isi |
|---|---|
| `/` | Langkah 1: tanggal, jam mulai–selesai, jumlah tamu |
| `/reservasi/ruangan` | Langkah 2: ruangan yang tersedia |
| `/reservasi/menu` | Langkah 3: menu, keranjang, waktu penyajian, catatan dapur |
| `/reservasi/checkout` | Langkah 4: data pemesan, ringkasan, tombol Bayar (popup Snap) |
| `/tiket/[token]` | Langkah 5: status, kode booking, detail, tombol WA, unduh kartu kode (PNG) |
| `/cek-reservasi` | Cari tiket dengan kode + nomor WA |

**Admin (wajib login):**

| Rute | Isi |
|---|---|
| `/admin/login` | Halaman login |
| `/admin` | Reservasi per tanggal (default hari ini) + kartu "Perlu Tindakan" |
| `/admin/reservasi/[id]` | Detail reservasi + tombol aksi |
| `/admin/check-in/[code]` | Check-in tamu per kode (kasir mengetik kode di dashboard) |
| `/admin/dapur` | Rekap persiapan per tanggal |
| `/admin/ruangan` | Kelola ruangan + blokir jadwal |
| `/admin/menu` | Kelola kategori + produk |
| `/admin/pengaturan` | Pengaturan sistem |

## 4. Status Reservasi

```
                 webhook lunas                admin check-in        admin selesai
PENDING_PAYMENT ─────────────► CONFIRMED ───────────────► CHECKED_IN ─────────────► COMPLETED
     │                            │  │
     │ webhook expire /           │  ├─ admin no-show ──────► NO_SHOW
     │ waktu tahan habis          │  └─ admin batal ────────► CANCELLED (refund: PENDING → DONE)
     ▼                            │
  EXPIRED ── webhook lunas TERLAMBAT:
               • slot masih kosong → CONFIRMED
               • slot sudah diambil → CANCELLED (cancelledBy=SYSTEM, refund penuh PENDING)
```

| Dari | Ke | Pemicu | Syarat |
|---|---|---|---|
| — | `PENDING_PAYMENT` | Customer checkout | Lolos semua aturan R-* |
| `PENDING_PAYMENT` | `CONFIRMED` | Webhook `settlement` / `capture+accept` | `gross_amount` sama dengan `totalAmount` |
| `PENDING_PAYMENT` | `EXPIRED` | Webhook `expire`/`cancel`/`deny`/`failure`, atau lazy expiry | — |
| `EXPIRED` | `CONFIRMED` | Webhook lunas terlambat | Slot masih kosong (insert/update lolos constraint) |
| `EXPIRED` | `CANCELLED` | Webhook lunas terlambat | Slot sudah terisi. `cancelledBy=SYSTEM`, `refundAmount=totalAmount`, `refundStatus=PENDING` |
| `CONFIRMED` | `CHECKED_IN` | Admin | Tanggal hari ini (WIB) = tanggal reservasi |
| `CONFIRMED` | `NO_SHOW` | Admin | Sekarang ≥ `startAt` |
| `CONFIRMED` | `CANCELLED` | Admin | `cancelledBy` = `CAFE` (refund = total) atau `CUSTOMER` (refund diisi admin, 0..total) |
| `CONFIRMED` | `CONFIRMED` | Admin reschedule | Jadwal baru lolos R-T* dan R-A* (dengan mengabaikan reservasi itu sendiri). Tidak menghitung batas paling lambat pesan |
| `CHECKED_IN` | `COMPLETED` | Admin | — |

Transisi selain yang ada di tabel → **422 `INVALID_TRANSITION`**.

Status refund (`refundStatus`): `NONE` → `PENDING` (saat dibatalkan dengan refund > 0) → `DONE` (admin menandai sudah ditransfer).

"Aktif" (menempati slot) = `PENDING_PAYMENT` (yang waktu tahannya belum habis), `CONFIRMED`, `CHECKED_IN`.

## 5. Aturan Bisnis

Setiap aturan diberi ID supaya bisa dirujuk di tes (`it('R-T3: …')`).

### Waktu (R-T) — semua dihitung dalam WIB (UTC+07:00, offset tetap)
- **R-T1:** `startAt` dan `endAt` berada pada kelipatan `slotStepMinutes` (30) menit.
- **R-T2:** `minDurationMinutes` (60) ≤ durasi ≤ `maxDurationMinutes` (240).
- **R-T3:** `openTime` (10:00) ≤ jam mulai, dan jam selesai ≤ `closeTime` (22:00), di hari yang sama.
- **R-T4 (batas paling lambat):** untuk reservasi tanggal D, waktu sekarang ≤ (D − `leadDays` hari) pukul `leadCutoffTime`. Default: H-1 pukul 21:00.
- **R-T5 (batas paling jauh):** D ≤ hari ini (WIB) + `maxAdvanceDays` (30).
- **R-T6:** `blockEndAt = endAt + bufferMinutes` (30). Dua reservasi aktif di ruangan yang sama tidak boleh punya `[startAt, blockEndAt)` yang beririsan.

### Ketersediaan (R-A)
- **R-A1:** ruangan tidak diarsipkan.
- **R-A2:** `room.minGuests` ≤ jumlah tamu ≤ `room.maxGuests`.
- **R-A3:** tidak beririsan dengan reservasi aktif lain (R-T6). Ini dijamin oleh exclusion constraint.
- **R-A4:** `[startAt, endAt)` tidak beririsan dengan blokir ruangan `[block.startAt, block.endAt ?? ∞)`.
- **R-A5:** `GET /api/availability` mengembalikan semua ruangan yang tidak diarsipkan, masing-masing dengan `available: boolean` dan `reason`: `CAPACITY_TOO_SMALL` | `BELOW_MIN_GUESTS` | `BOOKED` | `BLOCKED`.

### Keranjang (R-C)
- **R-C1:** minimal 1 item berjenis `FOOD` **dan** 1 item berjenis `DRINK` (jenis diambil dari kategori produk).
- **R-C2:** produk ada, `isAvailable=true`, tidak diarsipkan, dan kategorinya aktif.
- **R-C3:** kalau `product.options` tidak kosong, `option` wajib diisi dan harus salah satu dari opsi itu. Kalau kosong, `option` harus `null`.
- **R-C4:** qty per baris 1–200, maksimal 50 baris. Baris dengan pasangan (productId, option) yang sama digabung.

### Harga (R-P)
- **R-P1:** `onlinePrice(base) = ceilDiv(base × (10000 + markupBps), 10000 × roundingUnit) × roundingUnit`, memakai **matematika integer**. Default `markupBps=300`, `roundingUnit=500`.
  - Vektor tes: 27000→28000 · 5000→5500 · 19000→20000 · 9000→9500 · 15000→15500 · 35000→36500
- **R-P2:** `totalAmount = Σ unitPrice × qty`. Tidak ada biaya lain.
- **R-P3:** saat checkout, harga online, harga kasir, nama produk, opsi, dan jenis disalin ke `ReservationItem`.
- **R-P4:** metode pembayaran di Snap: `["other_qris","gopay","shopeepay"]`, ditambah `["bca_va","bni_va","bri_va","permata_va","cimb_va","echannel"]` kalau `totalAmount ≥ vaMinTotal` (150000).

### Data Pemesan (R-D)
- **R-D1:** nama 2–80 karakter.
- **R-D2:** nomor WA dinormalisasi ke format `62…`:
  - Hapus semua karakter selain angka.
  - Awalan `0` → `62`; awalan `8` → `628`.
  - Hasil valid kalau cocok dengan `^628\d{7,12}$`.
- **R-D3:** email opsional. Kalau diisi, harus email yang valid.
- **R-D4:** `servingTime` ∈ `ON_ARRIVAL` | `AFTER_30_MIN` | `CUSTOM`. Kalau `CUSTOM`, `servingAt` wajib dan berada di dalam `[startAt, endAt)`.
- **R-D5:** catatan dapur maksimal 300 karakter.

### Identitas (R-I)
- **R-I1:** `code` = 4 karakter acak (memakai `crypto`) dari `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, tanpa awalan, dan **wajib minimal 1 huruf dan 1 angka**. Kalau bentrok dengan kode yang sudah ada, ulangi. Kode lama berformat `ATM-XXXXXX` tetap valid.
- **R-I2:** `ticketToken` = 24 byte acak dalam format base64url (32 karakter).
- **R-I3:** `order_id` Midtrans = `code + "-" + 8 hex acak` (contoh `7K2F-9a3c01be`), karena `order_id` harus unik selamanya per akun Midtrans sedangkan kode 4 karakter bisa terulang. Webhook memetakan kembali ke `code` dengan membuang sufiks; `order_id` format lama (tanpa sufiks) dipakai apa adanya. Satu reservasi = satu transaksi Snap.

### Pembayaran (R-PAY)
- **R-PAY1:** status hanya berubah lewat webhook yang **signature-nya valid**: `SHA512(order_id + status_code + gross_amount + serverKey)`, dengan `gross_amount` dipakai persis seperti string yang diterima.
- **R-PAY2:** setelah signature valid, ambil status resmi lewat `GET /v2/{order_id}/status`, lalu pakai hasil itu.
- **R-PAY3:** idempoten. Webhook yang sama datang N kali → transisi status dan log aktivitas hanya terjadi sekali. Setiap payload tetap disimpan di `PaymentNotification`.
- **R-PAY4:** `gross_amount` ≠ `totalAmount` → jangan ubah status. Catat log `PAYMENT_AMOUNT_MISMATCH`.
- **R-PAY5:** respons webhook: signature salah → 401. `order_id` tidak dikenal → 404. Selain itu → 200.

### Blokir (R-B)
- **R-B1:** blokir = `{roomId, startAt, endAt|null, reason}`. Di UI dipilih per tanggal: mulai pukul 00:00 WIB di tanggal awal, sampai pukul 00:00 WIB sehari setelah tanggal akhir.
- **R-B2:** membuat blokir **tetap boleh** walaupun ada reservasi yang bentrok. Respons menyertakan `conflicts[]`, yaitu reservasi aktif yang beririsan.
- **R-B3:** "Perlu Tindakan" berisi (a) reservasi `PENDING_PAYMENT`/`CONFIRMED` di masa depan yang beririsan dengan blokir, dan (b) reservasi `CANCELLED` dengan `refundStatus=PENDING`.

### Template WhatsApp (R-W)
Semua template memakai `encodeURIComponent`. Tanggal ditulis dalam format WIB, misalnya `Sab, 18 Okt 2026, 10.00–12.00`.

- **R-W1 Simpan ke WA** (`https://wa.me/?text=`):
  ```
  Reservasi Atmosphere Cafe ✅
  Kode: {code}
  Ruangan: {room} • {jadwal}
  Tamu: {guestCount} orang
  Lihat e-tiket: {APP_URL}/tiket/{ticketToken}
  ```
- **R-W2 Hubungi Cafe** (`https://wa.me/{cafeWhatsapp}?text=`):
  ```
  Halo Atmosphere Cafe, saya {name} dengan reservasi {code} ({jadwal}). Saya ingin bertanya tentang reservasi saya.
  ```
- **R-W3 Pembatalan oleh cafe** (`https://wa.me/{customerPhone}?text=`):
  ```
  Halo Kak {name}, kami dari Atmosphere Cafe.
  Mohon maaf, reservasi {code} di {room} pada {jadwal} terpaksa kami batalkan karena {reason}.
  Pembayaran sebesar {Rp total} akan kami refund penuh.
  Mohon balas dengan: nama bank, nomor rekening, dan nama pemilik rekening. Terima kasih 🙏
  ```
- **R-W4 Pembatalan atas permintaan customer:** sama seperti R-W3, tetapi kalimat kedua diganti *"Sesuai permintaan Kakak, reservasi {code} … telah kami batalkan."* dan nominalnya memakai `refundAmount`. Kalau `refundAmount = 0`, kalimat refund dihapus.

## 6. Model Data (Prisma)

> Semua `DateTime` memakai `@db.Timestamptz(3)`. Uang memakai `Int`. ID memakai `String @id @default(cuid())`. Tabel bawaan Better Auth (`user`, `session`, `account`, `verification`) dibuat sesuai dokumentasinya.

```prisma
enum CategoryKind      { FOOD DRINK }
enum ReservationStatus { PENDING_PAYMENT CONFIRMED CHECKED_IN COMPLETED EXPIRED CANCELLED NO_SHOW }
enum ServingTime       { ON_ARRIVAL AFTER_30_MIN CUSTOM }
enum CancelledBy       { CAFE CUSTOMER SYSTEM }
enum RefundStatus      { NONE PENDING DONE }

model Setting {               // satu baris saja, id = 1
  id                    Int     @id @default(1)
  markupBps             Int     @default(300)
  roundingUnit          Int     @default(500)
  vaMinTotal            Int     @default(150000)
  openTime              String  @default("10:00")   // HH:mm WIB
  closeTime             String  @default("22:00")
  slotStepMinutes       Int     @default(30)
  minDurationMinutes    Int     @default(60)
  maxDurationMinutes    Int     @default(240)
  bufferMinutes         Int     @default(30)
  leadDays              Int     @default(1)
  leadCutoffTime        String  @default("21:00")
  maxAdvanceDays        Int     @default(30)
  holdMinutes           Int     @default(17)
  paymentExpiryMinutes  Int     @default(15)
  cafeWhatsapp          String  @default("")      // format 62…
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)
}

model Room {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  location    String?              // contoh: "Lantai 2"
  minGuests   Int
  maxGuests   Int
  facilities  String[]             // contoh: ["TV","AC","Stopkontak"]
  photoUrl    String?
  sortOrder   Int      @default(0)
  isArchived  Boolean  @default(false)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)
  blocks       RoomBlock[]
  reservations Reservation[]
}

model RoomBlock {
  id          String    @id @default(cuid())
  roomId      String
  startAt     DateTime  @db.Timestamptz(3)
  endAt       DateTime? @db.Timestamptz(3)   // null = sampai waktu yang belum ditentukan
  reason      String
  createdById String
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)
  room        Room      @relation(fields: [roomId], references: [id])
  @@index([roomId, startAt])
}

model Category {
  id        String       @id @default(cuid())
  name      String       @unique
  kind      CategoryKind
  sortOrder Int          @default(0)
  isActive  Boolean      @default(true)
  products  Product[]
}

model Product {
  id          String   @id @default(cuid())
  categoryId  String
  name        String
  description String?
  basePrice   Int                  // harga kasir
  options     String[]             // kosong = tanpa pilihan
  label       String?              // "Best Seller" | "Chef Special" | null
  photoUrl    String?
  isAvailable Boolean  @default(true)
  isArchived  Boolean  @default(false)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)
  category    Category @relation(fields: [categoryId], references: [id])
  @@index([categoryId])
}

model Reservation {
  id             String            @id @default(cuid())
  code           String            @unique
  ticketToken    String            @unique
  roomId         String
  startAt        DateTime          @db.Timestamptz(3)
  endAt          DateTime          @db.Timestamptz(3)
  blockEndAt     DateTime          @db.Timestamptz(3)   // endAt + buffer
  guestCount     Int
  customerName   String
  customerPhone  String                                // sudah dinormalisasi 62…
  customerEmail  String?
  servingTime    ServingTime
  servingAt      DateTime?         @db.Timestamptz(3)
  kitchenNote    String?
  status         ReservationStatus @default(PENDING_PAYMENT)
  totalAmount    Int                                   // harga online
  baseTotal      Int                                   // harga kasir (untuk info)
  holdExpiresAt  DateTime          @db.Timestamptz(3)
  snapToken      String?
  snapRedirectUrl String?
  paymentType    String?
  paidAt         DateTime?         @db.Timestamptz(3)
  checkedInAt    DateTime?         @db.Timestamptz(3)
  completedAt    DateTime?         @db.Timestamptz(3)
  cancelledAt    DateTime?         @db.Timestamptz(3)
  cancelledBy    CancelledBy?
  cancelReason   String?
  refundStatus   RefundStatus      @default(NONE)
  refundAmount   Int               @default(0)
  refundNote     String?
  createdAt      DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime          @updatedAt @db.Timestamptz(3)
  room           Room              @relation(fields: [roomId], references: [id])
  items          ReservationItem[]
  @@index([roomId, startAt])
  @@index([status, startAt])
}

model ReservationItem {
  id            String       @id @default(cuid())
  reservationId String
  productId     String
  productName   String       // snapshot
  option        String?      // snapshot
  kind          CategoryKind // snapshot
  unitPrice     Int          // snapshot harga online
  basePrice     Int          // snapshot harga kasir
  quantity      Int
  lineTotal     Int
  reservation   Reservation  @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  product       Product      @relation(fields: [productId], references: [id])
}

model PaymentNotification {
  id                String   @id @default(cuid())
  orderId           String
  transactionStatus String
  signatureValid    Boolean
  payload           Json
  receivedAt        DateTime @default(now()) @db.Timestamptz(3)
  @@index([orderId])
}

model ActivityLog {
  id            String   @id @default(cuid())
  actorId       String?            // null = sistem/webhook
  reservationId String?
  action        String             // contoh: RESERVATION_CREATED, PAYMENT_CONFIRMED, CHECKED_IN, CANCELLED, REFUND_DONE, BLOCK_CREATED …
  detail        Json?
  createdAt     DateTime @default(now()) @db.Timestamptz(3)
  @@index([reservationId])
}
```

**Migrasi SQL manual** (dibuat dengan `prisma migrate dev --create-only`, lalu SQL ini ditambahkan):
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startAt", "blockEndAt", '[)') WITH &&
  ) WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_time_order" CHECK ("endAt" > "startAt");
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_amount_nonneg" CHECK ("totalAmount" >= 0 AND "refundAmount" >= 0 AND "refundAmount" <= "totalAmount");
ALTER TABLE "Room" ADD CONSTRAINT "room_guest_range" CHECK ("minGuests" >= 1 AND "maxGuests" >= "minGuests");
```
Pelanggaran constraint menghasilkan SQLSTATE `23P01`, yang dipetakan ke **409 `SLOT_TAKEN`**.

## 7. Kontrak API

**Format respons (semua endpoint):**
```ts
type ApiResponse<T> =
  | { success: true;  data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };
```
**Kode HTTP:** 400 `VALIDATION_ERROR` (Zod) · 401 `UNAUTHORIZED` · 404 `NOT_FOUND` · 409 `SLOT_TAKEN` · 422 aturan bisnis (`CART_RULE`, `TIME_RULE`, `ROOM_UNAVAILABLE`, `INVALID_TRANSITION`) · 429 `RATE_LIMITED` · 502 `PAYMENT_GATEWAY_ERROR` · 500 `INTERNAL`. Pesan `message` ditulis dalam Bahasa Indonesia dan aman ditampilkan ke user. Detail error teknis hanya ditulis ke log server.

**Schema Zod untuk request/response disimpan di `src/contracts/`** dan dipakai bersama oleh backend dan frontend.

### Publik
| Method & Path | Request | Response `data` |
|---|---|---|
| `GET /api/menu` | — | `{ categories: [{ id, name, kind, products: [{ id, name, description, price, options, label, photoUrl }] }] }` (`price` = harga online; hanya produk tersedia dan tidak diarsipkan) |
| `GET /api/availability?date=YYYY-MM-DD&start=HH:mm&end=HH:mm&guests=N` | — | `{ rooms: [{ id, name, location, minGuests, maxGuests, facilities, photoUrl, available, reason }] }`. Kalau aturan R-T dilanggar → 422 `TIME_RULE` dengan pesan spesifik |
| `GET /api/availability/day?roomId&date` | — | `{ busy: [{ startAt, endAt }] }` (blok jam yang terisi, termasuk buffer dan blokir) untuk tampilan kalender |
| `POST /api/reservations` | `{ roomId, date, start, end, guestCount, items: [{ productId, option, quantity }], servingTime, servingAt?, kitchenNote?, customer: { name, phone, email? } }` | `{ code, ticketToken, totalAmount, holdExpiresAt, snapToken, snapRedirectUrl }` |
| `GET /api/tickets/[token]` | — | `{ code, status, room, startAt, endAt, guestCount, customerName, items, totalAmount, servingTime, servingAt, kitchenNote, holdExpiresAt, snapToken?, wa: { saveLink, contactCafeLink } }` (`snapToken` hanya ada kalau `PENDING_PAYMENT` dan belum kedaluwarsa) |
| `POST /api/tickets/lookup` | `{ code, phone }` | `{ ticketToken }`. Kalau tidak cocok → 404 dengan pesan umum (tidak membocorkan mana yang salah). Dibatasi 10 percobaan per 15 menit per IP → 429 `RATE_LIMITED` |
| `POST /api/payments/midtrans/notification` | Payload Midtrans | `{ received: true }` |

### Admin (wajib sesi Better Auth; tanpa sesi → 401)
| Method & Path | Fungsi |
|---|---|
| `GET /api/admin/reservations?date&status` | Daftar reservasi (default: hari ini) |
| `GET /api/admin/reservations/[id]` | Detail + item + log aktivitas + `wa.cancelLink` (kalau dibatalkan) |
| `POST /api/admin/reservations/[id]/check-in` | `CONFIRMED → CHECKED_IN` |
| `POST /api/admin/reservations/[id]/complete` | `CHECKED_IN → COMPLETED` |
| `POST /api/admin/reservations/[id]/no-show` | `CONFIRMED → NO_SHOW` |
| `POST /api/admin/reservations/[id]/cancel` | `{ by: "CAFE"\|"CUSTOMER", reason, refundAmount? }` → mengembalikan `{ reservation, waLink }` |
| `POST /api/admin/reservations/[id]/refund-done` | `{ note? }` → `refundStatus: DONE` |
| `POST /api/admin/reservations/[id]/reschedule` | `{ roomId, date, start, end }` |
| `GET /api/admin/check-in/[code]` | Ringkasan reservasi berdasarkan kode (untuk halaman hasil scan) |
| `GET /api/admin/needs-action` | Daftar sesuai R-B3 |
| `GET /api/admin/kitchen?date` | `{ reservations: [...], totals: [{ productName, option, kind, quantity }] }` untuk status `CONFIRMED` dan `CHECKED_IN` |
| `GET/POST /api/admin/rooms`, `PATCH /api/admin/rooms/[id]` | CRUD ruangan (hapus = arsip; ditolak kalau masih ada reservasi aktif di masa depan) |
| `GET/POST /api/admin/rooms/[id]/blocks`, `DELETE /api/admin/blocks/[id]` | Blokir. POST mengembalikan `{ block, conflicts }` |
| `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/[id]` | DELETE ditolak (422) kalau kategori masih berisi produk |
| `GET/POST /api/admin/products`, `PATCH /api/admin/products/[id]` | CRUD produk (hapus = arsip). Respons menyertakan `basePrice` dan `onlinePrice` |
| `POST /api/admin/uploads` | `multipart/form-data` dengan field `file`: JPG/PNG/WebP, maksimal 2 MB → `{ url }` (Vercel Blob) |
| `GET/PATCH /api/admin/settings` | Pengaturan |

## 8. Integrasi Midtrans

```ts
// src/server/payments/gateway.ts
export interface PaymentGateway {
  createPayment(input: {
    orderId: string; amount: number;
    items: { id: string; name: string; price: number; quantity: number }[];
    customer: { name: string; phone: string; email?: string };
    enabledPayments: string[]; expiryMinutes: number;
  }): Promise<{ token: string; redirectUrl: string }>;
  verifyNotification(body: unknown): Promise<
    | { valid: false }
    | { valid: true; orderId: string; status: "PAID" | "PENDING" | "FAILED"; grossAmount: number; paymentType: string; raw: unknown }
  >;
}
```
- **Implementasi:** `MidtransGateway` (memakai `fetch`, tanpa SDK) dan `FakeGateway` (untuk tes dan hari 1).
- **Create:** `POST {SNAP_BASE}/snap/v1/transactions` dengan header `Authorization: Basic base64(serverKey + ":")`. Isi body: `transaction_details`, `item_details` (nama maksimal 50 karakter; nama + opsi digabung, misalnya `"Jeruk (Ice)"`; **jumlah item_details harus sama dengan gross_amount**), `customer_details`, `enabled_payments`, `expiry`. Cek format `expiry` di dokumentasi Snap.
- **Pemetaan status:** `settlement` → `PAID`; `capture` + `fraud_status=accept` → `PAID`; `pending` → `PENDING`; `expire`/`cancel`/`deny`/`failure` → `FAILED`.
- **URL sandbox:** Snap `https://app.sandbox.midtrans.com`, API `https://api.sandbox.midtrans.com`. Script frontend: `https://app.sandbox.midtrans.com/snap/snap.js` dengan `data-client-key`.
- **Kalau `createPayment` gagal:** reservasi langsung ditandai `EXPIRED` (slot dilepas), lalu kembalikan 502.

## 9. Struktur Folder

```
├── docker-compose.yml            # postgres:16, database dev + test
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                   # settings, ruangan, kategori, 80 produk dari docs/data/menu-awal.csv, admin
├── src/
│   ├── contracts/                # schema Zod + tipe yang dipakai bersama
│   ├── server/                   # logika domain, tanpa import dari Next.js
│   │   ├── db.ts  http.ts  settings.ts  time.ts  phone.ts  codes.ts
│   │   ├── pricing.ts  cart.ts  time-rules.ts  availability.ts
│   │   ├── reservations/ create.ts  transitions.ts  queries.ts
│   │   ├── payments/ gateway.ts  midtrans.ts  fake.ts  notification.ts
│   │   ├── blocks.ts  kitchen.ts  wa.ts  activity-log.ts  auth.ts
│   └── app/
│       ├── api/…                 # route handler tipis: parse → panggil server/* → envelope
│       ├── (customer)/…          # hari 3
│       └── admin/…               # hari 3
├── tests/
│   ├── unit/                     # pricing, time-rules, cart, phone, codes, wa
│   └── integration/              # memakai Postgres asli (DATABASE_URL_TEST)
└── docs/
```
**Aturan lapisan:** `src/server/*` tidak boleh mengimpor `next/*`, supaya bisa dites langsung dengan Vitest. Route handler tidak boleh berisi logika bisnis.

## 10. Variabel Lingkungan

```
DATABASE_URL=postgresql://atm:atm@localhost:5432/atmosphere
DATABASE_URL_TEST=postgresql://atm:atm@localhost:5432/atmosphere_test
APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=            # string acak ≥32 karakter
BETTER_AUTH_URL=http://localhost:3000
MIDTRANS_SERVER_KEY=           # SB-Mid-server-… (JANGAN di-commit)
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
PAYMENT_GATEWAY=midtrans       # midtrans | fake
BLOB_READ_WRITE_TOKEN=
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
```
Validasi semua env dengan Zod saat aplikasi start (`src/server/env.ts`). Kalau ada yang kosong, aplikasi gagal start dengan pesan yang jelas.

## 11. Seed Ruangan (foto asli dari cafe di `public/ruangan/`; kapasitas & fasilitas masih asumsi ❓)

| Nama | Foto | Min–Maks tamu | Fasilitas |
|---|---|---|---|
| Ruangan 1 | `/ruangan/1.jpeg` | 4–10 | TV, AC, Wi-Fi, Stopkontak |
| Ruangan 2 | `/ruangan/2.jpeg` | 2–6 | AC, Wi-Fi, Stopkontak |
| Ruangan 3 | `/ruangan/3.jpeg` | 10–30 | TV, Mic, AC, Wi-Fi, Stopkontak |
| Ruangan 4 | `/ruangan/4.jpeg` | 4–12 | AC, Wi-Fi, Stopkontak |

## 12. Strategi Tes & Definition of Done

- **Unit (Vitest):** semua aturan R-T, R-C, R-P, R-D, R-I, R-W. Setiap ID aturan minimal punya 1 tes.
- **Integrasi (Vitest + Postgres asli):** setiap file tes melakukan `TRUNCATE` di awal dan memakai `FakeGateway` sebagai pengganti Midtrans. Tes wajib:
  1. Checkout berhasil → `PENDING_PAYMENT`, item tersalin, total benar
  2. Dua checkout **paralel** untuk slot yang sama → tepat satu sukses, satu 409
  3. Buffer: booking 10–12 menolak booking yang mulai 12.00, tapi menerima yang mulai 12.30
  4. Waktu tahan habis → slot bisa dipesan lagi (lazy expiry)
  5. Blokir → ruangan `available=false, reason=BLOCKED`, dan reservasi yang bentrok muncul di `conflicts`
  6. Webhook signature salah → 401, status tidak berubah
  7. Webhook lunas 2x → satu transisi, satu log, dua `PaymentNotification`
  8. Pembayaran terlambat saat slot sudah diambil → `CANCELLED` + refund `PENDING` penuh
  9. Transisi tidak valid (misalnya check-in reservasi `EXPIRED`) → 422
  10. Endpoint admin tanpa sesi → 401
- **Target coverage:** ≥80% untuk `src/server/**`.
- **Definition of Done per hari:** semua checklist hari itu tercentang · `npm run lint`, `npm run typecheck`, dan `npm test` hijau · tidak ada `console.log` · tidak ada secret di repo · commit dengan format `feat:`/`fix:`/`test:`/`chore:`.

## 13. Konvensi Kode
- TypeScript `strict`. Tidak boleh ada `any` tanpa komentar alasannya.
- **Immutable:** fungsi domain mengembalikan objek baru, tidak mengubah argumen yang diterima.
- File idealnya 200–400 baris (maksimal 800). Fungsi maksimal sekitar 50 baris.
- Semua input publik divalidasi dengan Zod di route handler sebelum masuk ke `src/server`.
- Error ditangani di setiap lapisan. Pesan yang aman untuk user dikirim ke klien, detailnya ditulis ke log server.
