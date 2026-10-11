# Kode Booking 4 Karakter (tanpa QR) & Sisa UI shadcn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti kode booking jadi 4 karakter yang bisa diunduh sebagai gambar (QR check-in dihapus), lalu rapikan sisa form admin dengan komponen shadcn.

**Architecture:** Kode dibuat di `src/server/codes.ts` (fungsi murni). Midtrans menerima `order_id = "<kode>-<8 hex>"` supaya unik selamanya per akun; webhook memetakan balik ke kode di satu tempat (`notification.ts`). Kartu kode digambar di browser dengan Canvas API bawaan (tanpa dependensi). Kasir check-in dengan mengetik 4 karakter di dashboard admin.

**Tech Stack:** Next.js 16 App Router, Prisma 6, Zod 4, Vitest 5, shadcn/ui (radix-nova), sonner, lucide-react.

**Spec:** desain disetujui di percakapan (brainstorming 2026-10-11). Ringkasan keputusan ada di Global Constraints di bawah.

## Global Constraints

- Mode **ponytail**: solusi terpendek yang lengkap; tidak ada dependensi baru selain komponen shadcn `select`. Paket `qrcode` dan `@types/qrcode` **dihapus**.
- Format kode: **tepat 4 karakter**, tanpa awalan, dari alfabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (tanpa 0/O/1/I/L), **wajib minimal 1 huruf dan 1 angka**, memakai `crypto`. Bentrok dengan kode yang ada → ulangi (loop yang sudah ada di `create.ts`).
- `order_id` Midtrans = `` `${code}-${randomBytes(4).toString("hex")}` `` (contoh `7K2F-9a3c01be`).
- Kode lama format `ATM-XXXXXX` di database tetap harus bisa dicari dan dibayar (jangan migrasi data).
- Rate limit `POST /api/tickets/lookup`: **10 percobaan / 15 menit / IP** → respons **429 `RATE_LIMITED`** dengan pesan Bahasa Indonesia yang menyebut kapan bisa dicoba lagi.
- Kartu unduhan: PNG, berisi teks logo `atmosphere.cafe_`, kode besar, nama ruangan, jadwal format `formatJadwal` (contoh `Sab, 18 Okt 2026, 10.00–12.00`), nama pemesan, dan teks "Tunjukkan kode ini ke kasir". Tombol hanya tampil untuk status `CONFIRMED` / `CHECKED_IN`.
- Template WA R-W1 baris terakhir: `Lihat e-tiket: {APP_URL}/tiket/{ticketToken}` (menggantikan "Lihat QR check-in").
- Customer langkah 1 tetap memakai `<select>` native untuk jam (picker native lebih nyaman di HP). Hanya `<select>` di halaman admin yang diganti shadcn `Select`.
- Bahasa UI dan pesan error: Bahasa Indonesia. Tidak ada `console.log` baru.

## Review Focus

1. Kode diketik huruf kecil (`7k2f`) di Cek Reservasi atau kotak check-in admin → tetap ketemu (di-uppercase). Tes ada di Task 3 dan Task 5.
2. Reservasi lama berkode `ATM-XXXXXX` menerima webhook dengan `order_id = "ATM-XXXXXX"` → tetap terkonfirmasi. Tes ada di Task 2.
3. Webhook dengan `order_id` bersufiks yang kodenya tidak dikenal (`ZZZZ-00000000`) → 404, bukan crash. Tes ada di Task 2.
4. Customer salah ketik 10× lalu mencoba ke-11 → 429 dengan pesan yang jelas, dan IP lain tidak ikut terblokir. Tes ada di Task 3.
5. Nama ruangan atau nama pemesan yang panjang tidak keluar dari kartu PNG. Diperiksa visual lewat screenshot di Task 8 (Canvas tidak tersedia di Vitest).

---

### Task 0: Amankan pekerjaan sebelumnya (butuh izin user)

Working tree masih berisi perbaikan audit dan migrasi UI shadcn yang belum di-commit. Pisahkan dulu supaya plan ini punya riwayat sendiri.

