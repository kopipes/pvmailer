import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, recipientId } = await params
  const { response } = await request.json() // 'yes' | 'no' | null (null = reset)

  if (response !== null && !['yes', 'no'].includes(response)) {
    return NextResponse.json({ error: 'Invalid response' }, { status: 400 })
  }

  const db = getDb()

  const recipient = db
    .prepare('SELECT id FROM recipients WHERE id = ? AND campaign_id = ?')
    .get(recipientId, id)

  if (!recipient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (response === null) {
    // Reset — allow re-click
    db.prepare(
      `UPDATE recipients SET rsvp_response = NULL, rsvp_at = NULL, updated_at = datetime('now') WHERE id = ?`
    ).run(recipientId)
  } else {
    // Override to specific response
    db.prepare(
      `UPDATE recipients SET rsvp_response = ?, rsvp_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(response, recipientId)
  }

  return NextResponse.json({ ok: true })
}
