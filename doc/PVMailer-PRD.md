# Product Requirements Document (PRD)
# PVMailer — Aplikasi Mailer untuk Email Campaign

**Versi:** 1.0
**Tanggal:** 25 Agustus 2026
**Status:** Final Draft — siap untuk development

---

## 1. Ringkasan Produk

### 1.1 Apa itu PVMailer
PVMailer adalah aplikasi internal untuk mengirim **email campaign bertarget** (bukan newsletter/blasting berkelanjutan) ke daftar penerima yang diupload dari file Excel. Setiap campaign biasanya berisi **~200 penerima**, dikirim menggunakan **Resend** sebagai email service provider, dengan pencatatan status pengiriman yang akurat, kemampuan pause/resume, retry untuk yang gagal, dan tracking email dibuka (open tracking).

### 1.2 Masalah yang Diselesaikan
- Mengirim email personalisasi ke banyak penerima tanpa harus manual satu-satu.
- Memastikan tidak ada email yang "hilang jejak" — setiap penerima harus jelas statusnya: terkirim, gagal, dibuka, atau bounce.
- Proses kirim harus tahan gangguan — bisa dihentikan dan dilanjutkan tanpa mengirim dobel atau kehilangan progress.
- Menghindari kegagalan akibat rate limit / kuota API Resend yang tidak terkontrol.

### 1.3 Target Pengguna
Tim internal (marketing/admin/event organizer) yang mengirim campaign email untuk keperluan seperti: undangan acara, follow-up klien, pengumuman ke daftar kontak tertentu.

### 1.4 Skala & Batasan Desain
- Volume: **±200 penerima per campaign**, dikirim **sesekali** (bukan continuous blasting).
- Single-tenant, dijalankan sebagai **satu proses long-running** (VPS/container), bukan serverless — supaya SQLite dan webhook listener selalu siap.
- Tidak memerlukan fitur unsubscribe (bukan newsletter).

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan (Goals)
1. Upload daftar kontak dari file Excel dengan validasi dan mapping kolom.
2. Membuat & mengelola template email yang reusable, dengan variable dinamis.
3. Memilih penerima secara fleksibel dari daftar kontak (bukan wajib kirim ke semua).
4. Mengirim email lewat Resend dengan mekanisme yang aman terhadap rate limit & kuota.
5. Mencatat status setiap email secara granular per-penerima (bukan per-batch).
6. Mendukung pause/resume proses kirim tanpa duplikasi atau kehilangan data.
7. Retry hanya untuk email yang gagal, tidak mengulang seluruh campaign.
8. Tracking status delivered/opened/bounced via webhook Resend.
9. Dashboard dengan filter & search yang mudah dipakai, loading cepat.
10. Desain modern, profesional, dan robust secara teknis.

### 2.2 Non-Tujuan (Out of Scope)
- Tidak ada fitur unsubscribe / preference center (bukan newsletter).
- Tidak mendukung continuous/scheduled recurring campaign (drip campaign).
- Tidak multi-tenant (satu organisasi/pengguna saja untuk versi ini).
- Tidak ada A/B testing subject line (bisa jadi fase berikutnya).
- Tidak menangani inbound email (hanya outbound/sending + tracking).

---

## 3. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Full-stack dalam satu aplikasi, cocok untuk single-server deployment |
| Bahasa | **TypeScript** | Type safety untuk data kontak, status, dan payload webhook |
| Database | **SQLite** (`better-sqlite3`), mode **WAL** | Ringan, cukup untuk skala ratusan-ribuan baris, tanpa infra tambahan |
| Email Provider | **Resend API** (+ Batch Send API) | Sesuai requirement, mendukung batch & webhook tracking |
| Queue/Job | **Tidak pakai Redis/BullMQ** — cukup **DB-backed queue** (tabel `recipients.status` sebagai state machine) + async worker function dalam proses yang sama | Sesuai skala 200 email/campaign, menghindari over-engineering |
| File Parsing | **SheetJS (xlsx)** | Parsing file .xls/.xlsx di sisi server |
| UI Styling | **Tailwind CSS** + komponen custom | Cepat, konsisten, mudah di-maintain |
| Rich Text Editor | **Tiptap** atau **React Quill** | Editor template email WYSIWYG dengan dukungan HTML |
| Autentikasi | **NextAuth.js** (credentials-based, single/multi-user sederhana) | Login sederhana untuk mengamankan akses ke data kontak |
| Deployment | VPS / Docker container / Fly.io / Railway (bukan serverless) | Supaya file SQLite persisten & webhook listener always-on |
| Realtime update UI | **Polling tiap 1-2 detik** atau **Server-Sent Events (SSE)** | Progress bar pengiriman real-time tanpa kompleksitas WebSocket |