- [ ] **Step 1:** Tanyakan izin user untuk commit. Kalau diizinkan, buat 2 commit:
  - `fix: perbaikan hasil audit prd (gateway, env, transisi, validasi, foto)`: `src/server/**`, `src/contracts/**`, `src/app/api/**`, `prisma/**`, `tests/**`, `docs/**`, `.env.example`, `public/**`.
  - `feat: ui shadcn, ikon lucide, toast, dan skeleton`: `src/app/**` (selain `api`), `src/components/**`, `src/lib/utils.ts`, `components.json`, `package.json`, `package-lock.json`.
- [ ] **Step 2:** `git status --short` → kosong. Kalau user menolak, lanjut tanpa commit dan semua langkah "Commit" di bawah dilewati.

### Task 1: Generator kode 4 karakter + helper order_id

**Files:**
- Modify: `src/server/codes.ts`
- Test: `tests/unit/codes.test.ts`

**Interfaces:**
- Produces: `generateCode(): string` (format baru), `toOrderId(code: string): string`, `orderIdToCode(orderId: string): string`.

- [ ] **Step 1: Tulis tes yang gagal** (ganti tes `generateCode` lama):

```ts
it("R-I1: generateCode = 4 karakter, tanpa 0/O/1/I/L, selalu ada huruf dan angka", () => {
  for (let i = 0; i < 10000; i++) {
    const code = generateCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(code).toMatch(/[A-Z]/);
    expect(code).toMatch(/[2-9]/);
  }
});

it("R-I3: toOrderId menambah sufiks 8 hex dan orderIdToCode membaliknya", () => {
  const orderId = toOrderId("7K2F");
  expect(orderId).toMatch(/^7K2F-[0-9a-f]{8}$/);
  expect(toOrderId("7K2F")).not.toBe(orderId);
  expect(orderIdToCode(orderId)).toBe("7K2F");
});

it("orderIdToCode membiarkan order_id format lama dan kode tanpa sufiks", () => {
  expect(orderIdToCode("ATM-7K2F9Q")).toBe("ATM-7K2F9Q");
  expect(orderIdToCode("7K2F")).toBe("7K2F");
});
```

- [ ] **Step 2:** `npx vitest run tests/unit/codes.test.ts` → FAIL (`toOrderId` tidak ada, format lama).
- [ ] **Step 3: Implementasi di `src/server/codes.ts`.**
  - `generateCode`: ambil 4 karakter acak (`crypto.randomInt`), lalu ulangi sampai ada huruf dan angka (*rejection sampling*, supaya distribusinya tetap merata).
  - `toOrderId`: gunakan nilai yang ditetapkan di Global Constraints.
  - `orderIdToCode`: `/^[2-9A-Z]{4}-[0-9a-f]{8}$/.test(id) ? id.slice(0, 4) : id`.
- [ ] **Step 4:** Tes di Step 2 → PASS. Sesuaikan asersi lama `toMatch(/^ATM-.../)` di `tests/integration/reservations.test.ts:76`, `routes.test.ts:119`, dan `day3-e2e.test.ts:111` menjadi `/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/`. Literal `"ATM-TEST01"` di fixture tes lain dibiarkan, karena itu justru membuktikan kode lama tetap valid.
- [ ] **Step 5: Commit** `feat: kode booking 4 karakter (R-I1)`.

### Task 2: order_id Midtrans bersufiks + pemetaan di webhook

**Files:**
- Modify: `src/server/reservations/create.ts` (`orderId: createdReservation.code`, sekitar baris 289)
- Modify: `src/server/payments/notification.ts` (pencarian `where: { code: verified.orderId }`)
- Test: `tests/integration/webhook.test.ts`, `tests/integration/reservations.test.ts`

**Interfaces:**
- Consumes: `toOrderId`, `orderIdToCode` dari Task 1.

- [ ] **Step 1: Tulis tes yang gagal.**
  - Di `reservations.test.ts` tes #1: buat gateway yang menyimpan `input.orderId`, lalu `expect(captured).toMatch(new RegExp(`^${result.code}-[0-9a-f]{8}$`))`.
  - Di `webhook.test.ts`, tambahkan tiga tes:
    - `"order_id bersufiks mengonfirmasi reservasi"`: webhook `{ order_id: `${res.code}-ab12cd34`, ... }` → status `CONFIRMED`.
    - `"order_id format lama tetap dipetakan"`: buat reservasi dengan `code: "ATM-OLD001"` langsung via prisma, kirim webhook `order_id: "ATM-OLD001"` → `CONFIRMED`.
    - `"order_id bersufiks dengan kode tak dikenal → NotFoundError"`: `order_id: "ZZZZ-00000000"`.
