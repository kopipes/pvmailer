import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getContacts, getAllTags, upsertContact } from '@/lib/contacts'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')
  const search = searchParams.get('search') ?? ''
  const tag = searchParams.get('tag') ?? ''
  const suppressedParam = searchParams.get('suppressed')
  const suppressed = suppressedParam === null ? undefined : suppressedParam === 'true'

  if (searchParams.get('tags') === '1') {
    return NextResponse.json(getAllTags())
  }

  const result = getContacts(page, pageSize, search, tag, suppressed)
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email, name, group_tags } = body

  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!email.includes('@')) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })

  try {
    const contact = upsertContact({
      email: email.trim(),
      name: name?.trim() || undefined,
      group_tags: group_tags?.trim() || undefined,
    })
    return NextResponse.json(contact, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
