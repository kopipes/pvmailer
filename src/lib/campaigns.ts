import { getDb } from './db'
import { v4 as uuidv4 } from 'uuid'
import { renderTemplate, wrapEmailHtml } from './templates'
import { Resend } from 'resend'
import type { Campaign, Recipient, CampaignWithTemplate, RecipientStatus, PaginatedResult } from '@/types'

const MAX_RETRIES = 3
const CHUNK_SIZE = 10 // send N emails per batch tick
const BATCH_DELAY_MS = 1000 // delay between batches to respect rate limits

// In-memory abort controller per campaign
const runningWorkers = new Map<string, { abort: boolean }>()

export function getCampaigns(
  page = 1,
  pageSize = 20,
  search = '',
  status = ''
): PaginatedResult<CampaignWithTemplate> {
  const db = getDb()
  const offset = (page - 1) * pageSize
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('(c.name LIKE ?)')
    params.push(`%${search}%`)
  }
  if (status) {
    conditions.push('c.status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM campaigns c JOIN templates t ON c.template_id = t.id ${where}`
      )
      .get(...params) as { c: number }
  ).c

  const data = db
    .prepare(
      `SELECT c.*, t.name as template_name, t.subject as template_subject,
              t.from_name, t.from_email
       FROM campaigns c
       JOIN templates t ON c.template_id = t.id
       ${where}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as CampaignWithTemplate[]

  return { data, total, page, pageSize }
}

export function getCampaignById(id: string): CampaignWithTemplate | undefined {
  const db = getDb()
  return db
    .prepare(
      `SELECT c.*, t.name as template_name, t.subject as template_subject,
              t.from_name, t.from_email
       FROM campaigns c
       JOIN templates t ON c.template_id = t.id
       WHERE c.id = ?`
    )
    .get(id) as CampaignWithTemplate | undefined
}

export function createCampaign(data: {
  name: string
  template_id: string
  variables?: Record<string, string>
  contact_ids: string[]
}): Campaign {
  const db = getDb()
  const id = uuidv4()

  const createCampaignTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO campaigns (id, name, template_id, status, total_count)
       VALUES (?, ?, ?, 'draft', ?)`
    ).run(id, data.name, data.template_id, data.contact_ids.length)

    // Insert campaign variables
    if (data.variables) {
      for (const [key, value] of Object.entries(data.variables)) {
        db.prepare(
          `INSERT INTO campaign_variables (id, campaign_id, variable_name, variable_value) VALUES (?, ?, ?, ?)`
        ).run(uuidv4(), id, key, value)
      }
    }

    // Insert recipients
    for (const contactId of data.contact_ids) {
      const contact = db
        .prepare('SELECT * FROM contacts WHERE id = ? AND is_suppressed = 0')
        .get(contactId) as { id: string; email: string; name: string | null; extra_data: string | null } | undefined
      if (!contact) continue

      const idemKey = `${id}:${contactId}`
      const rsvpToken = uuidv4().replace(/-/g, '') // compact token for URL
      db.prepare(
        `INSERT OR IGNORE INTO recipients
         (id, campaign_id, contact_id, email, name, extra_data, status, idempotency_key, rsvp_token)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(uuidv4(), id, contact.id, contact.email, contact.name, contact.extra_data, idemKey, rsvpToken)
    }

    // Update total_count to actual (non-suppressed)
    const count = (
      db
        .prepare('SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ?')
        .get(id) as { c: number }
    ).c
    db.prepare('UPDATE campaigns SET total_count = ? WHERE id = ?').run(count, id)
  })

  createCampaignTx()
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign
}

export function getCampaignRecipients(
  campaignId: string,
  page = 1,
  pageSize = 50,
  status = ''
): PaginatedResult<Recipient> {
  const db = getDb()
  const offset = (page - 1) * pageSize
  const where = status ? 'WHERE campaign_id = ? AND status = ?' : 'WHERE campaign_id = ?'
  const params = status ? [campaignId, status] : [campaignId]

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM recipients ${where}`).get(...params) as { c: number }
  ).c

  const data = db
    .prepare(`SELECT * FROM recipients ${where} ORDER BY created_at ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as Recipient[]

  return { data, total, page, pageSize }
}

export async function startCampaign(campaignId: string): Promise<void> {
  const db = getDb()
  const campaign = getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.status === 'running') return
  if (!['draft', 'paused'].includes(campaign.status)) {
    throw new Error(`Cannot start campaign in status: ${campaign.status}`)
  }

  db.prepare(
    `UPDATE campaigns SET status = 'running', started_at = COALESCE(started_at, datetime('now')), paused_at = NULL WHERE id = ?`
  ).run(campaignId)

  // Kick off worker (fire and forget)
  runWorker(campaignId).catch(console.error)
}

export function pauseCampaign(campaignId: string) {
  const db = getDb()
  const worker = runningWorkers.get(campaignId)
  if (worker) worker.abort = true

  db.prepare(
    `UPDATE campaigns SET status = 'paused', paused_at = datetime('now') WHERE id = ? AND status = 'running'`
  ).run(campaignId)

  // Reset any stuck 'sending' recipients back to 'pending'
  db.prepare(
    `UPDATE recipients SET status = 'pending', updated_at = datetime('now') WHERE campaign_id = ? AND status = 'sending'`
  ).run(campaignId)
}

export function cancelCampaign(campaignId: string) {
  const db = getDb()
  const worker = runningWorkers.get(campaignId)
  if (worker) worker.abort = true
  db.prepare(
    `UPDATE campaigns SET status = 'cancelled', finished_at = datetime('now') WHERE id = ?`
  ).run(campaignId)
}

export function renameCampaign(campaignId: string, name: string) {
  const db = getDb()
  db.prepare(`UPDATE campaigns SET name = ? WHERE id = ?`).run(name, campaignId)
}

export function getCampaignVariables(campaignId: string): Record<string, string> {
  const db = getDb()
  const rows = db
    .prepare('SELECT variable_name, variable_value FROM campaign_variables WHERE campaign_id = ?')
    .all(campaignId) as { variable_name: string; variable_value: string }[]
  const result: Record<string, string> = {}
  for (const r of rows) result[r.variable_name] = r.variable_value
  return result
}

export function updateCampaignVariables(campaignId: string, variables: Record<string, string>) {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM campaign_variables WHERE campaign_id = ?').run(campaignId)
    for (const [key, value] of Object.entries(variables)) {
      db.prepare(
        `INSERT INTO campaign_variables (id, campaign_id, variable_name, variable_value) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), campaignId, key, value)
    }
  })()
}

