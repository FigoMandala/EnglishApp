# EnglishApp

Website belajar bahasa Inggris dengan akun per pengguna. Fondasi: autentikasi
(username + password) dan dashboard kosong. Modul belajar menyusul.

## Stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Backend | Server Actions & Server Components |
| Database | libSQL / SQLite via Drizzle ORM |
| UI | Tailwind CSS v4 + komponen lokal |
| Auth | Session cookie + hash password scrypt |

## Menjalankan

```bash
npm install
copy .env.example .env.local     # Windows
npm run db:push
npm run dev
```

Buka http://localhost:3000, lalu daftar akun lewat tab **Daftar**.

## Environment

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Lokasi database. Default `file:./data/app.db` |
| `DATABASE_AUTH_TOKEN` | Token libSQL, hanya untuk Turso |
| `SESSION_SECRET` | Kunci penandatangan/session, minimal 32 karakter |
| `AI_API_KEY` | Key AI default; key di halaman Pengaturan (admin) menimpanya |
| `APP_URL` | Diisi kalau produksi memakai HTTPS, agar cookie `secure` aktif |

## Script

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Build produksi |
| `npm start` | Jalankan hasil build (standalone) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm test` | Unit test (node:test) |
| `npm run e2e` | Uji alur auth lewat browser (butuh server jalan) |
| `npm run db:push` | Terapkan schema ke database |
| `npm run db:generate` | Buat file migrasi |
| `npm run db:seed` | Isi data contoh |

### Uji

```bash
npm test                 # unit test, tidak butuh server
npm run dev              # terminal lain
npm run e2e              # uji register/login/logout lewat browser
```

`npm run e2e` memakai Playwright dengan Microsoft Edge. Kalau port berbeda:

```bash
BASE_URL=http://127.0.0.1:3100 npm run e2e
```

Akun uji dibuat dengan awalan `uji` dan dihapus otomatis setelah uji selesai.

> **Jangan jalankan `npm run build` sambil `npm run dev` masih hidup.** Keduanya
> memakai folder `.next` yang sama, sehingga aset dev jadi 404 dan halaman
> berhenti ber-hydrate (tombol tidak merespons, pesan error tidak muncul).
> Kalau terlanjur: hentikan dev, hapus folder `.next`, lalu `npm run dev` lagi.

## Struktur

```
src/
  app/
    login/          halaman masuk & daftar (satu form, dua tab)
    (app)/          area terproteksi (guard di layout)
      dashboard/    halaman awal setelah masuk
  components/
    ui/             komponen dasar (button, card, field)
  db/
    schema.ts       tabel users & sessions
    index.ts        koneksi libSQL
    queries/auth.ts query user & sesi
  lib/
    password.ts     hash & verifikasi scrypt
    session.ts      cookie sesi & helper sesi
    validation.ts   validasi username & password
scripts/
  dev.mjs           pembungkus next dev
  e2e.mjs           uji alur auth
```

## Keamanan

- Password disimpan sebagai hash scrypt bersalt, dibandingkan dengan
  `timingSafeEqual`. Plaintext tidak pernah disimpan.
- Cookie sesi `httpOnly`, `sameSite=lax`, dan `secure` otomatis saat `APP_URL`
  memakai HTTPS.
- Sesi disimpan di database dengan masa berlaku 30 hari dan bisa dicabut
  (logout menghapus baris sesi).
- Semua route di bawah `(app)` dijaga `requireUser()` di layout.

## Produksi (Turso)

Development memakai file SQLite lokal (`.env.local`, skema lewat `db:push`). Produksi memakai
Turso dengan kredensial di `.env.production.local` (tidak ikut git), dan skema lewat **migrasi**
di folder `drizzle/`.

| Script | Fungsi |
| --- | --- |
| `npm run db:migrate:prod` | Terapkan migrasi ke database produksi |
| `npm run db:seed:prod` | Isi kosakata dan materi grammar (aman diulang) |
| `npm run db:admin:prod` | Buat admin; set `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dulu |

Kalau schema berubah:

```bash
npm run db:push            # database lokal
npm run db:generate        # buat file migrasi baru di drizzle/, commit file ini
npm run db:migrate:prod    # terapkan ke produksi
```

Di hosting, isi environment variable yang sama dengan `.env.production.local`:
`DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, `AI_API_KEY`, dan `APP_URL`.

## Soal TOEFL/EPrT

- Soal dibuat AI dengan seed topik dan skenario (`src/lib/question-variety.ts`): sekitar 800 subtopik
  dan sekitar 18.000 skenario Listening. Seed yang pernah dipakai tiap pengguna dicatat supaya
  tidak terulang.
- Soal disaring sebelum disajikan: yang persis sama atau mirip (Jaccard trigram >= 0,6) dengan
  riwayat pengguna, atau yang menyalin contoh resmi, dibuang.
- **Bank soal bersama** (`question_bank`): semua hasil AI disimpan dan dipakai ulang untuk pengguna
  yang belum pernah melihatnya (`question_seen`). 30% blok tetap dibuat baru supaya bank tidak basi.
- Batas 30 panggilan AI pembuat soal per pengguna per hari (`DAILY_AI_LIMIT`). Setelah batas
  tercapai, soal tetap bisa diambil dari bank.

## Writing Coach

- Halaman `/writing` untuk semua pengguna: tulis esai argumentatif 120-700 kata, lalu AI menilai
  (skor 0-100 per aspek: isi/relevansi, struktur, grammar, kosakata) plus daftar koreksi kalimat.
- Penilaian memakai `feature: "writing"` dan tercatat di `ai_usage` serta `activity_log`; hasil
  disimpan di tabel `writing_submissions` untuk riwayat dan tren.
- Penomoran soal Listening di simulasi EPrT dihitung ulang dari posisi yang disajikan
  (`renumber` di `src/lib/toefl.ts`), jadi nomor narator selalu cocok dengan nomor tampil.

## Menambah modul baru

1. Tambah tabel di `src/db/schema.ts`, lalu `npm run db:push`.
2. Tambah query di `src/db/queries/<nama-modul>.ts`.
3. Buat folder di `src/app/(app)/<nama-modul>/` berisi `page.tsx`,
   `actions.ts`, dan komponen form.
4. Tambah link di `src/components/app-shell.tsx` (`LINKS`).