- [ ] **Step 2:** `npx vitest run tests/integration/webhook.test.ts tests/integration/reservations.test.ts` → FAIL.
- [ ] **Step 3: Implementasi.**
  - `create.ts`: `orderId: toOrderId(createdReservation.code)`.
  - `notification.ts`: `const code = orderIdToCode(verified.orderId)` sekali saja, lalu dipakai untuk `findUnique` dan pesan 404.
  - `PaymentNotification.orderId` tetap menyimpan `order_id` mentah dari payload.
- [ ] **Step 4:** Perintah Step 2 → PASS.
- [ ] **Step 5: Commit** `feat: order_id midtrans unik dengan sufiks (R-I3)`.

### Task 3: Rate limit pencarian tiket

**Files:**
- Create: `src/server/rate-limit.ts`
- Modify: `src/app/api/tickets/lookup/route.ts`
- Test: `tests/unit/rate-limit.test.ts`, `tests/integration/routes.test.ts`

**Interfaces:**
- Produces: `hitRateLimit(key: string, limit: number, windowMs: number, now?: number): { ok: boolean; retryAfterSec: number }`.

- [ ] **Step 1: Tulis tes yang gagal.**
  - Unit: 10 panggilan pertama dengan key `"a"` → `ok: true`; panggilan ke-11 → `ok: false` dengan `retryAfterSec > 0`; key `"b"` tetap `ok: true`; setelah `now + windowMs`, key `"a"` → `ok: true` lagi.
  - Integrasi (`routes.test.ts`):
    - 11× `POST /api/tickets/lookup` dengan header `x-forwarded-for: 10.0.0.9` dan kode salah → respons terakhir status 429, `error.code === "RATE_LIMITED"`.
    - Lookup dengan kode huruf kecil (`code.toLowerCase()`) + nomor yang benar dari IP lain → 200.
- [ ] **Step 2:** `npx vitest run tests/unit/rate-limit.test.ts tests/integration/routes.test.ts` → FAIL.
- [ ] **Step 3: Implementasi.**
  - `rate-limit.ts`: `Map<string, { count: number; resetAt: number }>` di memori modul. Beri komentar `// shortcut: memori per instance serverless, ganti ke Upstash/tabel DB kalau ada penyalahgunaan nyata`.
  - Route: key = `lookup:${x-forwarded-for pertama ?? "local"}`, dicek **sebelum** parse Zod. Kalau ditolak, `throw new AppError("RATE_LIMITED", \`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(retryAfterSec / 60)} menit.\`, 429)`.
- [ ] **Step 4:** Perintah Step 2 → PASS.
- [ ] **Step 5: Commit** `feat: rate limit cek reservasi`.

### Task 4: Hapus QR, ganti dengan kartu kode yang bisa diunduh

**Files:**
- Create: `src/lib/code-card.ts`
- Modify: `src/app/tiket/[token]/page.tsx`, `src/server/reservations/queries.ts` (hapus `checkInUrl`), `src/server/wa.ts` (R-W1), `src/app/cek-reservasi/page.tsx` (placeholder `7K2F`, `maxLength={4}`), `src/app/page.tsx` (fitur "E-Tiket & Kode Booking"), `src/app/admin/check-in/[code]/page.tsx` (teks "Hasil Pindai QR Kasir" → "Check-in Tamu"; aria-label tanpa QR), `package.json` (uninstall `qrcode @types/qrcode`)
- Test: `tests/unit/wa.test.ts`, `tests/integration/day3-e2e.test.ts`

**Interfaces:**
- Consumes: `formatJadwal(start: Date, end: Date): string` dari `@/server/time` (modul murni, aman di client).
- Produces: `downloadCodeCard(input: { code: string; roomName: string; jadwal: string; customerName: string }): Promise<void>`.

