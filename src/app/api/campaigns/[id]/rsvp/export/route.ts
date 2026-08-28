import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'
import ExcelJS from 'exceljs'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()

  const campaign = db.prepare('SELECT name FROM campaigns WHERE id = ?').get(id) as { name: string } | undefined
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rows = db.prepare(`
    SELECT
      r.email,
      r.name,
      CASE WHEN r.rsvp_response = 'yes' THEN 'Hadir'
           WHEN r.rsvp_response = 'no'  THEN 'Tidak Hadir'
           ELSE 'Belum Konfirmasi'
      END as response,
      r.rsvp_at,
      r.status as email_status
    FROM recipients r
    WHERE r.campaign_id = ?
    ORDER BY
      CASE r.rsvp_response WHEN 'yes' THEN 1 WHEN 'no' THEN 2 ELSE 3 END,
      r.rsvp_at ASC NULLS LAST
  `).all(id) as {
    email: string
    name: string | null
    response: string
    rsvp_at: string | null
    email_status: string
  }[]

  const wb = new ExcelJS.Workbook()
  wb.creator = 'PVMailer'
  wb.created = new Date()

  const ws = wb.addWorksheet('RSVP')

  // Header row
  ws.columns = [
    { header: 'No',            key: 'no',           width: 6  },
    { header: 'Email',         key: 'email',         width: 35 },
    { header: 'Nama',          key: 'name',          width: 30 },
    { header: 'Konfirmasi',    key: 'response',      width: 18 },
    { header: 'Waktu Konfirmasi (WIB)', key: 'rsvp_at', width: 25 },
    { header: 'Status Email',  key: 'email_status',  width: 15 },
  ]

  // Style header
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 22

  rows.forEach((r, i) => {
    // Convert UTC rsvp_at to WIB (+7)
    let rsvpDisplay = ''
    if (r.rsvp_at) {
      const iso = r.rsvp_at.replace(' ', 'T') + 'Z'
      const utc = new Date(iso)
      const wib = new Date(utc.getTime() + 7 * 60 * 60 * 1000)
      rsvpDisplay = wib.toISOString().replace('T', ' ').slice(0, 16).replace('-', '/').replace('-', '/')
    }

    const row = ws.addRow({
      no: i + 1,
      email: r.email,
      name: r.name ?? '',
      response: r.response,
      rsvp_at: rsvpDisplay,
      email_status: r.email_status,
    })

    // Color-code the response column
    const responseCell = row.getCell('response')
    if (r.response === 'Hadir') {
      responseCell.font = { color: { argb: 'FF15803D' }, bold: true }
      responseCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
    } else if (r.response === 'Tidak Hadir') {
      responseCell.font = { color: { argb: 'FFDC2626' }, bold: true }
      responseCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
    } else {
      responseCell.font = { color: { argb: 'FF6B7280' } }
    }

    row.alignment = { vertical: 'middle' }
  })

  // Auto-filter
  ws.autoFilter = { from: 'A1', to: 'F1' }

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `RSVP-${campaign.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
