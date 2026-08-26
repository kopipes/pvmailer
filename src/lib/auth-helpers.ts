import { getDb } from './db'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import type { User } from '@/types'

export interface UserWithDivision extends User {
  division_name: string | null
}

export function getUsers(): UserWithDivision[] {
  const db = getDb()
  return db.prepare(
    `SELECT u.*, d.name as division_name
     FROM users u
     LEFT JOIN divisions d ON u.division_id = d.id
     ORDER BY u.created_at ASC`
  ).all() as UserWithDivision[]
}

export function getUserByEmail(email: string): User | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined
}

export function getUserById(id: string): User | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
}

export async function createUser(data: {
  email: string
  password: string
  name: string
  role?: string
  division_id?: string
}): Promise<User> {
  const db = getDb()
  const id = uuidv4()
  const password_hash = await bcrypt.hash(data.password, 12)
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, division_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.email, password_hash, data.name, data.role ?? 'user', data.division_id ?? null)
  return getUserById(id)!
}

export async function updateUser(id: string, data: {
  name?: string
  email?: string
  password?: string
  role?: string
  division_id?: string | null
}): Promise<User> {
  const db = getDb()
  const existing = getUserById(id)
  if (!existing) throw new Error('User not found')

  const password_hash = data.password
    ? await bcrypt.hash(data.password, 12)
    : existing.password_hash

  db.prepare(
    `UPDATE users SET name=?, email=?, password_hash=?, role=?, division_id=? WHERE id=?`
  ).run(
    data.name ?? existing.name,
    data.email ?? existing.email,
    password_hash,
    data.role ?? (existing as unknown as { role: string }).role ?? 'user',
    data.division_id !== undefined ? data.division_id : (existing as unknown as { division_id: string | null }).division_id,
    id
  )
  return getUserById(id)!
}

export function deleteUser(id: string) {
  const db = getDb()
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function ensureDefaultUser() {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
  if (count === 0) {
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@pvmailer.local'
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123'
    await createUser({ email, password, name: 'Admin', role: 'admin' })
  }
}
