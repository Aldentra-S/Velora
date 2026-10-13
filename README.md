# Velora — AI Personal Finance Web Application

Aplikasi web personal finance modern berbasis AI yang dirancang untuk portofolio pribadi dan sekolah dengan target biaya operasional **Rp0**.

---

## 🏗️ Arsitektur Monorepo

Proyek ini dibangun menggunakan **npm workspaces** dengan pemisahan aplikasi yang bersih:

* **Frontend (`apps/frontend`)**: React 19, Vite, TypeScript, Vanilla CSS (Design System).
* **Backend (`apps/backend`)**: Node.js, Express, TypeScript, Zod (Validasi input).
* **Database (Fase 2)**: PostgreSQL (Neon / Supabase Serverless Free Tier) + Prisma ORM.
* **AI Engine (Fase 5)**: Google Gemini Flash Free Tier API (dengan fallback deterministik lokal).

---

## 📋 Prasyarat Sistem

* **Node.js**: v20+ (Direkomendasikan v24.x LTS/Current)
* **npm**: v10+ (Direkomendasikan v11.x)
* **Git**: v2.x

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Instalasi Dependensi
Jalankan instalasi dari root direktori proyek:
```bash
npm install
```

### 2. Menjalankan Aplikasi

#### Menjalankan Keduanya Secara Bersamaan (Multi-Terminal)
* **Terminal 1 — Backend (Port 5000):**
  ```bash
  npm run dev:backend
  ```
* **Terminal 2 — Frontend (Port 5173):**
  ```bash
  npm run dev:frontend
  ```

#### Menjalankan Secara Terpisah dari Subdirektori
* **Backend saja:**
  ```bash
  cd apps/backend
  npm run dev
  ```
* **Frontend saja:**
  ```bash
  cd apps/frontend
  npm run dev
  ```

### 3. Build & Pemeriksaan Tipe (Typecheck)
* **Typecheck semua workspace:**
  ```bash
  npm run typecheck
  ```
* **Build produksi semua workspace:**
  ```bash
  npm run build
  ```

---

## 🔍 Endpoint Health Check

Backend menyediakan endpoint diagnostik:
* **URL**: `GET http://localhost:5000/api/health`
* **Response Contoh**:
  ```json
  {
    "status": "ok",
    "service": "velora-backend",
    "version": "0.1.0",
    "timestamp": "2026-10-09T08:58:00.000Z",
    "uptime": 1.25
  }
  ```

---

## 🔒 Kebijakan Keamanan & Biaya Rp0
1. **Zero Secret Leak**: Semua kredensial dan file `.env` diabaikan oleh `.gitignore`.
2. **Rp0 Cost Target**: Mengandalkan Free Tier terverifikasi (Vercel, Render/Koyeb, Neon/Supabase, Google AI Studio).
3. **Core Independence**: Logika keuangan tidak bergantung pada API berbayar.
