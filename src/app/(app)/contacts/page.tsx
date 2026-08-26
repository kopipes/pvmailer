'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Contact, PaginatedResult } from '@/types'
import ContactsTable from '@/components/contacts/ContactsTable'
import UploadModal from '@/components/contacts/UploadModal'

export default function ContactsPage() {
  const [result, setResult] = useState<PaginatedResult<Contact> | null>(null)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '50',
      search,
      tag,
    })
    const res = await fetch(`/api/contacts?${params}`)
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }, [page, search, tag])

  useEffect(() => {
    fetch('/api/contacts?tags=1').then(r => r.json()).then(setTags)
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

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
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Import from Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search email or name…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={tag}
          onChange={e => { setTag(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <ContactsTable
        contacts={result?.data ?? []}
        loading={loading}
        onRefresh={fetchContacts}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchContacts() }}
        />
      )}
    </div>
  )
}
