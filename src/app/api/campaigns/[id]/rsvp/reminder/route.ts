import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { renderTemplate, wrapEmailHtml } from '@/lib/templates'
import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { join } from 'path'

function getBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  try {
    const envFile = readFileSync(join(process.cwd(), '.env'), 'utf8')
    for (const line of envFile.split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0) {
        const key = line.slice(0, eq).trim()
        const val = line.slice(eq + 1).trim()
        if (key === 'APP_BASE_URL' && val) return val.replace(/\/$/, '')
        if (key === 'NEXTAUTH_URL' && val) return val.replace(/\/$/, '')
      }
    }
  } catch {}
  return 'http://localhost:3000'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { reminderText } = await request.json()

  const db = getDb()

  // Get campaign + template
  const campaign = db.prepare(`
    SELECT c.*, t.subject, t.body_html, t.from_name, t.from_email, t.variables
    FROM campaigns c
    JOIN templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(id) as {
    id: string; name: string; subject: string; body_html: string
    from_name: string; from_email: string; variables: string | null
  } | undefined

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Get recipients with no RSVP response (excluding 'no')
  const recipients = db.prepare(`
    SELECT * FROM recipients
    WHERE campaign_id = ? AND rsvp_response IS NULL AND status NOT IN ('pending', 'sending')
  `).all(id) as {
    id: string; email: string; name: string | null; extra_data: string | null
    rsvp_token: string | null; idempotency_key: string
  }[]

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No recipients without RSVP response' })
  }

  // Get campaign variables
  const vars = db.prepare(
    'SELECT variable_name, variable_value FROM campaign_variables WHERE campaign_id = ?'
  ).all(id) as { variable_name: string; variable_value: string }[]
  const variableMap: Record<string, string> = {}
  for (const v of vars) variableMap[v.variable_name] = v.variable_value

  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = getBaseUrl()

  // Build reminder prefix HTML
  const reminderHtml = reminderText
    ? `<div style="background:#FEF9C3;border:1px solid #FDE047;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:#713F12;">
        <strong>📢 Pengingat:</strong> ${reminderText}
       </div>`
    : ''

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const recipient of recipients) {
    try {
      const extra: Record<string, string> = recipient.extra_data
        ? JSON.parse(recipient.extra_data) : {}

      const rsvpBase = recipient.rsvp_token
        ? `${baseUrl}/rsvp/${recipient.rsvp_token}`
        : ''

      const mergedVars: Record<string, string> = {
        ...variableMap,
        name: recipient.name ?? '',
        email: recipient.email,
        ...extra,
        rsvp_yes_link: rsvpBase ? `${rsvpBase}?r=yes` : '',
        rsvp_no_link: rsvpBase ? `${rsvpBase}?r=no` : '',
      }

      const subject = renderTemplate(campaign.subject, mergedVars)
      const bodyHtml = reminderHtml + renderTemplate(campaign.body_html, mergedVars)
      const html = wrapEmailHtml({
        subject,
        fromName: campaign.from_name,
        fromEmail: campaign.from_email,
        bodyHtml,
      })

      const result = await resend.emails.send({
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: recipient.email,
        subject: `[Reminder] ${subject}`,
        html,
      })

      if (result.error) throw new Error(result.error.message ?? JSON.stringify(result.error))
      sent++

      // Small delay between sends
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      failed++
      errors.push(`${recipient.email}: ${String(e)}`)
    }
  }

  return NextResponse.json({ sent, failed, errors: errors.slice(0, 10) })
}
