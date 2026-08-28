import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'

function getBaseUrl(request: NextRequest): string {
  // Try forwarded headers first (set by nginx)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  // Try env var
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '')

  // Read .env file directly as last resort
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

  const baseUrl = getBaseUrl(request)

  // Already responded — redirect to confirmed page anyway
  if (recipient.rsvp_response) {
    return NextResponse.redirect(
      `${baseUrl}/rsvp/${token}/confirmed?r=${recipient.rsvp_response}&already=1`
    )
  }

  // Record the response
  db.prepare(
    `UPDATE recipients SET rsvp_response = ?, rsvp_at = datetime('now'), updated_at = datetime('now') WHERE rsvp_token = ?`
  ).run(response, token)

  // Redirect to thank-you page
  return NextResponse.redirect(`${baseUrl}/rsvp/${token}/confirmed?r=${response}`)
}
