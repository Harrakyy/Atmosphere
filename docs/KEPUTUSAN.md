# File Keputusan — Sistem Reservasi Ruangan & Pre-Order Atmosphere Cafe

Dokumen ini mencatat **apa yang diputuskan, kenapa, dan alternatif apa yang ditolak**. Kalau ada keputusan yang berubah, jangan hapus: tandai `~~dicoret~~` lalu tulis revisinya, supaya alasan perubahannya tetap terbaca (berguna untuk laporan capstone dan pertanyaan dosen).

**Status:**
- ✅ Disepakati tim
- 🟡 Usulan teknis, disusun saat menulis PRD. Masih perlu di-review.
- ❓ Masih menunggu konfirmasi mitra. Sementara pakai nilai asumsi.

Terakhir diperbarui: 10 Oktober 2026

---

## A. Bisnis & Alur

### K-01 ✅ Ruangan gratis, syaratnya pre-order minimal 1 makanan + 1 minuman
- Syarat berlaku **per reservasi**. "Makanan" dan "minuman" ditentukan oleh **jenis kategori** (lihat K-12), bukan dari nama produk.
- **Alasan:** permintaan mitra. Pendapatan cafe datang dari menu, bukan dari sewa ruangan.
- **Ditolak:** sewa ruangan per jam (seperti di desain awal, Rp150rb/jam) dan minimal belanja nominal tertentu.
- **Risiko:** satu orang bisa memesan ruangan besar cukup dengan 2 item. Ini dimitigasi oleh K-19.

### K-02 ✅ Web hanya untuk pre-order
- Pesanan tambahan saat tamu sudah di lokasi dilakukan langsung lewat kasir, **di luar sistem ini**.
- **Alasan:** sistem POS cafe sudah ada, dan proposal Bab 3.1 mengeluarkan POS dari scope.

### K-03 ✅ Pembayaran lunas di depan (tanpa DP)
- **Alasan:** lebih sederhana. Booking palsu atau iseng juga tersaring otomatis karena harus bayar dulu.
- **Ditolak:** DP + pelunasan (muncul di Tabel 1 proposal), karena butuh dua transaksi dan penagihan sisa.

### K-04 ✅ Maintenance yang sudah direncanakan memakai "Blokir Jadwal"
- Admin membuat blokir per ruangan dengan rentang tanggal (tanggal akhir boleh dikosongkan, artinya belum tahu kapan selesai). Selama periode itu ruangan tidak bisa dipesan.
- Saat blokir disimpan, sistem **menampilkan reservasi yang bentrok** supaya admin langsung menindaklanjuti (K-05).
- **Alasan:** owner biasanya tahu jauh hari kalau ruangan akan direnovasi. Pertanyaan dosen ("ruangan maintenance padahal sudah ada yang booking") dijawab di sini dan di K-05.
- **Ditolak:** tombol aktif/nonaktif ruangan secara permanen, karena tidak menangani tamu yang sudah terlanjur booking.

### K-05 ✅ Maintenance mendadak: batal + refund penuh
- Admin membatalkan reservasi dengan alasan "dari cafe". Refund = **seluruh jumlah yang dibayar customer**.
- Ada tombol **WA bertemplate** (`wa.me/<nomor tamu>`) berisi nama tamu, kode reservasi, jadwal, total, dan permintaan data rekening.
- Refund ditransfer manual. Statusnya dicatat: `Refund Diproses → Refund Selesai`.
- **Alasan:** pembatalan ini kesalahan pihak cafe, jadi customer tidak boleh rugi.
- **Ditolak:** refund lewat API Midtrans (lebih rumit, dan jumlah kasusnya sangat sedikit).

### K-06 ✅ E-tiket dibagikan lewat WhatsApp memakai link, bukan gambar
- `wa.me` hanya bisa mengirim teks. Karena itu QR ditampilkan di **halaman e-tiket**, lalu link halamannya yang dikirim lewat WA.
- Ada dua tombol: **"Simpan ke WhatsApp"** (`wa.me/?text=`, customer memilih chat ke diri sendiri) dan **"Hubungi Cafe"** (`wa.me/<nomor cafe>`). Tombol **Unduh QR** juga disediakan.
- **Ditolak:** WhatsApp API berbayar (Fonnte, Wablas, Cloud API) untuk mengirim gambar otomatis.

