'use client'

import type { Contact } from '@/types'
import { format } from 'date-fns'

interface Props {
  contacts: Contact[]
  loading: boolean
  onRefresh: () => void
}

export default function ContactsTable({ contacts, loading, onRefresh }: Props) {
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
                  ? c.group_tags.split(',').map(t => (
                    <span key={t} className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full mr-1">
                      {t.trim()}
                    </span>
                  ))
                  : '—'}
              </td>
              <td className="px-4 py-3">
                {c.is_suppressed ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                    Suppressed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {format(new Date(c.created_at), 'd MMM yyyy')}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 justify-end">
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
  )
}
