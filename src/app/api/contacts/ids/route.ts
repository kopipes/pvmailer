import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const tag = searchParams.get('tag') ?? ''

  const db = getDb()
  const conditions: string[] = ['is_suppressed = 0']
  const params: (string | number)[] = []

  if (search) {
    conditions.push('(email LIKE ? OR name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (tag) {
    conditions.push("(',' || group_tags || ',' LIKE ?)")
    params.push(`%,${tag},%`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const rows = db
    .prepare(`SELECT id FROM contacts ${where} ORDER BY created_at DESC`)
    .all(...params) as { id: string }[]

  return NextResponse.json(rows.map(r => r.id))
}