### K-10 ✅ Batal atau ganti jadwal atas permintaan customer: lewat WA, diproses admin
- Customer tidak bisa membatalkan sendiri di web. Admin yang memproses, mengikuti kebijakan mitra ❓ (asumsi: reschedule gratis 1x paling lambat H-1; batal ≥H-2 refund penuh, H-1 refund 50%, hari-H tidak ada refund).
- Nominal refund diisi manual oleh admin, jadi tidak ada perhitungan otomatis.
- **Ditolak:** fitur batal/reschedule mandiri di web. Pekerjaannya banyak, padahal hanya ada 10–15 pesanan per bulan.

### K-18 ✅ Customer tidak perlu akun (guest checkout)
- Data pemesan: nama, nomor WA, email (opsional). Booking diakses lewat link e-tiket, atau lewat halaman **Cek Reservasi** (kode booking + nomor WA).
- **Alasan:** pesanan rombongan jarang berulang. Booking palsu sudah tersaring oleh K-03.
- **Ditolak:** verifikasi OTP lewat WA (butuh API berbayar) dan login Google opsional (tidak sepadan dengan pekerjaannya).

### K-19 ❓ Ada minimal jumlah tamu per ruangan
- Setiap ruangan punya `minTamu` dan `maxTamu` yang diatur admin.
- **Alasan:** inilah yang benar-benar menyelesaikan masalah "ruangan terisi 2–3 orang" (Tabel 1 proposal), karena K-01 sendiri tidak cukup.
- Angkanya perlu dikonfirmasi mitra. Nilai asumsi ada di seed.

### K-20 🟡 Urutan langkah customer
1. Tanggal, jam, dan jumlah tamu
2. Pilih ruangan (hanya yang kosong dan muat)
3. Pre-order menu
4. Data pemesan, ringkasan, dan bayar
5. E-tiket

- **Alasan:** customer tidak perlu memilih ruangan dulu lalu baru tahu ruangannya penuh. Data pemesan diisi sekali saja, di langkah checkout.
- **Ditolak:** urutan di desain awal (pilih ruangan dulu, lalu tanggal).

### K-11 ✅ Hanya ada satu role: Admin
- Boleh ada lebih dari satu akun admin (misalnya owner dan kasir) supaya log mencatat siapa melakukan apa. Hak aksesnya sama persis.
- Akun admin dibuat lewat script seed. **Tidak ada halaman daftar.**
- Kasir juga login sebagai admin untuk check-in.

---

## B. Menu & Harga

### K-12 ✅ Setiap kategori punya "Jenis" (FOOD / DRINK)
- Kategori dipakai untuk tampilan dan filter. Jenis dipakai untuk aturan K-01.
- Kategori yang dipakai: Makanan → FOOD, Snack → FOOD, Minuman → DRINK, Ice Cream → FOOD ❓.
- Jenis **Paket ditunda**, karena menu mitra saat ini tidak punya produk paket.

### K-13 ✅ Produk bisa punya "Pilihan" (wajib pilih satu, harga sama)
- Contoh: Hot/Ice, pilihan saos, rasa es krim. Produk yang sama dengan pilihan berbeda menjadi baris terpisah di keranjang, sehingga rekap dapur bisa menghitung *"Jeruk: 10 Ice, 10 Hot"*.
- **Ditolak:** catatan teks bebas (rekap tidak bisa dihitung otomatis) dan varian dengan harga berbeda (data mitra tidak membutuhkannya).

### K-14 ✅ Data menu awal diambil dari CSV mitra
- 80 item sudah dirapikan di [`data/menu-awal.csv`](data/menu-awal.csv): pilihan dipisahkan dari nama, typo diperbaiki, harga diubah menjadi angka bulat.
- Kolom `catatan_perapian` mencatat setiap perubahan dari data aslinya.

### K-07 / K-08 ✅ Payment gateway: Midtrans Snap (sandbox)
- Integrasi dibungkus dalam interface `PaymentGateway` supaya provider bisa diganti (misalnya iPaymu atau Xendit) tanpa mengubah logika reservasi.
- **Ditolak:** upload bukti transfer + verifikasi admin, karena konfirmasi jadi bergantung pada admin yang online. Itu masalah yang sama dengan kondisi sekarang (Tabel 1 proposal).

