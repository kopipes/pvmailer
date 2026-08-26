import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getCampaignById,
  getCampaignRecipients,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  retryFailedRecipients,
  renameCampaign,
  deleteCampaign,
  getCampaignVariables,
  updateCampaignVariables,
} from '@/lib/campaigns'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(request.url)

  if (searchParams.get('recipients') === '1') {
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50')
    const status = searchParams.get('status') ?? ''
    return NextResponse.json(getCampaignRecipients(id, page, pageSize, status))
  }

  if (searchParams.get('variables') === '1') {
    return NextResponse.json(getCampaignVariables(id))
  }

  const campaign = getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()

  try {
    switch (body.action) {
      case 'start':
        await startCampaign(id)
        break
      case 'pause':
        pauseCampaign(id)
        break
      case 'cancel':
        cancelCampaign(id)
        break
      case 'retry':
        retryFailedRecipients(id)
        await startCampaign(id)
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const body = await request.json()

  // PUT ?variables=1 — update campaign variables
  if (searchParams.get('variables') === '1') {
    try {
      updateCampaignVariables(id, body.variables ?? {})
      return NextResponse.json({ ok: true })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  // PUT — rename campaign
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  try {
    renameCampaign(id, body.name.trim())
    return NextResponse.json(getCampaignById(id))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    deleteCampaign(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
