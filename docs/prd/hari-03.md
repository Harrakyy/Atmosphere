# PRD Hari 3 — Frontend & Deploy

> **Target hari ini:** desain diubah menjadi halaman Next.js yang terhubung ke API hari 1–2, lalu deploy ke Vercel.
> **Hari ini paling padat.** Kerjakan **berurutan sesuai prioritas**. Kalau waktu habis, bagian P2 dipindah ke "Hari 4 (cadangan)", jangan memangkas P0.
> **Acuan desain:** file HTML desain kalian (`Meeting Room Booking Process`). Token: font Inter, navy `#1C2955`/`#1A2751`, magenta `#D81B60`, latar `#F3F2EF`, border `#DFDDD6`, kartu putih `rounded-2xl`.

## 0. Penyesuaian Desain (wajib dibaca sebelum mulai)

| Layar | Ubah | Keputusan |
|---|---|---|
| Stepper | Urutan jadi: **1. Tanggal & Tamu → 2. Pilih Ruangan → 3. Pilih Menu → 4. Bayar → 5. E-Tiket**. Di mobile tampilkan versi ringkas, misalnya "Langkah 2 dari 5" + progress bar (desain sekarang `hidden md:flex`) | K-20 |
| Langkah 1 (baru) | Ambil kalender + jam mulai/selesai + stepper jumlah tamu dari layar "Tanggal & Waktu". **Form data pemesan dipindah** ke langkah 4. Batas jumlah tamu tidak lagi angka tetap 30, tapi mengikuti ruangan | K-19, K-20 |
| Pilih Ruangan | Kartu ruangan memakai data API. Ruangan yang tidak tersedia ditampilkan **abu-abu dengan alasannya** ("Sudah dipesan", "Kapasitas maks. 6", "Sedang maintenance"). Hapus harga per jam | K-01, R-A5 |
| Pilih Menu | Hapus "Sewa Ruangan Rp300.000" dari keranjang. Tambahkan **pemilih Pilihan** (chip Hot/Ice/saos/rasa) di kartu produk. Tampilkan indikator **"✓ 1 makanan ✓ 1 minuman"**, dan tombol lanjut nonaktif sampai syarat terpenuhi. Pertahankan pilihan `waktu_penyajian` + catatan dapur | K-01, K-13 |
| Bayar | Tab QRIS/VA/Kartu buatan sendiri **dihapus**. Isinya: form data pemesan + ringkasan + tombol **Bayar** (`window.snap.pay(token)`) + timer dari `holdExpiresAt` | K-07, K-16 |
| E-Tiket | QR "LUMA/NMID" diganti **QR check-in** (`checkInUrl`). Tambahkan tombol **Simpan ke WhatsApp**, **Hubungi Cafe**, **Unduh QR**. Kalau status masih `PENDING_PAYMENT`, tampilkan "Menunggu konfirmasi pembayaran…" dan cek status ulang setiap 3 detik (maksimal 2 menit) | K-06, K-27, K-30 |
| Login | Hapus "UTech". Ubah "Phone or Email" menjadi **Email** | K-11 |
| Kartu menu admin | Pakai desain grid menu yang sudah ada + tombol "Tambah Menu" | — |
| Semua layar | Hapus data contoh: "Room 14", "Stepana Bandery Ave", "LumaDesk x Konteks", "MG Software", tanggal 2024 | — |

**Prinsip:** mobile-first (uji di lebar 375px), ada state loading/kosong/error di setiap pemanggilan API, dan pesan error diambil dari `error.message` API.

## P0 — Alur Customer (±3,5 jam)
- [ ] Layout customer: header logo `atmosphere.cafe_` + stepper. Komponen bersama: `Button`, `Card`, `Stepper`, `QtyStepper`, `Chip`, `Rupiah` (format `Rp 28.000`).
- [ ] Hook `useBookingDraft()`: state `{date,start,end,guests,roomId,items,servingTime,servingAt,kitchenNote}` disimpan di `sessionStorage` dan dibungkus try/catch. Langkah yang datanya belum lengkap otomatis diarahkan kembali ke langkah sebelumnya.
- [ ] `/` (langkah 1): pilih tanggal (hanya H+1 sampai H+30 yang aktif), jam mulai/selesai berkelipatan 30 menit, jumlah tamu. Tombol "Cari Ruangan".
- [ ] `/reservasi/ruangan`: `GET /api/availability`, lalu pilih ruangan.
- [ ] `/reservasi/menu`: `GET /api/menu`, filter kategori, pencarian, keranjang, pilihan, waktu penyajian, catatan.
- [ ] `/reservasi/checkout`: data pemesan dengan validasi Zod yang sama (`src/contracts`) → `POST /api/reservations` → `snap.pay()`.
  - Callback `onSuccess`/`onPending` → arahkan ke `/tiket/[token]`. `onClose` → tetap di halaman dan tampilkan tombol "Bayar lagi" (pakai token yang sama selama belum kedaluwarsa).
  - Error 409 → tampilkan "Slot baru saja diambil orang lain" dan arahkan kembali ke langkah 2.
