# Atmosphere

> Sistem Reservasi Ruangan & Pre-Order Menu — Atmosphere Cafe (MVP)

Aplikasi web pemesanan ruangan meeting dan pre-order menu makanan/minuman dengan pembayaran otomatis via Midtrans, e-tiket unik 4 karakter, serta panel admin dan antrean dapur terpadu.

## Tech Stack
- Next.js (App Router)
- React & TypeScript
- Prisma ORM & PostgreSQL
- Tailwind CSS
- Midtrans Snap Gateway
- Vitest

## Getting Started

1. **Instalasi dependensi:**
   ```bash
   npm install
   ```

2. **Konfigurasi environment:**
   Salin `.env.example` ke `.env` dan lengkapi konfigurasi database serta kredensial Midtrans.

3. **Jalankan migrasi dan seed database:**
   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```

4. **Jalankan server lokal:**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) pada browser.

## Pengujian

Jalankan seluruh rangkaian test suite:
```bash
npm test
```
