import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/auth-helpers'

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(getUsers())
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email, password, name, role, division_id } = body
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'email, password, name required' }, { status: 400 })
  }
  try {
    const user = await createUser({ email, password, name, role, division_id })
    return NextResponse.json(user, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
