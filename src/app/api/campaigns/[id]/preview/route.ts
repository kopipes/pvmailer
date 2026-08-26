import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { renderTemplate, wrapEmailHtml } from '@/lib/templates'
import type { Campaign, Recipient } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  // Optional: preview for a specific recipient id, otherwise use first recipient
  const recipientId = searchParams.get('recipient_id')

  const db = getDb()

  const campaign = db
    .prepare('SELECT * FROM campaigns WHERE id = ?')
    .get(id) as Campaign | undefined
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const template = db
    .prepare('SELECT * FROM templates WHERE id = ?')
    .get(campaign.template_id) as {
      subject: string; body_html: string; from_name: string; from_email: string
    } | undefined
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Get campaign variables
  const vars = db
    .prepare('SELECT variable_name, variable_value FROM campaign_variables WHERE campaign_id = ?')
    .all(id) as { variable_name: string; variable_value: string }[]
  const variableMap: Record<string, string> = {}
  for (const v of vars) variableMap[v.variable_name] = v.variable_value

  // Get a recipient for per-contact variable substitution
  const recipient = (recipientId
    ? db.prepare('SELECT * FROM recipients WHERE id = ? AND campaign_id = ?').get(recipientId, id)
    : db.prepare('SELECT * FROM recipients WHERE campaign_id = ? LIMIT 1').get(id)
  ) as Recipient | undefined

  const extra: Record<string, string> = recipient?.extra_data
    ? JSON.parse(recipient.extra_data)
    : {}

  const mergedVars: Record<string, string> = {
    ...variableMap,
    name: recipient?.name ?? 'John Doe',
    email: recipient?.email ?? 'recipient@example.com',
    ...extra,
  }

  const subject = renderTemplate(template.subject, mergedVars)
  const bodyHtml = renderTemplate(template.body_html, mergedVars)
  const html = wrapEmailHtml({
    subject,
    fromName: template.from_name,
    fromEmail: template.from_email,
    bodyHtml,
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
