# File Keputusan — Sistem Reservasi Ruangan & Pre-Order Atmosphere Cafe

Dokumen ini mencatat **apa yang diputuskan, kenapa, dan alternatif apa yang ditolak**. Kalau ada keputusan yang berubah, jangan hapus: tandai `~~dicoret~~` lalu tulis revisinya, supaya alasan perubahannya tetap terbaca (berguna untuk laporan capstone dan pertanyaan dosen).

**Status:**
- ✅ Disepakati tim
- 🟡 Usulan teknis, disusun saat menulis PRD. Masih perlu di-review.
- ❓ Masih menunggu konfirmasi mitra. Sementara pakai nilai asumsi.

Terakhir diperbarui: 11 Oktober 2026

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
- `wa.me` hanya bisa mengirim teks. Karena itu kode booking ditampilkan di **halaman e-tiket**, lalu link halamannya yang dikirim lewat WA.
- Ada dua tombol: **"Simpan ke WhatsApp"** (`wa.me/?text=`, customer memilih chat ke diri sendiri) dan **"Hubungi Cafe"** (`wa.me/<nomor cafe>`). Tombol **Unduh Kode** (kartu PNG) juga disediakan.
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

### ~~K-07 / K-08 Payment gateway: Midtrans Snap (sandbox)~~ → digantikan K-32 (30 Okt 2026)
- Integrasi dibungkus dalam interface `PaymentGateway` supaya provider bisa diganti (misalnya iPaymu atau Xendit) tanpa mengubah logika reservasi.
- **Ditolak:** upload bukti transfer + verifikasi admin, karena konfirmasi jadi bergantung pada admin yang online. Itu masalah yang sama dengan kondisi sekarang (Tabel 1 proposal).

### ~~K-09 Biaya admin Midtrans ditanggung customer sebagai baris biaya terpisah~~ → **K-09 (revisi) ✅ Biaya dimasukkan ke harga online lewat markup**
- **Alasan revisi:** Pasal 52 ayat (1) PBI 23/6/PBI/2021 melarang merchant membebankan *surcharge* atas biaya dari penyedia jasa pembayaran (QRIS, VA, dan lainnya). Menaikkan harga produk itu keputusan harga, bukan surcharge (sama seperti harga GoFood yang berbeda dari harga di toko).
- Tidak ada baris "biaya layanan" di checkout.

### ~~K-15 Markup 3%, dibulatkan ke atas ke kelipatan Rp500~~ → digantikan K-36 (markup 0%)
- `hargaOnline = ceil(hargaKasir × 1,03 / 500) × 500`. Persen markup dan satuan pembulatan disimpan di Pengaturan.
- **Alasan:** hasil simulasi dengan 80 menu asli. Markup efektif per item 3,3–10% (rata-rata 4,7%), dan sudah cukup menutup biaya QRIS dan e-wallet di semua skenario.
- **Ditolak:** 10%. Rombongan 20 orang akan membayar sekitar Rp100rb lebih mahal, padahal biaya Midtrans hanya sekitar Rp6rb. Ini bisa mendorong customer kembali memesan lewat WA.

### ~~K-16 Metode pembayaran yang ditampilkan di Snap~~ → gugur bersama Midtrans (K-32)
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