### ~~K-09 Biaya admin Midtrans ditanggung customer sebagai baris biaya terpisah~~ → **K-09 (revisi) ✅ Biaya dimasukkan ke harga online lewat markup**
- **Alasan revisi:** Pasal 52 ayat (1) PBI 23/6/PBI/2021 melarang merchant membebankan *surcharge* atas biaya dari penyedia jasa pembayaran (QRIS, VA, dan lainnya). Menaikkan harga produk itu keputusan harga, bukan surcharge (sama seperti harga GoFood yang berbeda dari harga di toko).
- Tidak ada baris "biaya layanan" di checkout.

### K-15 ✅ Markup 3%, dibulatkan ke atas ke kelipatan Rp500
- `hargaOnline = ceil(hargaKasir × 1,03 / 500) × 500`. Persen markup dan satuan pembulatan disimpan di Pengaturan.
- **Alasan:** hasil simulasi dengan 80 menu asli. Markup efektif per item 3,3–10% (rata-rata 4,7%), dan sudah cukup menutup biaya QRIS dan e-wallet di semua skenario.
- **Ditolak:** 10%. Rombongan 20 orang akan membayar sekitar Rp100rb lebih mahal, padahal biaya Midtrans hanya sekitar Rp6rb. Ini bisa mendorong customer kembali memesan lewat WA.

### K-16 ✅ Metode pembayaran yang ditampilkan di Snap
- QRIS + e-wallet: selalu tampil.
- VA bank: hanya tampil kalau total ≥ **Rp150.000** (batasnya diatur di Pengaturan).
- Kartu kredit, Indomaret/Alfamart, dan paylater: dimatikan.
- **Alasan:** biaya VA itu nominal tetap (±Rp4.440 termasuk PPN), sehingga pesanan kecil merugi berapa pun persen markupnya. Kartu kredit biayanya paling mahal.

---

## C. Aturan Waktu

### K-17 ✅ Aturan waktu (nilai awal, semuanya bisa diubah di Pengaturan)

| Aturan | Nilai |
|---|---|
| Zona waktu | Asia/Jakarta (WIB, UTC+7, tanpa DST) |
| Jam operasional | **10.00–22.00** ❓ (asumsi) |
| Durasi booking | 60–240 menit, kelipatan 30 menit |
| Jeda antar booking (buffer) | 30 menit |
| Batas paling lambat pesan | H-1 pukul 21.00 WIB |
| Batas paling jauh pesan | 30 hari ke depan |
| Waktu tahan slot | 17 menit |
| Kedaluwarsa pembayaran Midtrans | 15 menit (sengaja lebih pendek dari waktu tahan slot) |
| Waktu penyajian | Saat datang / 30 menit setelah datang / jam tertentu |

---

## D. Proyek & Teknis

### K-21 ✅ Target MVP 3 hari, dikerjakan sendiri bersama Claude Code
- PRD harian ditulis sebagai instruksi kerja yang bisa langsung dieksekusi. Lihat [`prd/`](prd/).

### K-22 ✅ Urutan: backend penuh dulu, baru frontend
- Hari 1–2 backend (dengan tes otomatis), hari 3 frontend dan deploy.
- **Konsekuensi yang diterima:** demo ke mitra baru bisa dilakukan setelah hari 3.

### K-23 ✅ Stack
| Bagian | Pilihan |
|---|---|
| Framework | Next.js (App Router, versi stabil terbaru) + TypeScript strict |
| Database | PostgreSQL 16 (Docker di lokal) |
| ORM | Prisma |
| Validasi | Zod |
| Auth admin | Better Auth (email + password, sign-up publik dimatikan) |
| Styling | Tailwind CSS (desain sudah memakai Tailwind) |
| Tes | Vitest (unit + integrasi ke Postgres) |
| Penyimpanan foto | Vercel Blob |

### K-24 ✅ Deploy: Vercel + Postgres cloud
- Postgres produksi memakai **Neon** (tersedia lewat Vercel Marketplace). Neon mendukung ekstensi `btree_gist` yang dibutuhkan K-25.
- Foto disimpan di **Vercel Blob**, karena filesystem Vercel tidak permanen.

### K-25 🟡 Anti booking ganda dijaga di level database
- PostgreSQL **exclusion constraint** (`btree_gist` + `tstzrange`) menolak dua reservasi aktif yang jamnya bertumpuk (termasuk buffer) di ruangan yang sama.
- Ditambah **row lock** pada baris ruangan (`SELECT … FOR UPDATE`) saat membuat reservasi atau blokir, supaya pengecekan blokir juga tidak bisa didahului proses lain.
- **Alasan:** walaupun ada bug di kode aplikasi, atau dua orang menekan "Bayar" di detik yang sama, database tetap menolak. Ini argumen yang kuat untuk dosen.

