import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()

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
    `SELECT email, name, rsvp_response, rsvp_at FROM recipients WHERE campaign_id = ? AND rsvp_response IS NOT NULL ORDER BY rsvp_at DESC`
  ).all(id) as { email: string; name: string | null; rsvp_response: string; rsvp_at: string }[]

  return NextResponse.json({ yes, no, pending, responses })
}
