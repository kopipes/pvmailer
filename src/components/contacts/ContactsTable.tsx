'use client'

import type { Contact } from '@/types'
import { format } from 'date-fns'
import { useState } from 'react'
import { Pencil, ShieldOff, Shield, Trash2, CheckSquare, Square } from 'lucide-react'

interface Props {
  contacts: Contact[]
  loading: boolean
  onRefresh: () => void
}

interface EditForm { email: string; name: string; group_tags: string }

export default function ContactsTable({ contacts, loading, onRefresh }: Props) {
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<EditForm>({ email: '', name: '', group_tags: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const allSelected = contacts.length > 0 && contacts.every(c => selected.has(c.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map(c => c.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} contact${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkDeleting(true)
    await fetch('/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    setBulkDeleting(false)
    setSelected(new Set())
    onRefresh()
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ email: c.email, name: c.name ?? '', group_tags: c.group_tags ?? '' })
    setError('')
  }

  async function saveEdit() {
    if (!form.email.trim()) { setError('Email is required'); return }
    setSaving(true); setError('')
    const res = await fetch(`/api/contacts/${editing!.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.trim(), name: form.name.trim(), group_tags: form.group_tags.trim() }),
    })
    setSaving(false)
    if (res.ok) { setEditing(null); onRefresh() }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
  }

  async function toggleSuppress(c: Contact) {
    await fetch(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: c.is_suppressed ? 'unsuppress' : 'suppress', reason: 'manual' }),
    })
    onRefresh()
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    onRefresh()
  }

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
      <div className="text-sm text-gray-400">Loading…</div>
    </div>
  )

  if (contacts.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <span className="text-xl">👥</span>
      </div>
      <p className="text-sm font-medium text-gray-600">No contacts found</p>
      <p className="text-xs text-gray-400 mt-1">Import from Excel or add manually</p>
    </div>
  )

  return (
    <>
      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} contact{selected.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors">
              Clear
            </button>
            <button onClick={bulkDelete} disabled={bulkDeleting}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors">
              <Trash2 size={12} />
              {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 w-10">
                <button onClick={toggleAll}
                  className={`transition-colors ${allSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}>
                  {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tags</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Variables</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Added</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {contacts.map((c) => {
              const isSelected = selected.has(c.id)
              return (
                <tr key={c.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                  <td className="px-4 py-3.5">
                    <button onClick={() => toggleOne(c.id)}
                      className={`transition-colors ${isSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{c.email}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5">
                    {c.group_tags
                      ? c.group_tags.split(',').filter(Boolean).map(t => (
                        <span key={t} className="inline-block mr-1 mb-0.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-md">
                          {t.trim()}
                        </span>
                      ))
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    {(() => {
                      const extra = c.extra_data ? (() => { try { return JSON.parse(c.extra_data) } catch { return {} } })() : {}
                      const keys = Object.keys(extra)
                      if (!keys.length) return <span className="text-gray-300 text-xs">—</span>
                      return (
                        <div className="space-y-0.5">
                          {keys.slice(0, 3).map(k => (
                            <div key={k} className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-400 font-mono shrink-0">{k}:</span>
                              <span className="text-gray-700 truncate max-w-[120px]" title={extra[k]}>{extra[k]}</span>
                            </div>
                          ))}
                          {keys.length > 3 && <span className="text-xs text-gray-400">+{keys.length - 3} more</span>}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.is_suppressed
                      ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Suppressed
                        </span>
                      : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active
                        </span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{format(new Date(c.created_at), 'd MMM yyyy')}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(c)} title="Edit"
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => toggleSuppress(c)} title={c.is_suppressed ? 'Unsuppress' : 'Suppress'}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors">
                        {c.is_suppressed ? <Shield size={13} /> : <ShieldOff size={13} />}
                      </button>
                      <button onClick={() => deleteContact(c.id)} title="Delete"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Edit Contact</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tags</label>
                <input type="text" value={form.group_tags} onChange={e => setForm(f => ({ ...f, group_tags: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="tag1,tag2" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
            {/* Show extra_data variables read-only */}
            {(() => {
              const extra = editing?.extra_data ? (() => { try { return JSON.parse(editing.extra_data) } catch { return {} } })() : {}
              const keys = Object.keys(extra)
              if (!keys.length) return null
              return (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">Variables from import</p>
                  <div className="space-y-1.5">
                    {keys.map(k => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded shrink-0">{`{{${k}}}`}</span>
                        <span className="text-gray-500 truncate">{extra[k]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setEditing(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg active:scale-[0.98] transition-all">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
