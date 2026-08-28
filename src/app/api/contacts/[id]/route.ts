import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getContactById, suppressContact, unsuppressContact, deleteContact, updateContact } from '@/lib/contacts'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const contact = getContactById(id)
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  if (!body.email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  try {
    const updated = updateContact(id, {
      email: body.email.trim(),
      name: body.name ?? '',
      group_tags: body.group_tags ?? '',
      extra_data: body.extra_data !== undefined ? body.extra_data : undefined,
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()

  if (body.action === 'suppress') {
    suppressContact(id, body.reason ?? 'manual')
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'unsuppress') {
    unsuppressContact(id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  deleteContact(id)
  return NextResponse.json({ ok: true })
}
