import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'pvmailer.db')

// Ensure data directory exists
if (!fs.existsSync(/*turbopackIgnore: true*/ DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    _db.pragma('synchronous = NORMAL')
    runMigrations(_db)
  }
  return _db
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      extra_data TEXT,
      group_tags TEXT,
      is_suppressed INTEGER NOT NULL DEFAULT 0,
      suppression_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_suppressed ON contacts(is_suppressed);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      variables TEXT,
      from_name TEXT NOT NULL,
      from_email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      opened_count INTEGER NOT NULL DEFAULT 0,
      bounced_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT,
      paused_at TEXT,
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

    CREATE TABLE IF NOT EXISTS campaign_variables (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      variable_name TEXT NOT NULL,
      variable_value TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      extra_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      resend_message_id TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      sent_at TEXT,
      delivered_at TEXT,
      opened_at TEXT,
      bounced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON recipients(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
    CREATE INDEX IF NOT EXISTS idx_recipients_resend_id ON recipients(resend_message_id);
    CREATE INDEX IF NOT EXISTS idx_recipients_idem ON recipients(idempotency_key);

    CREATE TABLE IF NOT EXISTS send_attempts_log (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      resend_message_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webhook_events_log (
      id TEXT PRIMARY KEY,
      resend_event_id TEXT,
      event_type TEXT NOT NULL,
      email TEXT,
      resend_message_id TEXT,
      raw_payload TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_msg_id ON webhook_events_log(resend_message_id);

    CREATE TABLE IF NOT EXISTS divisions (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Add columns to users safely (SQLite doesn't support IF NOT EXISTS on ALTER TABLE)
  const userCols = (db.pragma('table_info(users)') as { name: string }[]).map(c => c.name)
  if (!userCols.includes('role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`)
  }
  if (!userCols.includes('division_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN division_id TEXT REFERENCES divisions(id)`)
  }
}
