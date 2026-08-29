import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()

  const campaign = db.prepare('SELECT rsvp_closes_at FROM campaigns WHERE id = ?').get(id) as { rsvp_closes_at: string | null } | undefined

  const yes = (db.prepare(
    `SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ? AND rsvp_response = 'yes'`
  ).get(id) as { c: number }).c

  const no = (db.prepare(
    `SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ? AND rsvp_response = 'no'`
  ).get(id) as { c: number }).c

  const pending = (db.prepare(
    `SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ? AND rsvp_response IS NULL AND status NOT IN ('pending', 'sending')`
  ).get(id) as { c: number }).c

  const responses = db.prepare(
    `SELECT id, email, name, rsvp_response, rsvp_at FROM recipients WHERE campaign_id = ? AND rsvp_response IS NOT NULL ORDER BY rsvp_at DESC`
  ).all(id) as { id: string; email: string; name: string | null; rsvp_response: string; rsvp_at: string }[]

  return NextResponse.json({ yes, no, pending, responses, rsvp_closes_at: campaign?.rsvp_closes_at ?? null })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { action } = await request.json()
  const db = getDb()

  if (action === 'close') {
    db.prepare(`UPDATE campaigns SET rsvp_closes_at = datetime('now') WHERE id = ?`).run(id)
    return NextResponse.json({ ok: true })
  }
  if (action === 'open') {
    db.prepare(`UPDATE campaigns SET rsvp_closes_at = NULL WHERE id = ?`).run(id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
