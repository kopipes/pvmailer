import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  // Get all contacts with extra_data, collect unique variable keys + a sample value
  const rows = db
    .prepare(`SELECT extra_data FROM contacts WHERE extra_data IS NOT NULL LIMIT 500`)
    .all() as { extra_data: string }[]

  const varMap: Record<string, string> = {} // key -> sample value

  for (const row of rows) {
    try {
      const data = JSON.parse(row.extra_data)
      for (const [k, v] of Object.entries(data)) {
        if (!varMap[k] && v) varMap[k] = String(v)
      }
    } catch {}
  }

  return NextResponse.json(varMap)
}
