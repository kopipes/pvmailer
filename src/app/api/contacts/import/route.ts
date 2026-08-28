import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { bulkImportContacts } from '@/lib/contacts'
import ExcelJS from 'exceljs'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const mappingRaw = formData.get('mapping') as string | null
  const groupTag = formData.get('groupTag') as string | null
  const extraColumnsRaw = formData.get('extraColumns') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!mappingRaw) return NextResponse.json({ error: 'No column mapping provided' }, { status: 400 })

  const mapping: Record<string, string> = JSON.parse(mappingRaw)
  // extraColumns: { variableName -> columnHeader } — only included columns
  const extraColumns: Record<string, string> = extraColumnsRaw ? JSON.parse(extraColumnsRaw) : {}

  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return NextResponse.json({ error: 'Empty workbook' }, { status: 400 })

  const headerRow = worksheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell) => {
    headers.push(String(cell.value ?? '').trim())
  })

  const emailCol = headers.indexOf(mapping.email)
  if (emailCol === -1) {
    return NextResponse.json({ error: `Email column "${mapping.email}" not found` }, { status: 400 })
  }

  const nameCol = mapping.name ? headers.indexOf(mapping.name) : -1

  // Build reverse map: columnHeader -> variableName for included extra columns
  // extraColumns format: { variableName -> columnHeader }
  const extraColMap: Record<string, string> = {} // columnHeader -> variableName
  // Always respect extraColumns if provided (even if empty = user skipped all extras)
  // Only use legacy fallback if extraColumns was NOT sent at all (null)
  if (extraColumnsRaw !== null) {
    Object.entries(extraColumns).forEach(([varName, colHeader]) => {
      extraColMap[colHeader] = varName
    })
  } else {
    // Legacy: no extraColumns sent — include all non-email/name columns as-is
    headers.forEach((h, i) => {
      if (i !== emailCol && i !== nameCol) extraColMap[h] = h
    })
  }

  const rows: Array<{ email: string; name?: string; extra_data?: string; group_tags?: string }> = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = row.values as (string | number | null | undefined | { text?: string; hyperlink?: string })[]

    // Helper to extract string value from a cell (handles hyperlink objects)
    function cellStr(val: typeof values[number]): string {
      if (val === null || val === undefined) return ''
      if (typeof val === 'object' && 'text' in val) return String(val.text ?? '').trim()
      return String(val).trim()
    }

    const email = cellStr(values[emailCol + 1])
    if (!email) return

    const name = nameCol >= 0 ? String(values[nameCol + 1] ?? '').trim() || undefined : undefined

    const extra: Record<string, string> = {}
    headers.forEach((h, i) => {
      const varName = extraColMap[h]
      if (!varName) return
      const val = String(values[i + 1] ?? '').trim()
      if (val) extra[varName] = val
    })

    rows.push({
      email,
      name,
      extra_data: Object.keys(extra).length ? JSON.stringify(extra) : undefined,
      group_tags: groupTag || undefined,
    })
  })

  const result = bulkImportContacts(rows)
  return NextResponse.json(result)
}