- [ ] **Step 1: Tulis tes yang gagal.**
  - `wa.test.ts`: `expect(text).toContain("Lihat e-tiket: https://atmosphere.cafe/tiket/tok1234567890abcdefghijklmnopq")` dan `expect(text).not.toContain("QR")`.
  - `day3-e2e.test.ts`: ganti asersi `checkInUrl` menjadi `expect(ticketConfirmedJson.data).not.toHaveProperty("checkInUrl")`. Ganti juga judul tes dan komentar "QR".
- [ ] **Step 2:** `npx vitest run tests/unit/wa.test.ts tests/integration/day3-e2e.test.ts` → FAIL.
- [ ] **Step 3: Implementasi.**
  - Ubah R-W1 di `wa.ts`, lalu hapus `checkInUrl` dari `getTicketByToken`.
  - `code-card.ts` menggambar di `<canvas>` 1080×1350, dengan latar `#F3F2EF`, kartu putih, teks `#1C2955`, dan aksen `#D81B60`. Kode ditulis besar (sekitar 240px, `letterSpacing`), lalu baris ruangan, jadwal, dan nama dengan `maxWidth` di `fillText` supaya teks panjang menyusut, bukan meluber. Hasilnya `canvas.toBlob` → `URL.createObjectURL` → `<a download="kode-<CODE>.png">`. Tunggu `document.fonts.ready` sebelum menggambar supaya font Inter terpakai.
  - Halaman tiket: hapus import `qrcode`, state `qrDataUrl`, dan blok `<img>` QR. Kode ditampilkan besar (`text-5xl font-mono tracking-[0.3em]`) di tempat QR, dengan teks "Tunjukkan kode ini ke kasir saat tiba". Tombol `Unduh Kode (PNG)` memanggil `downloadCodeCard`. Syarat tampil sama seperti `showQr` lama, dan variabelnya diganti nama menjadi `canCheckIn`.
  - `npm uninstall qrcode @types/qrcode`.
- [ ] **Step 4:** Perintah Step 2 → PASS. `grep -rn "qrcode\|QRCode\|checkInUrl" src tests` → kosong.
- [ ] **Step 5: Commit** `feat: kartu kode booking menggantikan qr`.

### Task 5: Kotak check-in manual di dashboard admin

**Files:**
- Modify: `src/app/admin/page.tsx` (di atas kartu "Perlu Tindakan")

- [ ] **Step 1: Implementasi.**
  - Form `Card` berisi `Input` (`maxLength={4}`, `autoCapitalize="characters"`, `inputMode="text"`, `aria-label="Kode booking"`, nilai di-`toUpperCase()` saat diketik) dan `Button` "Check-in" dengan ikon `LogIn`.
  - Submit menjalankan `router.push(\`/admin/check-in/${code}\`)`, dan tombol nonaktif kalau panjang kode < 4. Kode lama (`ATM-…`) bisa dibuka lewat tombol "Detail" di tabel reservasi.
  - Halaman check-in sudah meng-uppercase lewat API `getCheckInSummaryByCode`. Tambahkan asersi di `tests/integration/admin.test.ts` pada tes "Check-in scanner summary": `getCheckInSummaryByCode(res.code.toLowerCase())` mengembalikan reservasi yang sama.
- [ ] **Step 2:** `npx vitest run tests/integration/admin.test.ts && npx tsc --noEmit && npx eslint src/app/admin/page.tsx` → PASS.
- [ ] **Step 3: Commit** `feat: check-in manual dengan kode di dashboard admin`.

### Task 6: Dokumen keputusan & PRD

**Files:**
- Modify: `docs/prd/00-overview.md`, `docs/KEPUTUSAN.md`

- [ ] **Step 1: Update `00-overview.md`.**
  - §1: "e-tiket ber-QR" → "e-tiket berkode booking".
  - §2: "Check-in lewat QR" → "Check-in dengan kode booking".
  - §3: baris `/tiket/[token]` diganti "unduh kartu kode", dan `/admin/check-in/[code]` diganti "Halaman check-in per kode".
  - R-I1 diganti format baru, R-I3 diganti `order_id = code + "-" + 8 hex`, dan R-W1 diganti teks baru.
  - §7: hapus `checkInUrl` dari respons tiket, lalu tambahkan `429 RATE_LIMITED` ke daftar kode HTTP dan ke baris `POST /api/tickets/lookup`.
