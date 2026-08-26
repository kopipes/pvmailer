import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTemplates, createTemplate, extractVariables } from '@/lib/templates'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const search = searchParams.get('search') ?? ''

  return NextResponse.json(getTemplates(page, pageSize, search))
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, subject, body_html, from_name, from_email } = body

  if (!name || !subject || !body_html || !from_name || !from_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const variables = extractVariables(`${subject} ${body_html}`)
  const template = createTemplate({ name, subject, body_html, variables, from_name, from_email })
  return NextResponse.json(template, { status: 201 })
}