### Environment Variables yang Dibutuhkan
```
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
DATABASE_PATH=./data/pvmailer.db
NEXTAUTH_SECRET=
NEXTAUTH_URL=
APP_BASE_URL=
```

---

## 4. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App (single process)          │
│                                                             │
│  ┌────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │  UI Pages   │   │  API Routes   │   │  Webhook Handler │ │
│  │  (React)    │──▶│  (send, retry,│   │  /api/webhooks/  │ │
│  │             │   │   pause, etc) │   │  resend          │ │
│  └────────────┘   └───────┬──────┘   └────────┬─────────┘ │
│                            │                    │            │
│                    ┌───────▼────────────────────▼─────┐    │
│                    │     SQLite Database (WAL mode)     │    │
│                    │  campaigns, recipients, templates, │    │
│                    │  contacts, campaign_variables      │    │
│                    └───────┬────────────────────────────┘    │
│                            │                                  │
│                    ┌───────▼────────┐                        │
│                    │  Send Worker    │──▶ Resend Batch API    │
│                    │  (async, in-    │                        │
│                    │  process loop)  │                        │
│                    └────────────────┘                        │
└─────────────────────────────────────────────────────────┘
                             ▲
                             │ webhook events
                     ┌───────┴────────┐
                     │  Resend.com    │
                     └────────────────┘
```

### Prinsip Kunci Arsitektur
- **`recipients.status` adalah single source of truth.** Worker pengiriman selalu query "siapa yang statusnya `pending`", tidak menyimpan progress di memory/variable sementara.
- Proses kirim berjalan sebagai **async background task** dalam proses Node yang sama (bukan request-blocking, bukan worker terpisah) — cukup untuk skala 200 email.
- **Idempotency**: setiap recipient punya `idempotency_key` unik per attempt untuk mencegah double-send saat retry.
- **Webhook selalu aktif** menerima event dari Resend kapan pun (delivered, opened, bounced, complained) dan meng-update baris terkait via `resend_email_id`.

---

## 5. Skema Database (SQLite)

```sql
-- Kontak master (hasil upload Excel, reusable lintas campaign)
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  group_tag TEXT,                  -- untuk grouping/filter, misal 'Klien A'
  is_suppressed INTEGER DEFAULT 0, -- 1 jika pernah hard bounce / complained
  suppressed_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Template email
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

-- Campaign (satu pengiriman)
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_id INTEGER NOT NULL REFERENCES templates(id),
  status TEXT NOT NULL DEFAULT 'draft',
    -- draft | sending | paused | completed | completed_with_errors
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);

-- Variable khusus campaign (berlaku sama untuk semua penerima)
CREATE TABLE campaign_variables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  key TEXT NOT NULL,      -- misal 'company_name'
  value TEXT NOT NULL     -- misal 'PT Maju Jaya'
);

-- Baris pengiriman per-penerima (state machine utama)
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | queued | sent | delivered | opened | bounced | failed | skipped
  resend_email_id TEXT,
  idempotency_key TEXT UNIQUE,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  bounce_type TEXT,          -- hard | soft
  sent_at TEXT,
  delivered_at TEXT,
  opened_at TEXT,
  bounced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Log audit tiap percobaan kirim (histori lengkap, tidak overwrite)
