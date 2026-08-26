'use client'

import type { Contact } from '@/types'
import { format } from 'date-fns'
import { useState } from 'react'

interface Props {
  contacts: Contact[]
  loading: boolean
  onRefresh: () => void
}

interface EditForm {
  email: string
  name: string
  group_tags: string
}

export default function ContactsTable({ contacts, loading, onRefresh }: Props) {
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<EditForm>({ email: '', name: '', group_tags: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({
      email: c.email,
      name: c.name ?? '',
      group_tags: c.group_tags ?? '',
    })
    setError('')
  }

  async function saveEdit() {
    if (!form.email.trim()) { setError('Email is required'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/contacts/${editing!.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email.trim(),
        name: form.name.trim(),
        group_tags: form.group_tags.trim(),
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(null)
      onRefresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    }
  }

  async function toggleSuppress(contact: Contact) {
    const action = contact.is_suppressed ? 'unsuppress' : 'suppress'
    await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: 'manual' }),
    })
    onRefresh()
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-sm">No contacts found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{c.email}</td>
                <td className="px-4 py-3 text-gray-600">{c.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {c.group_tags
                    ? c.group_tags.split(',').filter(Boolean).map(t => (
                      <span key={t} className="inline-block mr-1 mb-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                        {t.trim()}
                      </span>
                    ))
                    : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {c.is_suppressed
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Suppressed</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Active</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {format(new Date(c.created_at), 'd MMM yyyy')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs text-indigo-600 hover:underline transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleSuppress(c)}
                      className="text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                    >
                      {c.is_suppressed ? 'Unsuppress' : 'Suppress'}
                    </button>
                    <button
                      onClick={() => deleteContact(c.id)}
                      className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Edit Contact</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags</label>
                <input
                  type="text"
                  value={form.group_tags}
                  onChange={e => setForm(f => ({ ...f, group_tags: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="tag1,tag2,tag3"
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated tags</p>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
