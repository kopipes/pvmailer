import { getDb } from './db'
import { v4 as uuidv4 } from 'uuid'
import { suppressContact } from './contacts'
import type { WebhookEventLog } from '@/types'

export function processResendWebhook(payload: Record<string, unknown>): void {
  const db = getDb()

  const eventId = (payload.id as string) ?? null
  const eventType = (payload.type as string) ?? 'unknown'
  const data = (payload.data as Record<string, unknown>) ?? {}
  const email = (data.to as string) ?? (data.email_id as string) ?? null
  const messageId = (data.email_id as string) ?? null

  // Log raw event
  const logId = uuidv4()
  db.prepare(
    `INSERT INTO webhook_events_log (id, resend_event_id, event_type, email, resend_message_id, raw_payload, processed)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(logId, eventId, eventType, email, messageId, JSON.stringify(payload))

  if (!messageId) return

  // Find recipient by resend_message_id
  const recipient = db
    .prepare('SELECT * FROM recipients WHERE resend_message_id = ?')
    .get(messageId) as { id: string; campaign_id: string; contact_id: string; status: string } | undefined

  switch (eventType) {
    case 'email.delivered': {
      if (recipient && !['opened', 'bounced'].includes(recipient.status)) {
        db.prepare(
          `UPDATE recipients SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(recipient.id)
      }
      break
    }
    case 'email.opened': {
      if (recipient) {
        db.prepare(
          `UPDATE recipients SET status = 'opened', opened_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(recipient.id)
        // Update campaign opened_count only once
        if (recipient.status !== 'opened') {
          db.prepare(
            `UPDATE campaigns SET opened_count = opened_count + 1 WHERE id = ?`
          ).run(recipient.campaign_id)
        }
      }
      break
    }
    case 'email.bounced': {
      if (recipient) {
        db.prepare(
          `UPDATE recipients SET status = 'bounced', bounced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(recipient.id)
        db.prepare(
          `UPDATE campaigns SET bounced_count = bounced_count + 1 WHERE id = ?`
        ).run(recipient.campaign_id)
        // Auto-suppress contact on hard bounce
        suppressContact(recipient.contact_id, 'hard_bounce')
      }
      break
    }
    case 'email.complained': {
      if (recipient) {
        db.prepare(
          `UPDATE recipients SET status = 'complained', updated_at = datetime('now') WHERE id = ?`
        ).run(recipient.id)
        suppressContact(recipient.contact_id, 'spam_complaint')
      }
      break
    }
  }

  // Mark event as processed
  db.prepare('UPDATE webhook_events_log SET processed = 1 WHERE id = ?').run(logId)
}

export function getWebhookLogs(page = 1, pageSize = 50): { data: WebhookEventLog[]; total: number } {
  const db = getDb()
  const total = (db.prepare('SELECT COUNT(*) as c FROM webhook_events_log').get() as { c: number }).c
  const offset = (page - 1) * pageSize
  const data = db
    .prepare('SELECT * FROM webhook_events_log ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(pageSize, offset) as WebhookEventLog[]
  return { data, total }
}