CREATE TABLE send_attempts_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES recipients(id),
  attempt_number INTEGER NOT NULL,
  result TEXT NOT NULL,     -- success | failed
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Log webhook mentah (untuk debugging & replay)
CREATE TABLE webhook_events_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  email_id TEXT,
  payload_json TEXT NOT NULL,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User untuk autentikasi
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index penting untuk performa query & filter
CREATE INDEX idx_recipients_campaign_status ON recipients(campaign_id, status);
CREATE INDEX idx_recipients_email ON recipients(email);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_group ON contacts(group_tag);
```

---

## 6. Fitur Lengkap & Spesifikasi Detail

### 6.1 Modul: Kontak (Contacts)

**Upload Excel**
- Terima file `.xls` / `.xlsx`.
- Setelah upload, tampilkan **preview** data mentah + dropdown **mapping kolom**: user mencocokkan kolom file (misal "Nama Lengkap", "Alamat Email") ke field sistem (`nama`, `email`).
- Validasi tiap baris:
  - Format email valid (regex standar) → jika tidak valid, tandai baris tersebut, jangan gagalkan seluruh file.
  - Deteksi duplikat: dalam file yang sama, dan terhadap kontak yang sudah ada di database (by email, case-insensitive).
- Setelah validasi, tampilkan ringkasan: "195 valid, 3 duplikat (dilewati), 2 format email salah" sebelum commit ke database.
- Kontak yang di-`is_suppressed = 1` (pernah hard bounce/komplain) tetap muncul di list tapi dengan badge peringatan, dan **tidak otomatis dicentang** saat pemilihan penerima campaign baru.

**List & Manajemen Kontak**
- Tabel dengan search (nama/email), filter by `group_tag`, filter by status suppressed.
- Tambah/edit/hapus kontak manual (satu per satu, untuk koreksi cepat).
- Bulk delete / bulk tag kontak terpilih.
- Grouping/tag kontak (misal per klien/project) untuk mempermudah seleksi campaign berikutnya.

### 6.2 Modul: Template Email

**Sender Configuration**
- Field **From Name** (misal "PT Maju Jaya") dan **From Email** — From Email dipilih dari **dropdown domain yang sudah terverifikasi** di Resend (bukan free text) untuk mencegah kesalahan konfigurasi domain.
- Field **Reply-To** (opsional) — jika balasan ingin diarahkan ke alamat berbeda dari From Email.

**Editor Template**
- Rich text editor (WYSIWYG): bold, italic, underline, link, bullet list, gambar, heading.
- Toggle ke mode **HTML source** untuk user teknis yang ingin edit langsung.
- **Insert Placeholder** lewat dropdown/tombol klik (tidak perlu hafal syntax), dua kategori:
  - **Dari data kontak** (beda tiap penerima): `{{nama}}`, `{{email}}`.
  - **Dari data campaign** (sama untuk semua penerima, diisi sekali): `{{company_name}}`, `{{event_name}}`, `{{event_date}}`, `{{event_location}}`, `{{sender_name}}`, `{{sender_title}}`, dan custom variable bebas yang bisa ditambah user.
- **Live preview** menampilkan hasil render dengan data contoh (sample data) secara real-time saat mengetik.
- Disclaimer singkat otomatis disarankan di footer (contoh: "Email ini dikirim terkait [nama acara/project]") — bukan unsubscribe, tapi konteks pengiriman untuk mengurangi risiko ditandai spam.

**Simpan & Kelola Template**
- Simpan dengan nama custom (misal "Undangan Seminar Q3").
- Duplicate template menjadi versi baru tanpa mengubah yang asli.
- List template dengan kolom: nama, subject, terakhir dipakai, tombol edit/duplicate/hapus.
- Template reusable — bisa dipakai ulang oleh campaign berbeda dengan `campaign_variables` yang berbeda-beda.

**Validasi Sebelum Simpan/Kirim**
- Cek semua placeholder di HTML template punya sumber data yang jelas (dari kontak atau dari campaign_variables). Jika ada placeholder "yatim" (tidak ada datanya), tampilkan warning sebelum bisa lanjut kirim.

### 6.3 Modul: Campaign (Inti Aplikasi)

**Buat Campaign — Wizard 4 Langkah**
1. **Info Campaign**: nama campaign, pilih template.
2. **Isi Variable Campaign**: form otomatis muncul berdasarkan placeholder campaign-level di template terpilih (misal isi `company_name`, `event_date`).
3. **Pilih Penerima**: tabel kontak dengan checkbox, search, filter by group, filter exclude-suppressed. Tampilkan counter "187 dari 200 dipilih".
4. **Review & Test Send**: preview final email dengan data salah satu penerima asli, tombol **"Kirim Test ke Email Saya"** wajib tersedia sebelum tombol kirim massal aktif (bisa juga dilewati dengan konfirmasi eksplisit).

**Proses Pengiriman**
- Saat "Kirim Campaign" ditekan:
  1. Sistem membuat baris `recipients` untuk semua penerima terpilih dengan status `pending` dan `idempotency_key` unik.
  2. Campaign status → `sending`.
  3. Worker async membagi recipient jadi chunk maksimal 100 (sesuai limit Batch API Resend), lalu memanggil batch send.
  4. Antar-chunk diberi jeda kecil (throttle) untuk tetap di bawah rate limit 10 request/detik.
  5. Response per-item dari batch di-mapping ke masing-masing baris `recipients` → update status `sent` atau `failed` + `last_error`.
  6. Jika menerima 429 (rate limit), sistem membaca header `retry-after`, menunggu sesuai durasi tersebut, lalu retry chunk itu — tidak retry membabi-buta.
  7. Progress ditampilkan real-time di UI (polling/SSE) berdasarkan hitungan status di tabel `recipients`.

**Pause / Resume**
- Tombol **"Pause"** aktif selama status campaign `sending` — menghentikan worker mengambil chunk baru berikutnya (chunk yang sedang berjalan diselesaikan dulu supaya tidak ada state setengah jalan).
- Campaign status → `paused`. Recipient yang belum diproses tetap berstatus `pending`.
- Tombol **"Resume"** melanjutkan proses dari recipient yang masih `pending` — tidak mengulang yang sudah `sent`/`delivered`.
- Jika aplikasi/server restart di tengah proses `sending`, saat start-up sistem otomatis mendeteksi campaign yang statusnya masih `sending` dan melanjutkan otomatis dari recipient `pending` (self-healing, tidak butuh intervensi manual).

**Retry Gagal**
- Tab/filter khusus "Gagal" di halaman detail campaign, menampilkan semua recipient `status = failed` beserta `last_error`.
- Tombol **"Retry Semua yang Gagal"** atau retry per-baris individual.
- Retry membuat `idempotency_key` baru untuk attempt tersebut dan menambah `attempts` + mencatat ke `send_attempts_log`.
- Batas retry otomatis: maksimal 3x untuk error transient (timeout, 429); error permanen (misal alamat tidak valid/hard bounce) tidak di-retry otomatis, harus tindakan manual dari user.

**Detail Campaign — Dashboard**
- Ringkasan angka besar: Total, Terkirim, Delivered, Dibuka, Gagal, Bounce.
- Progress bar visual saat status `sending`/`paused`.
- Tabel recipient lengkap dengan filter status, search nama/email, sort by waktu.
- Export hasil ke CSV/Excel (bukti laporan pengiriman).

### 6.4 Modul: Tracking (Webhook Integration)

- Endpoint `POST /api/webhooks/resend` yang selalu aktif menerima event.
- **Verifikasi signature** webhook menggunakan `signing_secret` dari Resend (Svix-based) — tolak request yang tidak valid.
- Event yang ditangani:
  | Event | Aksi |
  |---|---|
  | `email.sent` | Update status → `sent` (bukan final, masih menunggu delivered) |
  | `email.delivered` | Update status → `delivered`, catat `delivered_at` |
  | `email.opened` | Update status → `opened`, catat `opened_at` (jika sebelumnya belum delivered, set delivered juga) |
  | `email.bounced` | Update status → `bounced`, catat `bounce_type` (hard/soft). Jika hard bounce → set `contacts.is_suppressed = 1` |
  | `email.complained` | Set `contacts.is_suppressed = 1`, `suppressed_reason = 'complained'` |
- Semua payload mentah disimpan ke `webhook_events_log` untuk audit/debugging/replay.
- Idempotent handling — event yang sama diterima dua kali (retry dari Resend) tidak boleh menyebabkan data ganda.

### 6.5 Modul: Kuota & Rate Limit Guard

- Sebelum memulai kirim campaign, sistem cek estimasi terhadap kuota harian/bulanan Resend (dari header response API sebelumnya yang di-cache, atau dari endpoint usage jika tersedia).
- Jika perkiraan pengiriman akan melebihi kuota harian, tampilkan **warning eksplisit** ke user sebelum melanjutkan ("Sisa kuota harian: 150, campaign ini butuh 200 — 50 email akan gagal/tertunda").
- Semua pemanggilan Resend API dibungkus try-catch dengan **timeout eksplisit** (misal 15 detik) dan exponential backoff untuk error transient.

### 6.6 Modul: Autentikasi & Keamanan

- Login sederhana (email + password) via NextAuth credentials provider.
- Semua halaman aplikasi (kecuali login & webhook endpoint) wajib autentikasi.
- API key Resend & webhook secret disimpan di environment variable, tidak pernah dikirim ke client.
- Sanitasi HTML template sebelum render (mencegah XSS jika ada input tidak terpercaya).
- Rate limit sederhana pada endpoint webhook untuk mencegah abuse.

### 6.7 Navigasi / Menu Aplikasi

```
├── Dashboard          (ringkasan semua campaign, statistik global)
├── Campaigns
│   ├── List Campaign  (filter by status, search)
│   ├── Buat Campaign  (wizard 4 langkah)
│   └── Detail Campaign (progress, recipient table, retry, export)
├── Kontak
│   ├── List Kontak    (filter, search, grouping)
│   └── Upload Excel   (mapping & validasi)
├── Template
│   ├── List Template
│   └── Editor Template
├── Log & Riwayat
│   └── Webhook events log (untuk debugging admin)
└── Pengaturan
    ├── Domain terverifikasi (info dari Resend)
    └── Akun/Profil