### K-26 🟡 Slot kedaluwarsa dibersihkan saat dibutuhkan (lazy expiry), tidak bergantung pada cron
- Sebelum membuat reservasi, reservasi `PENDING_PAYMENT` yang waktu tahannya sudah lewat diubah menjadi `EXPIRED` di dalam transaksi yang sama. Query ketersediaan juga menganggap slot itu kosong.
- **Alasan:** cron di paket gratis Vercel terbatas. Dengan cara ini sistem tetap benar walaupun cron tidak berjalan.

### K-27 🟡 QR e-tiket berisi URL check-in admin
- Isi QR: `https://<domain>/admin/check-in/<KODE>`. Kasir cukup memindai dengan **kamera HP biasa**, halaman admin terbuka, lalu tekan **Check-in**.
- **Alasan:** tidak perlu membuat pemindai QR di dalam aplikasi.

### K-28 🟡 Link e-tiket memakai token acak, terpisah dari kode booking
- Kode untuk dibaca manusia: `ATM-7K2F9Q` (6 karakter, tanpa 0/O/1/I/L). Link e-tiket: `/tiket/<token 32 karakter>`.
- **Alasan:** kode yang pendek bisa ditebak. Token yang panjang tidak.

### K-29 🟡 MVP tidak mengirim email
- Kolom email opsional dan hanya diteruskan ke Midtrans (Midtrans bisa mengirim instruksi pembayaran ke email tersebut). Konfirmasi ke customer lewat halaman e-tiket dan WA (K-06).

### K-30 🟡 Status "Lunas" hanya ditentukan oleh webhook
- Webhook dari Midtrans → verifikasi signature → **cek ulang ke API Status Midtrans** → baru status berubah. Prosesnya aman kalau webhook datang berulang (idempoten).
- Halaman "terima kasih" dari Snap tidak pernah dipakai untuk mengubah status.

### K-31 🟡 Konvensi data
- Uang disimpan sebagai **integer rupiah** (`Int`), tidak pernah memakai float.
- Waktu disimpan sebagai `timestamptz` (UTC). Semua aturan bisnis dihitung dalam WIB.
- Harga, nama produk, dan pilihan **disalin (snapshot)** ke item reservasi saat checkout.

---

## E. Di Luar Scope MVP
- Akun customer, OTP, login Google
- Pengiriman email
- Batal/reschedule mandiri oleh customer
- Refund lewat API gateway
- Varian dengan harga berbeda, produk paket, stok harian
- Kalender visual admin (MVP memakai daftar per tanggal)
- Laporan/statistik
- Halaman kelola akun admin (akun dibuat lewat seed)
- Integrasi POS, akuntansi, payroll (proposal Bab 3.1)

---

## F. 📋 Pertanyaan untuk Mitra

| # | Pertanyaan | Nilai asumsi sementara | Terkait |
|---|---|---|---|
| 1 | Jam operasional cafe? | 10.00–22.00 | K-17 |
| 2 | Kebijakan batal/reschedule oleh customer? | Reschedule 1x ≤H-1; batal ≥H-2 refund penuh, H-1 50%, hari-H 0% | K-10 |
| 3 | Apakah harga kasir sudah termasuk pajak restoran (PB1) 10%? | Sudah termasuk | K-15 |
| 4 | Apakah ada paket rombongan / nasi box di luar daftar menu? | Tidak ada | K-12 |
| 5 | Apakah Snack & Ice Cream dihitung sebagai "makanan" untuk syarat 1+1? | Ya | K-01, K-12 |
| 6 | Minimal dan maksimal tamu per ruangan? Nama dan foto ruangan asli? | Lihat seed ruangan di PRD | K-19 |
| 7 | Foto produk + konfirmasi nama/typo (lihat `catatan_perapian` di CSV) | Placeholder | K-14 |
| 8 | Nomor WhatsApp cafe untuk tombol "Hubungi Cafe"? | Diisi di Pengaturan | K-06 |
| 9 | Apakah mitra setuju harga online 3% lebih tinggi dari harga kasir? | Setuju | K-15 |
