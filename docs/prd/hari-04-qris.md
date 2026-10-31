# PRD Hari 4 — QRIS Dinamis Menggantikan Midtrans (Fase 1)

> **Target:** customer membayar dengan memindai **QRIS dinamis** yang nominalnya sudah terisi dan unik. Admin mengonfirmasi lewat tombol **Tandai Lunas**. Midtrans dihapus seluruhnya.
> **Keputusan:** K-32 sampai K-37 di [`../KEPUTUSAN.md`](../KEPUTUSAN.md).
> **Fase 2** (aplikasi Android pembaca notifikasi DANA) dirinci di PRD terpisah setelah fase ini berjalan.

## 1. Alur Baru

```
Checkout ──► reservasi PENDING_PAYMENT (payAmount unik) ──► halaman e-tiket menampilkan QRIS dinamis
                                                                   │
                     customer bayar lewat e-wallet / m-banking ◄────┘
                                                                   │
                     customer tekan "Saya sudah bayar" ─► waktu tahan diperpanjang (claimHoldMinutes)
                                                                   │   + muncul di "Perlu Tindakan"
                     admin cek aplikasi DANA ─┬─ Tandai Lunas ─► CONFIRMED
                                              └─ Tolak ─────────► EXPIRED (slot dilepas)
```
- Tandai Lunas untuk reservasi `EXPIRED` memakai aturan bayar terlambat yang sudah ada:
  - Slot masih kosong → `CONFIRMED`
  - Slot sudah terisi → `CANCELLED` (`SYSTEM`) dengan refund penuh berstatus `PENDING`

## 2. Aturan Baru

- **R-Q1 (format QRIS):** payload berupa TLV EMVCo dengan CRC16-CCITT (poly `0x1021`, init `0xFFFF`) di tag `63`. QRIS yang disimpan admin wajib: CRC valid, tag `01` = `11` (statis), punya tag `59` (nama merchant).
- **R-Q2 (QRIS dinamis):**
  - Tag `01` diubah menjadi `12`.
  - Tag `54` (nominal, berupa angka bulat tanpa desimal) disisipkan sesuai urutan tag naik.
  - Tag `63` dihitung ulang.
  - Vektor tes: QR uji Rp191.999 → CRC `F3D9`.
- **R-Q3 (nominal unik):**
  - `payAmount = totalAmount − k`.
  - `k` = angka terkecil dari 1..min(999, totalAmount − 1) yang **tidak dipakai** oleh `payAmount` reservasi `PENDING_PAYMENT` yang aktif, maupun reservasi `EXPIRED` yang `holdExpiresAt`-nya dalam 24 jam terakhir.
  - Database menjaga keunikan lewat partial unique index pada `payAmount` khusus `PENDING_PAYMENT`. Kalau terjadi bentrok saat dua request bersamaan, ulangi (maksimal 3x).
- **R-Q4 (klaim bayar):**
  - Hanya untuk status `PENDING_PAYMENT` yang belum kedaluwarsa.
  - Mengisi `paymentClaimedAt`, lalu `holdExpiresAt = max(holdExpiresAt, now + claimHoldMinutes)`.
  - Klaim kedua tidak memperpanjang lagi (idempoten).
  - Kena rate limit.
- **R-Q5 (refund):** semua refund dihitung dari **`payAmount`**, yaitu uang yang benar-benar diterima, bukan `totalAmount`.
- **R-Q6 (Perlu Tindakan):** ditambah daftar reservasi dengan `paymentClaimedAt` dalam 24 jam terakhir dan status `PENDING_PAYMENT` atau `EXPIRED`.
- **R-Q7:** kalau QRIS belum diatur admin, checkout ditolak dengan **503 `PAYMENT_NOT_CONFIGURED`**.

## 3. Perubahan Data

| Tabel | Tambah | Hapus |
|---|---|---|
| `Setting` | `qrisPayload String @default("")`, `claimHoldMinutes Int @default(120)` · default `markupBps` → 0 | `vaMinTotal`, `paymentExpiryMinutes` |
| `Reservation` | `payAmount Int`, `uniqueDiscount Int @default(0)`, `paymentClaimedAt DateTime?` | `snapToken`, `snapRedirectUrl` |

Migrasi data:
- `payAmount = totalAmount` untuk baris lama
- `UPDATE "Setting" SET "markupBps" = 0`
- Partial unique index `reservation_pending_pay_amount`