```

---

## 7. Desain UI/UX

### 7.1 Prinsip Desain
- **Modern, profesional, minim-clutter** — bukan dashboard admin generik yang berat.
- **Fast loading** — pagination/virtualized table untuk daftar kontak besar, lazy load komponen berat (rich text editor), skeleton loading state, bukan spinner polos.
- **Easy to navigate** — sidebar tetap terlihat, breadcrumb jelas di setiap halaman detail, aksi utama (Kirim, Retry, Pause) selalu terlihat tanpa scroll (sticky action bar).
- **Robust terasa dari UI** — setiap aksi destruktif (hapus kontak, kirim campaign ke ratusan orang) butuh **konfirmasi eksplisit** (modal, bukan langsung eksekusi), dan selalu ada feedback jelas (toast notification) untuk setiap aksi.

### 7.2 Design System

**Warna (Palet)**
| Token | Hex | Kegunaan |
|---|---|---|
| Primary | `#4F46E5` (Indigo 600) | Tombol utama, link aktif, highlight |
| Primary Hover | `#4338CA` | Hover state |
| Success | `#16A34A` | Status delivered/opened, badge sukses |
| Warning | `#D97706` | Status pending/perlu perhatian |
| Danger | `#DC2626` | Status failed/bounced, aksi hapus |
| Neutral 900 | `#111827` | Teks utama |
| Neutral 500 | `#6B7280` | Teks sekunder |
| Neutral 100 | `#F3F4F6` | Background section/card |
| Neutral 0 | `#FFFFFF` | Background utama |
| Border | `#E5E7EB` | Garis pembatas antar elemen |

