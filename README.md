# PVMailer

An internal email campaign application for sending targeted emails to contact lists imported from Excel. Built for teams that need reliable, trackable email delivery without the overhead of a full marketing platform.

## Features

- **Contact management** — Import contacts from `.xlsx` files with column mapping, tag groups, suppress/unsuppress, search and filter
- **Template editor** — Tiptap WYSIWYG editor with `{{variable}}` personalization, live preview, duplicate
- **Campaign wizard** — 4-step flow: pick template → select contacts → fill variables → confirm
- **Reliable sending** — DB-backed queue with idempotency keys, 10 emails/batch with 1s delay, up to 3 retries per recipient
- **Pause / Resume / Retry** — Stop a running campaign, resume from where it left off, retry only failed recipients
- **Webhook tracking** — Real-time delivered / opened / bounced / complained status via Resend webhooks
- **Auto-suppression** — Hard bounces and spam complaints automatically suppress the contact
- **Server restart recovery** — Interrupted campaigns resume automatically on next boot
- **Auth** — NextAuth.js credentials login, route protection via Next.js 16 Proxy
- **Dashboard** — Stats overview, running campaign alerts, open rate
- **Admin** — User management, divisions master data, webhook event log, profile settings

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Email | Resend API |
| File parsing | ExcelJS |
| Rich text | Tiptap |
| Auth | NextAuth.js (credentials) |
| Styling | Tailwind CSS v4 |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Resend](https://resend.com) account and API key

### Setup

```bash
# Clone and install
git clone https://github.com/kopipes/pvmailer.git
cd pvmailer
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values
```

### Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx   # optional but recommended
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000

# Optional: override default admin credentials (used on first boot)
DEFAULT_ADMIN_EMAIL=admin@pvmailer.local
DEFAULT_ADMIN_PASSWORD=changeme123
```

### Run

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the default admin credentials (printed above).

> On first boot, a default admin user and two sample templates are created automatically.

## Webhook Setup

To receive delivery/open/bounce events from Resend, configure a webhook in your Resend dashboard pointing to:

```
https://your-domain.com/api/webhooks/resend
```

Enable these events: `email.delivered`, `email.opened`, `email.bounced`, `email.complained`.

## Deployment

PVMailer must run as a **long-running process** (VPS, Docker, Railway, Fly.io) — not serverless — because it uses SQLite on disk and an in-process campaign worker.

```bash
# Example Docker build
docker build -t pvmailer .
docker run -p 3000:3000 -v /data:/app/data --env-file .env pvmailer
```

Make sure the `data/` directory is mounted as a persistent volume.

## Project Structure

```
src/
  app/
    (app)/          # Authenticated pages (dashboard, campaigns, contacts, templates…)
    (auth)/         # Login page
    api/            # API routes
  components/
    campaigns/      # CampaignWizard
    contacts/       # ContactsTable, UploadModal
    templates/      # TemplateEditor (Tiptap)
    layout/         # Sidebar, SessionProvider
  lib/              # Business logic (campaigns, contacts, templates, webhooks…)
  proxy.ts          # Route protection (Next.js 16 Proxy / Middleware)
  types/            # Shared TypeScript types
data/               # SQLite database (gitignored)
```

## Default Credentials

| Field | Value |
|---|---|
| Email | `admin@pvmailer.local` |
| Password | `changeme123` |

Change these immediately via Settings after first login, or set `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` in your environment before first boot.

## License

Private — internal use only.