Tabel `PaymentNotification` **tetap ada** (data lama Midtrans). Fase 2 memakai tabel baru `Device` + `QrisNotification` (K-35).

## 4. Perubahan API

| Endpoint | Perubahan |
|---|---|
| `POST /api/reservations` | Respons: `{ code, ticketToken, totalAmount, uniqueDiscount, payAmount, holdExpiresAt }` |
| `GET /api/tickets/[token]` | Tambah `payAmount`, `uniqueDiscount`, `paymentClaimedAt`, `qris` (string QRIS dinamis, hanya kalau masih menunggu bayar). Hapus `snap*` |
| **Baru** `POST /api/tickets/[token]/claim-payment` | R-Q4 |
| **Baru** `POST /api/admin/reservations/[id]/mark-paid` | `PENDING_PAYMENT`/`EXPIRED` → `CONFIRMED` (atau bayar terlambat) |
| **Baru** `POST /api/admin/reservations/[id]/reject-payment` | `PENDING_PAYMENT` → `EXPIRED` |
| `PATCH /api/admin/settings` | Terima `qrisPayload` (divalidasi R-Q1) dan `claimHoldMinutes` |
| **Dihapus** `POST /api/payments/midtrans/notification` | — |

## 5. Perubahan Tampilan

- **Checkout:** tombol **Buat Pesanan**. Setelah sukses, draft dihapus dan customer diarahkan ke `/tiket/[token]`. Script Snap dihapus.
- **E-tiket (status menunggu bayar):**
  - Gambar QRIS dinamis
  - Rincian: Total, Diskon kode unik, **Bayar tepat**
  - Instruksi: simpan QR lalu scan dari galeri
  - Tombol Unduh QR, timer, dan tombol **Saya sudah bayar**
  - Setelah diklaim: tampil "Menunggu verifikasi admin". Halaman mengecek status setiap 10 detik selama maksimal 1 jam.
- **Admin, Pengaturan:**
  - Upload gambar QRIS → QR dibaca di browser (`jsqr`) → pratinjau nama merchant + NMID → Simpan.
  - Field Midtrans dihapus. Tambah field "Perpanjangan setelah klaim bayar".
- **Admin, detail reservasi:** tampilkan `payAmount` dan waktu klaim. Tombol **Tandai Lunas** dan **Tolak**.

## 6. Yang Dihapus
- File: `src/server/payments/{midtrans,fake,gateway,notification}.ts`, route webhook Midtrans
- Fungsi: `enabledPayments`, `toOrderId`/`orderIdToCode`
- Env: `MIDTRANS_*`, `PAYMENT_GATEWAY`
- Tes: tes Midtrans (`midtrans`, `gateway-select`, `webhook`)

## 7. Checklist

- [x] `src/server/qris.ts` + unit test (R-Q1, R-Q2)
- [x] Skema + migrasi (§3)
- [x] Pembuatan reservasi dengan nominal unik (R-Q3, R-Q7) + tes paralel
- [x] Klaim bayar, Tandai Lunas, Tolak, Perlu Tindakan (R-Q4–R-Q6) + tes
- [x] Refund dihitung dari `payAmount` (R-Q5) + tes
- [x] Pengaturan QRIS + validasi + tes
- [x] Hapus Midtrans (§6)
- [x] Frontend: checkout, e-tiket, pengaturan, detail reservasi
- [x] Tes lama yang tanggalnya di-hardcode diganti tanggal dinamis
- [x] `lint`, `typecheck`, `test` hijau
- [ ] Uji manual: scan QR di DANA, GoPay, OVO, ShopeePay, m-banking (nominal muncul otomatis, jangan dibayar)
- [ ] Ganti QRIS dengan milik mitra sebelum dipakai sungguhan

## 8. Risiko
| Risiko | Antisipasi |
|---|---|
| Ada e-wallet yang menolak QRIS hasil modifikasi | Uji manual di §7. Kalau ditolak, customer masih bisa memindai QRIS statis biasa dan mengetik nominalnya sendiri (diperlihatkan di halaman) |
| Admin lupa menekan Tandai Lunas | Klaim bayar memperpanjang waktu tahan slot + muncul di Perlu Tindakan. Otomatisasi di Fase 2 |
| Customer menekan "Saya sudah bayar" padahal belum | Admin tetap mengecek DANA. Tombol Tolak melepas slot |