**Tipografi**
- Font: **Inter** (sans-serif, modern, sangat mudah dibaca di ukuran kecil untuk tabel data).
- Skala: `text-2xl` (judul halaman, 24px bold), `text-lg` (judul section, 18px semibold), `text-sm` (body/tabel, 14px regular), `text-xs` (label/meta, 12px).

**Komponen Kunci**
- **Status Badge** — pill kecil berwarna sesuai status (`pending` abu-abu, `sent` biru muda, `delivered` hijau muda, `opened` hijau tua dengan ikon mata, `failed`/`bounced` merah).
- **Progress Bar** — batang progres dengan gradasi warna + teks angka ("142/200") di dalam/atas bar, update real-time.
- **Data Table** — header sticky saat scroll, kolom sortable, filter chip di atas tabel (bukan dropdown tersembunyi), pagination di bawah (25/50/100 per halaman).
- **Empty State** — ilustrasi/ikon sederhana + call-to-action ("Belum ada campaign, buat yang pertama") — bukan halaman kosong polos.
- **Toast Notification** — muncul di pojok kanan atas, auto-dismiss, warna sesuai jenis (sukses/error/info).
- **Modal Konfirmasi** — untuk aksi kirim massal, hapus data, retry — selalu ada ringkasan dampak ("Anda akan mengirim ke 200 penerima").

**Layout**
- Sidebar kiri fixed (±240px) berisi menu utama, collapsible untuk layar kecil.
- Top bar: breadcrumb + info user + notifikasi.
- Konten utama: max-width terbatas (±1200px) supaya tidak terlalu lebar di layar besar, dengan padding konsisten.
- Card-based layout untuk grouping informasi (bukan tabel raksasa tanpa struktur).

### 7.3 Responsivitas
- Desktop-first (karena ini tool kerja/admin), tapi tetap harus bisa dipakai di tablet dengan sidebar collapsible menjadi menu hamburger.

---

## 8. Alur Pengguna (User Flow) Utama

### 8.1 Flow: Membuat & Mengirim Campaign
```
Login → Dashboard → "Buat Campaign Baru"
  → Step 1: Nama campaign + pilih template
  → Step 2: Isi variable campaign (company_name, event_date, dst)
  → Step 3: Pilih penerima dari daftar kontak (search/filter/select)
  → Step 4: Review preview + Kirim Test ke diri sendiri
  → Konfirmasi "Kirim ke 200 penerima?"
  → Campaign berjalan (status: sending), progress bar real-time
  → (opsional) Pause → Resume
  → Selesai → Dashboard detail: X delivered, Y opened, Z failed
  → Jika ada gagal → tab "Gagal" → Retry
```

