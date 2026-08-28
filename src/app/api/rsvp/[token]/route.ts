import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { searchParams } = new URL(request.url)
  const response = searchParams.get('r') // 'yes' | 'no'

  if (!response || !['yes', 'no'].includes(response)) {
    return new NextResponse('Invalid response', { status: 400 })
  }

  const db = getDb()

  const recipient = db
    .prepare('SELECT * FROM recipients WHERE rsvp_token = ?')
    .get(token) as { id: string; rsvp_response: string | null; email: string } | undefined

  if (!recipient) {
    return new NextResponse('Invalid or expired link', { status: 404 })
  }

  // Already responded — redirect to confirmed page anyway
  if (recipient.rsvp_response) {
    return NextResponse.redirect(
      new URL(`/rsvp/${token}/confirmed?r=${recipient.rsvp_response}&already=1`, request.url)
    )
  }

  // Record the response
  db.prepare(
    `UPDATE recipients SET rsvp_response = ?, rsvp_at = datetime('now'), updated_at = datetime('now') WHERE rsvp_token = ?`
  ).run(response, token)

  // Redirect to thank-you page
  return NextResponse.redirect(
    new URL(`/rsvp/${token}/confirmed?r=${response}`, request.url)
  )
}