- [ ] `/tiket/[token]`: status, QR (library `qrcode`), detail, tombol WA, unduh QR (PNG).
- [ ] Muat script Snap hanya di halaman checkout dan tiket (`next/script`, dengan `data-client-key` dari `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`).

## P0 — Admin Inti (±2 jam)
- [ ] `/admin/login` (memakai client Better Auth).
- [ ] Layout admin dengan sidebar: Reservasi, Dapur, Ruangan, Menu, Pengaturan, Logout.
- [ ] `/admin`: pilih tanggal, tabel reservasi (kode, jam, ruangan, tamu, nama, status badge, total), kartu **Perlu Tindakan** di bagian atas.
- [ ] `/admin/reservasi/[id]`: detail + item + log aktivitas + tombol aksi sesuai status (Check-in / Selesai / No-show / Batalkan / Tandai Refund Selesai / Ubah Jadwal).
  - Dialog **Batalkan**: pilih "Dari cafe" atau "Permintaan customer", isi alasan, isi nominal refund (khusus customer). Setelah sukses, tampilkan tombol **Kirim WA ke Tamu** (`waLink`).
- [ ] `/admin/check-in/[code]`: kartu ringkas (nama, ruangan, jam, tamu, item) + tombol besar **Check-in**. Kalau status bukan `CONFIRMED` atau tanggalnya bukan hari ini, tampilkan alasannya.

## P1 — Admin Data Master & Dapur (±1,5 jam)
- [ ] `/admin/dapur`: pilih tanggal, total per menu+pilihan di bagian atas, kartu per reservasi diurutkan berdasarkan waktu penyajian, dan tombol **Cetak** (`window.print()` + CSS print).
- [ ] `/admin/menu`: tab Kategori (CRUD + jenis) dan Produk (grid dari desain, form tambah/edit dengan upload foto, editor pilihan berupa chip, toggle Tersedia, tampil harga kasir → harga online).
- [ ] `/admin/ruangan`: CRUD ruangan + bagian **Blokir Jadwal** (rentang tanggal, "sampai waktu belum ditentukan", alasan). Setelah simpan, kalau ada `conflicts`, tampilkan daftarnya + tautan ke detail reservasi masing-masing.

## P1 — Deploy (±1 jam)
- [ ] Push ke GitHub, lalu import ke Vercel.
- [ ] Vercel Marketplace: tambahkan **Neon Postgres** (otomatis mengisi `DATABASE_URL`) dan **Blob** (otomatis mengisi `BLOB_READ_WRITE_TOKEN`).
- [ ] Isi env lainnya di Vercel (§10 overview). `APP_URL` dan `BETTER_AUTH_URL` diisi domain Vercel.
- [ ] Build command: `prisma migrate deploy && next build`. Seed dijalankan sekali dari lokal ke database Neon.
- [ ] Dashboard Midtrans sandbox: ubah Notification URL ke `https://<domain>/api/payments/midtrans/notification`.
- [ ] **Smoke test di produksi:** booking → bayar di simulator → tiket `CONFIRMED` → scan QR pakai HP → check-in → reservasi muncul di rekap dapur.

## P2 — Kalau Masih Ada Waktu
- [ ] `/cek-reservasi`
- [ ] `/admin/pengaturan`
- [ ] Dialog **Ubah Jadwal** di detail reservasi
- [ ] Langkah 1: tampilkan blok jam yang terisi (`/api/availability/day`) setelah ruangan diketahui
- [ ] 1 tes Playwright untuk happy path customer (pakai `PAYMENT_GATEWAY=fake`)

## ✅ Definition of Done Hari 3 (= MVP)
- [ ] Semua P0 dan P1 selesai, dan smoke test produksi lulus
- [ ] Semua halaman customer nyaman dipakai di lebar 375px
- [ ] `lint`/`typecheck`/`test` hijau. Tidak ada `console.log`, tidak ada secret di repo
- [ ] Commit: `feat: frontend customer dan admin` + `chore: deploy vercel`
- [ ] Siap demo ke mitra. Bawa **daftar pertanyaan mitra** dari KEPUTUSAN.md bagian F
