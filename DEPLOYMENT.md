# Panduan Deployment & Operasional Velora (Fase 14)

Dokumen ini memuat panduan lengkap konfigurasi lingkungan, instalasi, build, backup/restore basis data, serta opsi hosting gratis (Rp0) untuk aplikasi manajemen keuangan **Velora**.

---

## 1. Prasyarat Sistem

- **Node.js**: Versi `>= 20.x`
- **npm**: Versi `>= 10.x`
- **PostgreSQL**: Versi `>= 15.x` (Lokal atau Cloud Database gratis)
- **OS**: Linux, macOS, atau Windows

---

## 2. Instalasi & Konfigurasi Lokal

### A. Kloning Repositori & Instal Dependensi

```bash
# Instal seluruh dependensi monorepo
npm install
```

### B. Konfigurasi Environment Variables

Salin file `.env.example` ke file `.env` di masing-masing sub-proyek:

1. **Backend (`apps/backend/.env`)**:

   ```env
   PORT=5000
   NODE_ENV=production
   FRONTEND_URL=http://localhost:5173
   DATABASE_URL="postgresql://postgres:password_anda@localhost:5432/velora_dev?schema=public"
   JWT_ACCESS_SECRET="ganti_dengan_random_string_minimal_32_karakter"
   JWT_REFRESH_SECRET="ganti_dengan_random_string_minimal_32_karakter"
   JWT_ACCESS_EXPIRES_IN="15m"
   JWT_REFRESH_EXPIRES_IN="7d"
   ```

2. **Frontend (`apps/frontend/.env`)**:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

> [!CAUTION]
> Jangan pernah melakukan commit file `.env` ke Git. Pastikan `.gitignore` tetap mencakup `.env` dan rahasia lainnya.

### C. Menjalankan Database Migration

Jalankan perintah berikut untuk menerapkan skema basis data secara aman tanpa me-reset data:

```bash
# Generate Prisma Client
npm run prisma:generate --workspace=@velora/backend

# Deploy migration ke basis data
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
```

---

## 3. Build & Menjalankan Aplikasi

### A. Verifikasi Tipe & Kompilasi Produksi

```bash
# Typecheck seluruh workspace
npm run typecheck --workspaces

# Build backend & frontend
npm run build --workspaces
```

### B. Menjalankan Server Produksi

```bash
# Menjalankan backend
npm run start --workspace=@velora/backend

# Menjalankan frontend preview / serving dist
npm run preview --workspace=@velora/frontend
```

---

## 4. Cadangan (Backup) & Pemulihan (Restore) PostgreSQL

### A. Backup Basis Data

Gunakan `pg_dump` native bawaan PostgreSQL:

```bash
# Backup ke file SQL terkompresi
pg_dump -U postgres -h localhost -p 5432 -d velora_dev -F c -b -v -f velora_backup_$(date +%Y%m%d).dump
```

### B. Restore Basis Data

Gunakan `pg_restore` untuk mengembalikan cadangan ke database target:

```bash
# Pulihkan database dari file dump
pg_restore -U postgres -h localhost -p 5432 -d velora_dev -v velora_backup_20261012.dump
```

---

## 5. Otomasi Transaksi Rutin (Scheduler)

Engine transaksi rutin Velora dirancang **atomik dan idempoten** pada endpoint:

```http
POST /api/recurring-transactions/process-due
# Alias yang juga didukung:
POST /api/recurring-transactions/process
POST /api/recurring/process
```

Untuk menjalankan transaksi rutin harian secara otomatis tanpa dependensi background worker berbayar:

1. **Cron OS / Linux Crontab (Lokal / VPS)**:
   Tambahkan baris berikut pada crontab (`crontab -e`):
   ```cron
   5 0 * * * curl -s -X POST http://localhost:5000/api/recurring-transactions/process-due > /dev/null
   ```
2. **GitHub Actions Scheduled Workflow (Rp0)**:
   Buat workflow terjadwal harian (`.github/workflows/recurring.yml`) yang memicu endpoint backend menggunakan curl.
3. **Layanan Ping Gratis (Rp0)**:
   Gunakan layanan seperti _cron-job.org_ untuk melakukan HTTP POST terjadwal ke endpoint tersebut.

---

## 6. Opsi Hosting Gratis (Rp0) yang Realistis

Untuk men-deploy Velora secara online tanpa biaya:

| Komponen     | Opsi Penyedia Gratis                 | Batasan & Kuota                                                                                                                                                |
| :----------- | :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database** | **Supabase** atau **Neon**           | Kuota 500 MB storage, paused jika inaktif 7 hari (Neon) atau 1 minggu (Supabase). Cukup untuk penggunaan pribadi.                                              |
| **Backend**  | **Render** atau **Railway Trial**    | Render Free Web Service memiliki jeda _cold start_ (tidur setelah 15 menit inaktif, butuh 30–50 detik untuk bangun saat request pertama). Kuota 750 jam/bulan. |
| **Frontend** | **Vercel** atau **Cloudflare Pages** | Gratis, cepat, CDN global, integrasi Git otomatis tanpa batasan waktu tidur.                                                                                   |

---

## 7. Audit Keamanan & Kesiapan Rilis

- [x] Autentikasi menggunakan cookie `HttpOnly`, `SameSite=Lax`, dan header CSRF ganda.
- [x] Password pengguna dienkripsi menggunakan Bcrypt Salted Hash.
- [x] In-Memory Rate Limiter aktif pada endpoint autentikasi (`/api/auth/login`, `/api/auth/register`).
- [x] Seluruh kueri keuangan dan notifikasi diisolasi per pengguna (`userId`).
- [x] Seluruh mutasi saldo dompet menggunakan Prisma Decimal dan transaksi atomik database (`prisma.$transaction`).
- [x] Sanitasi CSV Formula Injection aktif (`sanitizeCsvCell`) pada modul ekspor laporan keuangan.
- [x] Tidak ada kredensial atau rahasia yang dibocorkan ke log server.
