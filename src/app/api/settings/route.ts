import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserByEmail, updateUser } from '@/lib/auth-helpers'

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = getUserByEmail(session.user?.email ?? '')
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Never return password_hash
  const { password_hash: _ph, ...safeUser } = user as typeof user & { password_hash: string }
  void _ph
  return NextResponse.json(safeUser)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = getUserByEmail(session.user?.email ?? '')
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  try {
    const updated = await updateUser(user.id, {
      name: body.name,
      email: body.email,
      password: body.password || undefined,
      division_id: body.division_id,
    })
    const { password_hash: _ph2, ...safeUser } = updated as typeof updated & { password_hash: string }
    void _ph2
    return NextResponse.json(safeUser)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
