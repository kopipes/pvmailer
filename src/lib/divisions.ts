import { getDb } from './db'
import { v4 as uuidv4 } from 'uuid'

export interface Division {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export function getDivisions(): Division[] {
  const db = getDb()
  return db.prepare('SELECT * FROM divisions ORDER BY name ASC').all() as Division[]
}

export function getDivisionById(id: string): Division | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM divisions WHERE id = ?').get(id) as Division | undefined
}

export function createDivision(data: { name: string; description?: string }): Division {
  const db = getDb()
  const id = uuidv4()
  db.prepare(
    `INSERT INTO divisions (id, name, description) VALUES (?, ?, ?)`
  ).run(id, data.name, data.description ?? null)
  return getDivisionById(id)!
}

export function updateDivision(id: string, data: { name?: string; description?: string }): Division {
  const db = getDb()
  const existing = getDivisionById(id)
  if (!existing) throw new Error('Division not found')
  db.prepare(
    `UPDATE divisions SET name=?, description=?, updated_at=datetime('now') WHERE id=?`
  ).run(data.name ?? existing.name, data.description ?? existing.description, id)
  return getDivisionById(id)!
}

export function deleteDivision(id: string) {
  const db = getDb()
  // Unassign users from this division before deleting
  db.prepare(`UPDATE users SET division_id = NULL WHERE division_id = ?`).run(id)
  db.prepare('DELETE FROM divisions WHERE id = ?').run(id)
}
