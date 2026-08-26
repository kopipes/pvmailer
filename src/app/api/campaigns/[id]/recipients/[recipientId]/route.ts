import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateRecipient } from '@/lib/campaigns'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipientId } = await params
  const body = await request.json()

  if (!body.email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!body.email.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  try {
    updateRecipient(recipientId, { email: body.email, name: body.name })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
