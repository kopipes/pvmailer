import { getDb } from './db'
import { v4 as uuidv4 } from 'uuid'
import type { Template, PaginatedResult } from '@/types'

export function getTemplates(page = 1, pageSize = 20, search = ''): PaginatedResult<Template> {
  const db = getDb()
  const offset = (page - 1) * pageSize
  const where = search ? 'WHERE name LIKE ? OR subject LIKE ?' : ''
  const params = search ? [`%${search}%`, `%${search}%`] : []

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM templates ${where}`).get(...params) as { c: number }
  ).c

  const data = db
    .prepare(`SELECT * FROM templates ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as Template[]

  return { data, total, page, pageSize }
}

export function getTemplateById(id: string): Template | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Template | undefined
}

export function createTemplate(data: {
  name: string
  subject: string
  body_html: string
  variables?: string[]
  from_name: string
  from_email: string
}): Template {
  const db = getDb()
  const id = uuidv4()
  const variables = data.variables ? JSON.stringify(data.variables) : null
  db.prepare(
    `INSERT INTO templates (id, name, subject, body_html, variables, from_name, from_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.subject, data.body_html, variables, data.from_name, data.from_email)
  return getTemplateById(id)!
}

export function updateTemplate(
  id: string,
  data: Partial<{
    name: string
    subject: string
    body_html: string
    variables: string[]
    from_name: string
    from_email: string
  }>
): Template {
  const db = getDb()
  const existing = getTemplateById(id)
  if (!existing) throw new Error('Template not found')

  const merged = {
    name: data.name ?? existing.name,
    subject: data.subject ?? existing.subject,
    body_html: data.body_html ?? existing.body_html,
    variables: data.variables !== undefined ? JSON.stringify(data.variables) : existing.variables,
    from_name: data.from_name ?? existing.from_name,
    from_email: data.from_email ?? existing.from_email,
  }

  db.prepare(
    `UPDATE templates SET name=?, subject=?, body_html=?, variables=?, from_name=?, from_email=?, updated_at=datetime('now') WHERE id=?`
  ).run(merged.name, merged.subject, merged.body_html, merged.variables, merged.from_name, merged.from_email, id)

  return getTemplateById(id)!
}

export function deleteTemplate(id: string) {
  const db = getDb()
  db.prepare('DELETE FROM templates WHERE id = ?').run(id)
}

/** Extract {{variable}} names from template body and subject */
export function extractVariables(text: string): string[] {
  const matches = text.matchAll(/\{\{(\w+)\}\}/g)
  const vars = new Set<string>()
  for (const m of matches) vars.add(m[1])
  return Array.from(vars)
}

/** Replace {{variable}} in text with values map */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

/**
 * Wrap a body_html fragment in a full, styled email shell.
 * Used both when sending via Resend and in the template editor preview.
 * All styles are inlined so they survive email client stripping.
 */
export function wrapEmailHtml(opts: {
  subject: string
  fromName: string
  fromEmail: string
  bodyHtml: string
}): string {
  const { subject, fromName, fromEmail, bodyHtml } = opts
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#111827;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F3F4F6;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;">

          <!-- Sender meta bar -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #E5E7EB;border-radius:12px 12px 0 0;border-bottom:none;padding:16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:1px solid #F3F4F6;">
                    <span style="font-size:15px;font-weight:700;color:#111827;">${subject || '(no subject)'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;">
                    <span style="font-size:13px;font-weight:600;color:#374151;">From&nbsp;&nbsp;</span>
                    <span style="font-size:13px;color:#6B7280;">${fromName} &lt;${fromEmail}&gt;</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
              <div style="padding:16px 28px 28px 28px;font-size:15px;line-height:1.7;color:#111827;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Seed 2 sample templates on first run */
export function seedSampleTemplates() {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c
  if (count > 0) return

  const samples = [
    {
      name: 'Event Invitation',
      subject: 'You\'re Invited: {{event_name}} on {{event_date}}',
      from_name: 'Events Team',
      from_email: 'no-reply@provaliantgroup.com',
      body_html: `<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
  <div style="background: #4F46E5; padding: 32px 40px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">{{event_name}}</h1>
    <p style="color: #C7D2FE; margin: 8px 0 0; font-size: 15px;">You're invited!</p>
  </div>
  <div style="background: white; padding: 32px 40px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Dear <strong>{{name}}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.6;">We are pleased to invite you to <strong>{{event_name}}</strong>, taking place on <strong>{{event_date}}</strong> at <strong>{{event_location}}</strong>.</p>
    <p style="font-size: 15px; line-height: 1.6;">{{event_description}}</p>
    <div style="margin: 28px 0; padding: 20px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #4F46E5;">
      <p style="margin: 0 0 6px; font-size: 14px; color: #6B7280;">Date &amp; Time</p>
      <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827;">{{event_date}}</p>
      <p style="margin: 6px 0 0; font-size: 14px; color: #6B7280;">Location</p>
      <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827;">{{event_location}}</p>
    </div>
    <p style="font-size: 15px; line-height: 1.6;">Please confirm your attendance by replying to this email or contacting us at <a href="mailto:{{reply_to}}" style="color: #4F46E5;">{{reply_to}}</a>.</p>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 0;">We look forward to seeing you there!</p>
    <p style="font-size: 15px; margin-top: 24px; margin-bottom: 0;">Best regards,<br><strong>{{sender_name}}</strong></p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 16px;">This invitation was sent to {{email}}.</p>
</div>`,
    },
    {
      name: 'Client Follow-Up',
      subject: 'Following Up: {{topic}}',
      from_name: 'Account Team',
      from_email: 'no-reply@provaliantgroup.com',
      body_html: `<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
  <div style="padding: 32px 40px 24px; border-bottom: 2px solid #4F46E5;">
    <span style="font-size: 20px; font-weight: 700; color: #4F46E5;">PVMailer</span>
  </div>
  <div style="padding: 32px 40px;">
    <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Hi <strong>{{name}}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.6;">I hope this message finds you well. I'm following up regarding <strong>{{topic}}</strong>.</p>
    <p style="font-size: 15px; line-height: 1.6;">{{message_body}}</p>
    <p style="font-size: 15px; line-height: 1.6;">If you have any questions or need further information, please don't hesitate to reach out. I'm happy to arrange a call at your convenience.</p>
    <div style="margin: 28px 0;">
      <a href="mailto:{{reply_to}}" style="display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Reply to this email</a>
    </div>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 0;">Looking forward to hearing from you.</p>
    <p style="font-size: 15px; margin-top: 24px; margin-bottom: 0;">
      Warm regards,<br>
      <strong>{{sender_name}}</strong><br>
      <span style="color: #6B7280; font-size: 14px;">{{sender_title}} · {{company_name}}</span>
    </p>
  </div>
  <div style="padding: 16px 40px; background: #F9FAFB; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
    <p style="font-size: 12px; color: #9CA3AF; margin: 0; text-align: center;">This email was sent to {{email}}. If you have questions, contact us at {{reply_to}}.</p>
  </div>
</div>`,
    },
  ]

  for (const s of samples) {
    const variables = extractVariables(`${s.subject} ${s.body_html}`)
    createTemplate({ ...s, variables })
  }
}