- [ ] **Step 2: Update `KEPUTUSAN.md`.** Sesuai aturan di dokumen itu (dicoret, jangan dihapus):
  - K-27 dicoret, lalu tambahkan **K-27 (revisi) ✅ Check-in dengan kode 4 karakter**, beserta alasan: kasir cukup mengetik 4 karakter, dan customer bisa menyimpan kartu PNG.
  - K-06: "Unduh QR" → "Unduh Kode".
  - K-28: contoh kode `ATM-7K2F9Q` → `7K2F`, dengan catatan rate limit.
  - Tanggal "Terakhir diperbarui" diganti 11 Oktober 2026.
- [ ] **Step 3: Commit** `docs: kode booking 4 karakter menggantikan qr`.

### Task 7: Sisa form admin ke shadcn

**Files:**
- Create: `src/components/ui/select.tsx` (via `printf 'n\n' | npx shadcn@latest add select`; **jangan** menimpa `button.tsx`)
- Create: `src/components/OptionsEditor.tsx`
- Modify: `src/app/admin/menu/page.tsx` (modal Produk dan Kategori, `<select>` di baris 511 dan 638), `src/app/admin/ruangan/page.tsx` (modal Ruangan, `<select>` di baris 347), `src/app/admin/page.tsx` (filter status), `src/app/admin/reservasi/[id]/page.tsx` (`<select>` ruangan di dialog reschedule)

**Interfaces:**
- Produces: `OptionsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void })`. Input dan Enter (atau tombol "Tambah") menambah chip yang sudah di-trim. Isian kosong, duplikat (tanpa membedakan huruf besar-kecil), atau isian setelah 10 opsi ditolak dengan pesan di bawah input. Setiap chip punya tombol `X` (`aria-label="Hapus opsi <nama>"`). Semua update bersifat immutable.

- [ ] **Step 1: Modal.** Ganti tiga modal `{showX && <div className="fixed ...">}` dengan `<Dialog open={showX} onOpenChange={setShowX}>`, dengan pola yang sama seperti `admin/reservasi/[id]/page.tsx`: `DialogHeader`/`DialogTitle`, form dengan `Label`+`Input`/`Textarea`, dan `DialogFooter` berisi `DialogClose` "Batal" + `Button type="submit"` dengan `Loader2` saat menyimpan. Simpan sukses → `toast.success`.
- [ ] **Step 2: Opsi produk.** Ganti `prodOptionsStr: string` menjadi `prodOptions: string[]` beserta `<OptionsEditor>`. Payload `options: prodOptions`, dan saat Edit isi `setProdOptions(p.options)`.
- [ ] **Step 3: Select.** Ganti keempat `<select>` admin dengan `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`. Nilai `"ALL"` di filter status tetap dipakai, karena Radix menolak `value=""`.
- [ ] **Step 4:** `npx tsc --noEmit && npx eslint src && npx vitest run` → semua PASS. `grep -n "fixed inset-0" src/app/admin` → kosong.
- [ ] **Step 5: Commit** `feat: form admin memakai dialog dan select shadcn`.

### Task 8: Verifikasi akhir

- [ ] **Step 1:** `npm run lint && npm run typecheck && npx vitest run --coverage && npm run build`. Hasil yang diharapkan: semua hijau dan coverage `src/server/**` ≥ 80%.
- [ ] **Step 2:** Ambil screenshot Playwright di 375px dengan skrip scratchpad `pw/shots.js` (Chromium dari `%LOCALAPPDATA%/ms-playwright/chromium-1234/chrome-win64/chrome.exe`) untuk tiga hal:
  - Halaman tiket `CONFIRMED`: buat reservasi lewat UI, lalu kirim webhook fake ke server dengan `PAYMENT_GATEWAY=fake`.
  - PNG hasil "Unduh Kode": tangkap event `download` Playwright, lalu buka file-nya.
  - Dashboard admin dan dialog Tambah Produk: login memakai `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` dari `.env`.

  Periksa kembali poin 1 dan 5 di Review Focus secara visual.
- [ ] **Step 3:** Laporkan hasil ke user, termasuk apa saja yang tidak terverifikasi.