### ~~K-27 QR e-tiket berisi URL check-in admin~~ → **K-27 (revisi) ✅ Check-in dengan kode booking 4 karakter, tanpa QR**
- Kode: 4 karakter dari `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, minimal 1 huruf dan 1 angka (contoh `7K2F`). Customer menyimpannya sebagai kartu PNG lewat tombol **Unduh Kode**. Kasir mengetik kode di kotak **Check-in** pada dashboard admin.
- **Alasan revisi:** kode pendek lebih mudah dibacakan lewat WA dan diketik kasir; tidak perlu pemindai atau kamera.
- **Konsekuensi:** kode 4 karakter bisa ditebak, jadi pencarian di Cek Reservasi dibatasi 10 percobaan per 15 menit per IP. `order_id` Midtrans diberi sufiks acak supaya tetap unik (lihat R-I3).

### K-28 🟡 Link e-tiket memakai token acak, terpisah dari kode booking
- Kode untuk dibaca manusia: `7K2F` (4 karakter, tanpa 0/O/1/I/L; kode lama berformat `ATM-7K2F9Q` tetap valid). Link e-tiket: `/tiket/<token 32 karakter>`.
- **Alasan:** kode yang pendek bisa ditebak. Token yang panjang tidak.

### K-29 🟡 MVP tidak mengirim email
- Kolom email opsional dan hanya diteruskan ke Midtrans (Midtrans bisa mengirim instruksi pembayaran ke email tersebut). Konfirmasi ke customer lewat halaman e-tiket dan WA (K-06).

### ~~K-30 Status "Lunas" hanya ditentukan oleh webhook~~ → digantikan K-34
- Webhook dari Midtrans → verifikasi signature → **cek ulang ke API Status Midtrans** → baru status berubah. Prosesnya aman kalau webhook datang berulang (idempoten).
- Halaman "terima kasih" dari Snap tidak pernah dipakai untuk mengubah status.

### K-31 🟡 Konvensi data
- Uang disimpan sebagai **integer rupiah** (`Int`), tidak pernah memakai float.
- Waktu disimpan sebagai `timestamptz` (UTC). Semua aturan bisnis dihitung dalam WIB.
- Harga, nama produk, dan pilihan **disalin (snapshot)** ke item reservasi saat checkout.

---

## D2. Pembayaran QRIS (30 Okt 2026)

### K-32 ✅ Midtrans diganti QRIS statis yang dibuat dinamis
- Teks QRIS (EMVCo) milik merchant diubah: tag `01` → `12`, tag `54` (nominal) disisipkan, CRC dihitung ulang. Customer cukup scan, nominalnya sudah terisi.
- **Alasan:** Midtrans produksi mewajibkan mitra mendaftar merchant dengan dokumen usaha. QRIS DANA mitra (kategori UMI) sudah ada, dan biayanya hampir nol.
- **Ditolak:** tetap memakai Midtrans, atau menyimpan Midtrans sebagai pilihan kedua (dua alur pembayaran yang harus dirawat). Kode Midtrans masih tersimpan di riwayat git.
- **Risiko:** format dinamis hasil modifikasi tidak resmi, sehingga harus diuji di setiap e-wallet utama.

### K-33 ✅ Nominal unik berupa potongan, bukan tambahan
- `bayar = total − k`, dengan k angka terkecil yang sedang tidak dipakai (1–999). Dengan volume pesanan mitra, potongannya biasanya hanya Rp1–5.
- **Alasan:** pembayaran bisa dicocokkan dari nominalnya saja. Kalau berupa tambahan, itu sama dengan surcharge (K-09).

### K-34 ✅ Fase 1: konfirmasi manual oleh admin
- Customer menekan "Saya sudah bayar" → waktu tahan slot diperpanjang → admin mengecek DANA → **Tandai Lunas** / **Tolak**.
- Refund dihitung dari nominal yang benar-benar dibayar (`payAmount`).

### K-35 ✅ Fase 2: aplikasi Android pembaca notifikasi DANA
- `NotificationListenerService` (Kotlin), hanya membaca notifikasi dari package DANA. Data dikirim ke server dengan token perangkat + HMAC + timestamp.
- APK dibagikan lewat **GitHub Releases** (bukan Play Store). Keystore penandatangan wajib disimpan aman.

### K-36 ✅ Markup harga online 0%
- Biaya QRIS UMI ke DANA sangat kecil. Pengaturan markup tetap ada kalau nanti dibutuhkan.

### K-37 ✅ QRIS diganti lewat Pengaturan admin
- Admin upload gambar QRIS → QR dibaca di browser → server memvalidasi (CRC, statis, ada nama merchant) → disimpan sebagai teks.
- ❓ QRIS yang dipakai saat pengembangan milik merchant lain. Sebelum dipakai sungguhan, wajib diganti dengan QRIS mitra.

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

## D3. Fase 2: HP Kasir melaporkan pembayaran (1 Nov 2026)

### K-38 ✅ Reservasi langsung Lunas otomatis saat nominal cocok
- SetorPantau mengirim notif DANA "Pembayaran Masuk" → server mencari reservasi menunggu bayar dengan nominal unik yang sama (R-Q3) → `markPaid` (fungsi yang sama dengan tombol Tandai Lunas).
- Nominal tanpa pesanan masuk kartu **"Pembayaran tanpa pesanan"** di Beranda admin; bayar terlambat memakai aturan lama (batal + refund penuh bila slot sudah diambil).

### K-39 ✅ Pairing dengan kode 8 karakter + token per HP (bukan HMAC)
- Admin → Pengaturan → "Hubungkan HP kasir" membuat kode sekali pakai (10 menit). HP menukarnya dengan token 32 byte. Kode dan token hanya disimpan sebagai **sha256**.
- **Ditolak:** tanda tangan HMAC. HMAC mengharuskan server menyimpan kunci asli, sedangkan HTTPS sudah melindungi isi pesan di jalan. Token ber-hash lebih aman kalau database bocor.
- Anti-replay: setiap notif diproses sekali per HP (`deviceId + notifId` unik), dan pembayaran hanya bisa cocok dengan reservasi yang **dibuat sebelum** notif muncul.
- Akses HP bisa dicabut kapan saja; HP yang dicabut ditolak (401) dan SetorPantau memutus koneksinya sendiri.

### K-40 ✅ Pengiriman dari SetorPantau
- Dikirim saat aplikasi berjalan (terbuka / latar belakang); offline → antri, dicoba ulang otomatis.
- Hanya transaksi sejak 1 jam sebelum pairing yang dikirim, supaya riwayat lama tidak membanjiri admin.
- ❓ Batasan: kalau aplikasi ditutup paksa, notif tetap tersimpan tapi baru terkirim saat aplikasi dibuka lagi. Mengirim langsung dari service native butuh kode Kotlin sendiri (tahap berikutnya kalau dibutuhkan).

## D4. Protokol Setor (1 Nov 2026)

### K-41 ✅ Kode unik DITAMBAHKAN, nominal bayar di jalur 100–499 → merevisi K-33
- App pembaca notifikasi sekarang **Setor** (umum untuk beberapa usaha, satu DANA). Tiap usaha punya jalur 3 digit terakhir nominal: tab.booth 001–099, **Atmosphere 100–499**, Kosinyuk 500–999 ([Protokol Setor](https://github.com/Harrakyy/Setor/blob/main/docs/PROTOKOL-SETOR.md)).
- `bayar = total + k`, k terkecil (1–999) yang membuat 3 digit akhir 100–499 dan belum dipakai. Contoh Rp84.000 → Rp84.100; Rp30.500 → Rp31.100.
- **Alasan revisi K-33:** dengan potongan, total bulat ribuan butuh potongan Rp501–900 per pesanan. Diputuskan pemilik usaha: kode unik ditambah, seperti "kode unik transfer" yang umum dipakai toko.
- ⚠️ **Risiko yang diterima:** kode unik tambahan bisa dianggap biaya tambahan ke customer (lihat K-09, larangan surcharge PBI 23/6/PBI/2021). Argumennya: kode unik bukan pembebanan MDR/biaya PJP, nilainya kecil, dan ditampilkan transparan sebagai "Kode unik (pencocok pembayaran)".
- Nominal yang baru lunas ≤24 jam juga tidak dipakai ulang, supaya pembayaran dobel tidak tertukar ke pesanan baru.

### K-42 ✅ Pembayaran kedua untuk booking yang sudah lunas ditampilkan ke admin
- Kemungkinan customer bayar dobel → hasil `unmatched` ke Setor (label "KODE · bayar dobel?") dan muncul di kartu **"Pembayaran perlu dicek"** supaya uangnya dikembalikan.

### K-43 ✅ Atmosphere mengikuti Protokol Setor
- Pairing mengembalikan `business` (`Atmosphere Cafe`, `cafe`) + `band` 100–499. Hasil uang masuk `matched` / `unmatched` / `duplicate` + `label` "KODE · nama pemesan".
- Implementasi paralel `05f7fe5` (tabel `Device`/`QrisNotification`) di-revert; dasar yang dipakai adalah implementasi yang sudah dimigrasi ke produksi (tabel `PaymentDevice`/`PairingCode`/`IncomingPayment`) dan teruji E2E dengan kode asli app Setor.
- Repo SetorPantau digantikan Setor (ID aplikasi sama, `com.harrakyy.setorpantau`, sehingga keduanya tidak bisa terpasang bersamaan).