### 8.2 Flow: Upload Kontak Baru
```
Menu Kontak → "Upload Excel" → pilih file
  → Preview data + mapping kolom (Nama, Email)
  → Sistem validasi: tampilkan ringkasan valid/invalid/duplikat
  → Konfirmasi import → data masuk ke tabel contacts
```

### 8.3 Flow: Tracking Setelah Kirim
```
Resend mengirim webhook event → /api/webhooks/resend
  → Verifikasi signature → update recipients.status
  → Update campaign counters (sent_count, opened_count, dst)
  → User buka Detail Campaign → lihat status ter-update real-time
```

---

## 9. Penanganan Error & Edge Case

| Skenario | Penanganan |
|---|---|
| Rate limit 429 dari Resend | Baca header `retry-after`, tunda chunk tersebut, jangan retry instan |
| Kuota harian/bulanan habis | Hentikan proses, tandai sisa recipient `pending`, tampilkan alert jelas ke user, bisa resume besok/setelah upgrade |
| Server restart di tengah `sending` | Saat startup, deteksi campaign berstatus `sending`, otomatis resume dari recipient `pending` |
| Tombol kirim/retry ditekan dua kali | Cek status campaign dulu (harus `draft`/`paused`/`failed` state yang sesuai) sebelum memulai proses baru; gunakan idempotency key |
| File Excel dengan kolom tidak standar | Wizard mapping kolom manual, bukan asumsi otomatis |
| Email format tidak valid dalam file | Tandai baris tersebut, tetap proses baris lain, tampilkan ringkasan di akhir |
| Placeholder template tanpa data | Validasi sebelum kirim, blokir dengan warning jelas |
| Hard bounce | Otomatis suppress kontak untuk campaign berikutnya |
| Webhook diterima dua kali (duplicate event) | Cek `email_id` + event type sebelum update, hindari double counting |
| Koneksi ke Resend timeout | Timeout eksplisit (15 detik), tandai `failed` dengan error jelas, bisa di-retry manual |

---

## 10. Kriteria Penerimaan (Acceptance Criteria)

- [ ] User bisa upload file Excel, mapping kolom, dan melihat ringkasan validasi sebelum data masuk ke database.
- [ ] User bisa membuat template dengan From Name, From Email (dari domain terverifikasi), placeholder dinamis, dan menyimpannya untuk dipakai ulang.
- [ ] User bisa memilih sebagian atau seluruh kontak sebagai penerima campaign, dengan search & filter.
- [ ] Sistem berhasil mengirim ke ±200 penerima menggunakan Batch API tanpa melanggar rate limit Resend.
- [ ] Setiap penerima memiliki status individual yang akurat dan bisa difilter (pending/sent/delivered/opened/bounced/failed).
- [ ] User bisa pause proses kirim yang sedang berjalan, dan resume tanpa mengirim dobel ke penerima yang sudah terkirim.
- [ ] Jika server restart di tengah pengiriman, campaign otomatis melanjutkan dari titik terakhir tanpa intervensi manual.
- [ ] User bisa retry khusus penerima yang gagal, tanpa mengulang yang sudah sukses.
- [ ] Status "delivered" dan "opened" ter-update otomatis dari webhook Resend secara real-time di UI.
- [ ] Kontak yang hard bounce otomatis ditandai suppressed dan tidak masuk seleksi default campaign berikutnya.
- [ ] Semua halaman memiliki loading time cepat dan dapat difilter/dicari dengan mudah.
- [ ] Aplikasi memiliki autentikasi login dan tidak mengekspos API key ke sisi client.

---

## 11. Roadmap Fase Berikutnya (Opsional, Tidak Wajib di V1)

- Multi-user dengan role & permission berbeda.
- A/B testing subject line.
- Scheduled sending (kirim di waktu tertentu).
- Integrasi dengan CRM eksternal untuk sinkronisasi kontak.
- Multi-bahasa template.

---

*Dokumen ini disusun untuk menjadi acuan lengkap pengembangan aplikasi PVMailer, termasuk untuk dibaca dan diimplementasikan oleh AI coding assistant. Semua skema database, alur proses, dan spesifikasi UI di atas bersifat mengikat kecuali ada perubahan yang didiskusikan ulang.*