export function duplicateCampaign(campaignId: string, newName: string): Campaign {
  const db = getDb()
  const original = getCampaignById(campaignId)
  if (!original) throw new Error('Campaign not found')

  const newId = uuidv4()

  db.transaction(() => {
    // Create new draft campaign
    db.prepare(
      `INSERT INTO campaigns (id, name, template_id, status, total_count)
       VALUES (?, ?, ?, 'draft', ?)`
    ).run(newId, newName, original.template_id, original.total_count)

    // Copy campaign variables
    const vars = db
      .prepare('SELECT variable_name, variable_value FROM campaign_variables WHERE campaign_id = ?')
      .all(campaignId) as { variable_name: string; variable_value: string }[]
    for (const v of vars) {
      db.prepare(
        `INSERT INTO campaign_variables (id, campaign_id, variable_name, variable_value) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), newId, v.variable_name, v.variable_value)
    }

    // Copy recipients (reset to pending, clear send data)
    const recipients = db
      .prepare('SELECT * FROM recipients WHERE campaign_id = ?')
      .all(campaignId) as Recipient[]
    for (const r of recipients) {
      const idemKey = `${newId}:${r.contact_id}`
      db.prepare(
        `INSERT OR IGNORE INTO recipients
         (id, campaign_id, contact_id, email, name, extra_data, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(uuidv4(), newId, r.contact_id, r.email, r.name, r.extra_data, idemKey)
    }

    // Update total_count to actual inserted
    const count = (db
      .prepare('SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ?')
      .get(newId) as { c: number }).c
    db.prepare('UPDATE campaigns SET total_count = ? WHERE id = ?').run(count, newId)
  })()

  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(newId) as Campaign
}

export function deleteCampaign(campaignId: string) {
  const db = getDb()
  const campaign = getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.status === 'running') throw new Error('Cannot delete a running campaign — pause or cancel it first')
  const worker = runningWorkers.get(campaignId)
  if (worker) worker.abort = true
  db.transaction(() => {
    db.prepare('DELETE FROM send_attempts_log WHERE campaign_id = ?').run(campaignId)
    db.prepare('DELETE FROM recipients WHERE campaign_id = ?').run(campaignId)
    db.prepare('DELETE FROM campaign_variables WHERE campaign_id = ?').run(campaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId)
  })()
}

export function retryFailedRecipients(campaignId: string) {
  const db = getDb()
  const failedCount = (db.prepare(
    `SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ? AND status = 'failed'`
  ).get(campaignId) as { c: number }).c

  db.prepare(
    `UPDATE recipients SET status = 'pending', last_error = NULL, attempt_count = 0, updated_at = datetime('now')
     WHERE campaign_id = ? AND status = 'failed'`
  ).run(campaignId)

  // Reset campaign back to paused so startCampaign can proceed
  db.prepare(
    `UPDATE campaigns SET status = 'paused', failed_count = failed_count - ?, finished_at = NULL
     WHERE id = ? AND status IN ('completed', 'cancelled')`
  ).run(failedCount, campaignId)
}

export function updateRecipient(recipientId: string, data: { email?: string; name?: string }) {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM recipients WHERE id = ?').get(recipientId) as { id: string; email: string; name: string | null; status: string } | undefined
  if (!existing) throw new Error('Recipient not found')
  db.prepare(
    `UPDATE recipients SET email = ?, name = ?, status = 'pending', last_error = NULL,
     attempt_count = 0, updated_at = datetime('now') WHERE id = ?`
  ).run(
    data.email?.trim() ?? existing.email,
    data.name !== undefined ? (data.name.trim() || null) : existing.name,
    recipientId
  )
}

export function resumeCampaignsOnStartup() {
  const db = getDb()
  // Auto-resume any campaigns that were 'running' when server restarted
  const running = db
    .prepare(`SELECT id FROM campaigns WHERE status = 'running'`)
    .all() as { id: string }[]

  for (const { id } of running) {
    // Reset stuck 'sending' recipients back to 'pending'
    db.prepare(
      `UPDATE recipients SET status = 'pending' WHERE campaign_id = ? AND status = 'sending'`
    ).run(id)

    // Only resume if there are pending recipients — otherwise set to paused
    const pendingCount = (db
      .prepare(`SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ? AND status = 'pending'`)
      .get(id) as { c: number }).c

    if (pendingCount > 0) {
      startCampaign(id).catch(console.error)
    } else {
      // No work to do — park as paused so user can retry manually
      db.prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`).run(id)
    }
  }
}

async function runWorker(campaignId: string) {
  const controller = { abort: false }
  runningWorkers.set(campaignId, controller)

  const db = getDb()
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Read base URL from env — use fs to ensure runtime value, not build-time bundle
  let baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? ''
  if (!baseUrl) {
    try {
      const fs = await import('fs')
      const envFile = fs.readFileSync(process.cwd() + '/.env', 'utf8')
      for (const line of envFile.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) {
          const key = line.slice(0, eq).trim()
          const val = line.slice(eq + 1).trim()
          if (key === 'APP_BASE_URL' || key === 'NEXTAUTH_URL') {
            baseUrl = val
            if (key === 'APP_BASE_URL') break
          }
        }
      }
    } catch {}
  }
  baseUrl = (baseUrl || 'http://localhost:3000').replace(/\/$/, '')

  try {
    while (!controller.abort) {
      // Refresh campaign state
      const campaign = db
        .prepare('SELECT * FROM campaigns WHERE id = ?')
        .get(campaignId) as Campaign | undefined

      if (!campaign || campaign.status !== 'running') break

      // Get variables
      const vars = db
        .prepare('SELECT variable_name, variable_value FROM campaign_variables WHERE campaign_id = ?')
        .all(campaignId) as { variable_name: string; variable_value: string }[]
      const variableMap: Record<string, string> = {}
      for (const v of vars) variableMap[v.variable_name] = v.variable_value

      // Get template
      const template = db
        .prepare('SELECT * FROM templates WHERE id = ?')
        .get(campaign.template_id) as { subject: string; body_html: string; from_name: string; from_email: string } | undefined
      if (!template) break

      // Fetch next chunk of pending recipients
      const chunk = db
        .prepare(
          `SELECT * FROM recipients
           WHERE campaign_id = ? AND status = 'pending' AND attempt_count < ?
           LIMIT ?`
        )
        .all(campaignId, MAX_RETRIES, CHUNK_SIZE) as Recipient[]

      if (chunk.length === 0) {
        // All done
        const remaining = (
          db
            .prepare(`SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ? AND status = 'pending'`)
            .get(campaignId) as { c: number }
        ).c
        if (remaining === 0) {
          db.prepare(
            `UPDATE campaigns SET status = 'completed', finished_at = datetime('now') WHERE id = ?`
          ).run(campaignId)
        }
        break
      }

      // Mark chunk as 'sending'
      const ids = chunk.map((r) => r.id)
      db.prepare(
        `UPDATE recipients SET status = 'sending', updated_at = datetime('now')
         WHERE id IN (${ids.map(() => '?').join(',')})`
      ).run(...ids)

      // Send each recipient
      for (const recipient of chunk) {
        if (controller.abort) break

        const extra: Record<string, string> = recipient.extra_data
          ? JSON.parse(recipient.extra_data)
          : {}

        const baseUrl = (process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
        const rsvpBase = `${baseUrl}/rsvp/${recipient.rsvp_token}`

        const mergedVars: Record<string, string> = {
          ...variableMap,
          name: recipient.name ?? '',
          email: recipient.email,
          ...extra,
          // RSVP links — only useful if template uses them
          rsvp_yes_link: `${rsvpBase}?r=yes`,
          rsvp_no_link: `${rsvpBase}?r=no`,
        }

        const subject = renderTemplate(template.subject, mergedVars)
        const bodyHtml = renderTemplate(template.body_html, mergedVars)
        const html = wrapEmailHtml({
          subject,
          fromName: template.from_name,
          fromEmail: template.from_email,
          bodyHtml,
        })

        try {
          const result = await resend.emails.send({
            from: `${template.from_name} <${template.from_email}>`,
            to: recipient.email,
            subject,
            html,
            headers: {
              'X-Idempotency-Key': recipient.idempotency_key,
            },
          })

          // Resend SDK returns { data, error } — throw if error so catch block handles it
          if (result.error) {
            throw new Error(result.error.message ?? JSON.stringify(result.error))
          }

          const msgId = result.data?.id ?? null

          db.prepare(
            `UPDATE recipients SET status = 'sent', resend_message_id = ?, sent_at = datetime('now'),
             attempt_count = attempt_count + 1, updated_at = datetime('now') WHERE id = ?`
          ).run(msgId, recipient.id)

          // If this was a retry (attempt_count > 0), decrement failed_count
          db.prepare(
            `UPDATE campaigns SET sent_count = sent_count + 1,
             failed_count = MAX(0, failed_count - CASE WHEN ? > 0 THEN 1 ELSE 0 END)
             WHERE id = ?`
          ).run(recipient.attempt_count, campaignId)

          // Log attempt
          db.prepare(
            `INSERT INTO send_attempts_log (id, recipient_id, campaign_id, attempt_number, status, resend_message_id)
             VALUES (?, ?, ?, ?, 'success', ?)`
          ).run(uuidv4(), recipient.id, campaignId, recipient.attempt_count + 1, msgId)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          const newCount = recipient.attempt_count + 1
          const finalStatus: RecipientStatus = newCount >= MAX_RETRIES ? 'failed' : 'pending'

          db.prepare(
            `UPDATE recipients SET status = ?, last_error = ?, attempt_count = ?,
             updated_at = datetime('now') WHERE id = ?`
          ).run(finalStatus, errMsg, newCount, recipient.id)

          if (finalStatus === 'failed') {
            db.prepare(
              `UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?`
            ).run(campaignId)
          }

          db.prepare(
            `INSERT INTO send_attempts_log (id, recipient_id, campaign_id, attempt_number, status, error_message)
             VALUES (?, ?, ?, ?, 'failed', ?)`
          ).run(uuidv4(), recipient.id, campaignId, newCount, errMsg)
        }
      }

      if (!controller.abort) {
        await sleep(BATCH_DELAY_MS)
      }
    }
  } finally {
    runningWorkers.delete(campaignId)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
