import { getDb } from './db'
import { v4 as uuidv4 } from 'uuid'
import type { Contact, PaginatedResult } from '@/types'

export function getContacts(
  page = 1,
  pageSize = 50,
  search = '',
  tag = '',
  suppressed?: boolean
): PaginatedResult<Contact> {
  const db = getDb()
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('(email LIKE ? OR name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (tag) {
    conditions.push("(',' || group_tags || ',' LIKE ?)")
    params.push(`%,${tag},%`)
  }
  if (suppressed !== undefined) {
    conditions.push('is_suppressed = ?')
    params.push(suppressed ? 1 : 0)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM contacts ${where}`).get(...params) as { c: number }
  ).c

  const data = db
    .prepare(`SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as Contact[]

  return { data, total, page, pageSize }
}

export function getContactById(id: string): Contact | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact | undefined
}

export function getContactByEmail(email: string): Contact | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM contacts WHERE email = ?').get(email) as Contact | undefined
}

export function upsertContact(data: {
  email: string
  name?: string
  extra_data?: string
  group_tags?: string
}): Contact {
  const db = getDb()
  const existing = getContactByEmail(data.email)
  if (existing) {
    db.prepare(
      `UPDATE contacts SET name = ?, extra_data = ?, group_tags = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(data.name ?? existing.name, data.extra_data ?? existing.extra_data, data.group_tags ?? existing.group_tags, existing.id)
    return getContactById(existing.id)!
  }
  const id = uuidv4()
  db.prepare(
    `INSERT INTO contacts (id, email, name, extra_data, group_tags) VALUES (?, ?, ?, ?, ?)`
  ).run(id, data.email, data.name ?? null, data.extra_data ?? null, data.group_tags ?? null)
  return getContactById(id)!
}

export function suppressContact(id: string, reason: string) {
  const db = getDb()
  db.prepare(
    `UPDATE contacts SET is_suppressed = 1, suppression_reason = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(reason, id)
}

export function unsuppressContact(id: string) {
  const db = getDb()
  db.prepare(
    `UPDATE contacts SET is_suppressed = 0, suppression_reason = NULL, updated_at = datetime('now') WHERE id = ?`
  ).run(id)
}

export function deleteContact(id: string) {
  const db = getDb()
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id)
}

export function updateContact(id: string, data: {
  email?: string
  name?: string
  group_tags?: string
}): Contact {
  const db = getDb()
  const existing = getContactById(id)
  if (!existing) throw new Error('Contact not found')
  db.prepare(
    `UPDATE contacts SET email = ?, name = ?, group_tags = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    data.email ?? existing.email,
    data.name !== undefined ? (data.name || null) : existing.name,
    data.group_tags !== undefined ? (data.group_tags || null) : existing.group_tags,
    id
  )
  return getContactById(id)!
}

export function getAllTags(): string[] {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT group_tags FROM contacts WHERE group_tags IS NOT NULL').all() as { group_tags: string }[]
  const tagSet = new Set<string>()
  for (const row of rows) {
    for (const t of row.group_tags.split(',')) {
      const trimmed = t.trim()
      if (trimmed) tagSet.add(trimmed)
    }
  }
  return Array.from(tagSet).sort()
}

export function bulkImportContacts(
  rows: Array<{ email: string; name?: string; extra_data?: string; group_tags?: string }>
): { imported: number; skipped: number; errors: string[] } {
  const db = getDb()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  type ImportRow = { email: string; name?: string; extra_data?: string; group_tags?: string }
  const insertOrUpdate = db.transaction((rows: ImportRow[]) => {
    for (const row of rows) {
      if (!row.email || !row.email.includes('@')) {
        errors.push(`Invalid email: ${row.email}`)
        skipped++
        continue
      }
      try {
        upsertContact(row)
        imported++
      } catch (e) {
        errors.push(`Error importing ${row.email}: ${String(e)}`)
        skipped++
      }
    }
  })

  insertOrUpdate(rows)
  return { imported, skipped, errors }
}
