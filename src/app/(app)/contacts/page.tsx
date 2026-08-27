'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Contact, PaginatedResult } from '@/types'
import ContactsTable from '@/components/contacts/ContactsTable'
import UploadModal from '@/components/contacts/UploadModal'
import { Users, Upload, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface AddForm {
  email: string
  name: string
  group_tags: string
}

export default function ContactsPage() {
  const [result, setResult] = useState<PaginatedResult<Contact> | null>(null)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>({ email: '', name: '', group_tags: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '50', search, tag })
    const res = await fetch(`/api/contacts?${params}`)
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }, [page, search, tag])

  useEffect(() => {
    fetch('/api/contacts?tags=1').then(r => r.json()).then(setTags)
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  function openAdd() {
    setAddForm({ email: '', name: '', group_tags: '' })
    setAddError('')
    setShowAdd(true)
  }

  async function saveAdd() {
    if (!addForm.email.trim()) { setAddError('Email is required'); return }
    if (!addForm.email.includes('@')) { setAddError('Invalid email address'); return }
    setAddSaving(true)
    setAddError('')
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addForm.email.trim(), name: addForm.name.trim(), group_tags: addForm.group_tags.trim() }),
    })
    setAddSaving(false)
    if (res.ok) {
      setShowAdd(false)
      fetchContacts()
      fetch('/api/contacts?tags=1').then(r => r.json()).then(setTags)
    } else {
      const d = await res.json()
      setAddError(d.error ?? 'Failed to add contact')
    }
  }

  const totalPages = result ? Math.ceil(result.total / 50) : 1

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {result ? `${result.total.toLocaleString()} contacts` : '…'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg shadow-sm transition-colors">
            <Plus size={15} />
            Add Contact
          </button>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium rounded-lg shadow-sm transition-all">
            <Upload size={15} />
            Import Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search email or name…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select value={tag} onChange={e => { setTag(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <ContactsTable contacts={result?.data ?? []} loading={loading} onRefresh={fetchContacts} />

      {result && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-lg disabled:opacity-40 hover:bg-gray-50 shadow-sm">
              <ChevronLeft size={14} /> Previous
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-lg disabled:opacity-40 hover:bg-gray-50 shadow-sm">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchContacts() }} />
      )}

      {/* Add Contact Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Users size={16} className="text-indigo-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Add Contact</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input autoFocus type="email" value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setShowAdd(false) }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
                <input type="text" value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tags</label>
                <input type="text" value={addForm.group_tags}
                  onChange={e => setAddForm(f => ({ ...f, group_tags: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="tag1,tag2" />
                <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
              </div>
            </div>
            {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{addError}</p>}
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveAdd} disabled={addSaving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all">
                {addSaving ? 'Adding…' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
