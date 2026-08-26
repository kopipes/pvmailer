import { NextRequest, NextResponse } from 'next/server'
import { processResendWebhook } from '@/lib/webhooks'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify Resend webhook signature if secret is configured
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    const signature = request.headers.get('svix-signature') ?? ''
    const msgId = request.headers.get('svix-id') ?? ''
    const msgTimestamp = request.headers.get('svix-timestamp') ?? ''

    const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`
    const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64')
    const expectedSig = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')

    const sigMatches = signature
      .split(' ')
      .some((s) => s.replace(/^v1,/, '') === expectedSig)

    if (!sigMatches) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  try {
    const payload = JSON.parse(rawBody)
    processResendWebhook(payload)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
