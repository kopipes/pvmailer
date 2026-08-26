'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CampaignWithTemplate, PaginatedResult } from '@/types'
import { format } from 'date-fns'
import CampaignWizard from '@/components/campaigns/CampaignWizard'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-50 text-blue-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
}

export default function CampaignsPage() {
  const [result, setResult] = useState<PaginatedResult<CampaignWithTemplate> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showWizard, setShowWizard] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), search, status })
    const res = await fetch(`/api/campaigns?${params}`)
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }, [page, search, status])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  // Auto-refresh when a campaign is running
  useEffect(() => {
    const hasRunning = result?.data.some(c => c.status === 'running')
    if (!hasRunning) return
    const interval = setInterval(fetchCampaigns, 5000)
    return () => clearInterval(interval)
  }, [result, fetchCampaigns])

  async function doAction(id: string, action: string) {
    await fetch(`/api/campaigns/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    fetchCampaigns()
  }

  const totalPages = result ? Math.ceil(result.total / 20) : 1

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">{result ? `${result.total} campaigns` : '…'}</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Campaign
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search campaigns…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          {['draft', 'running', 'paused', 'completed', 'cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : !result?.data.length ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📧</p>
          <p className="text-sm">No campaigns yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.data.map(c => {
                const pct = c.total_count > 0
                  ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100)
                  : 0
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                        {c.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{c.template_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status] ?? ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {c.sent_count}/{c.total_count}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.opened_count} opened · {c.failed_count} failed
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {format(new Date(c.created_at), 'd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {c.status === 'draft' && (
                          <button onClick={() => doAction(c.id, 'start')}
                            className="text-xs text-indigo-600 hover:underline font-medium">Start</button>
                        )}
                        {c.status === 'running' && (
                          <button onClick={() => doAction(c.id, 'pause')}
                            className="text-xs text-yellow-600 hover:underline font-medium">Pause</button>
                        )}
                        {c.status === 'paused' && (
                          <>
                            <button onClick={() => doAction(c.id, 'start')}
                              className="text-xs text-indigo-600 hover:underline font-medium">Resume</button>
                            <button onClick={() => doAction(c.id, 'cancel')}
                              className="text-xs text-red-500 hover:underline">Cancel</button>
                          </>
                        )}
                        {c.status === 'completed' && c.failed_count > 0 && (
                          <button onClick={() => doAction(c.id, 'retry')}
                            className="text-xs text-indigo-600 hover:underline font-medium">Retry failed</button>
                        )}
                        <Link href={`/campaigns/${c.id}`} className="text-xs text-gray-500 hover:underline">
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}

      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); fetchCampaigns() }}
        />
      )}
    </div>
  )
}
