'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CampaignWithTemplate, PaginatedResult } from '@/types'
import { fmtDate } from '@/lib/date'
import CampaignWizard from '@/components/campaigns/CampaignWizard'
import Link from 'next/link'
import { Send, Plus, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  draft:     { label: 'Draft',     dot: 'bg-gray-400',    text: 'text-gray-600',   bg: 'bg-gray-100' },
  running:   { label: 'Running',   dot: 'bg-blue-400 animate-pulse', text: 'text-blue-700', bg: 'bg-blue-50' },
  paused:    { label: 'Paused',    dot: 'bg-yellow-400',  text: 'text-yellow-700', bg: 'bg-yellow-50' },
  completed: { label: 'Completed', dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  cancelled: { label: 'Cancelled', dot: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50' },
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
        <button onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium rounded-lg shadow-sm transition-all">
          <Plus size={15} />
          New Campaign
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search campaigns…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          {['draft', 'running', 'paused', 'completed', 'cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-sm text-gray-400">Loading…</div>
      ) : !result?.data.length ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Send size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">No campaigns yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first campaign to start sending</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Campaign</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Progress</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result.data.map(c => {
                const pct = c.total_count > 0
                  ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100)
                  : 0
                const s = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
                return (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/campaigns/${c.id}`} className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                        {c.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{c.template_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md font-medium ${s.text} ${s.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{c.sent_count}/{c.total_count}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.opened_count} opened · {c.failed_count > 0 ? <span className="text-red-400">{c.failed_count} failed</span> : '0 failed'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                      {fmtDate(c.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        {c.status === 'draft' && (
                          <button onClick={() => doAction(c.id, 'start')}
                            className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium rounded-md transition-colors">
                            Start
                          </button>
                        )}
                        {c.status === 'running' && (
                          <button onClick={() => doAction(c.id, 'pause')}
                            className="text-xs px-2.5 py-1 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium rounded-md transition-colors">
                            Pause
                          </button>
                        )}
                        {c.status === 'paused' && (
                          <>
                            <button onClick={() => doAction(c.id, 'start')}
                              className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium rounded-md transition-colors">
                              Resume
                            </button>
                            <button onClick={() => doAction(c.id, 'cancel')}
                              className="text-xs px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors">
                              Cancel
                            </button>
                          </>
                        )}
                        {['completed', 'paused'].includes(c.status) && c.failed_count > 0 && (
                          <button onClick={() => doAction(c.id, 'retry')}
                            className="text-xs px-2.5 py-1 border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-md transition-colors">
                            Resend {c.failed_count} failed
                          </button>
                        )}
                        <Link href={`/campaigns/${c.id}`}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                          <ExternalLink size={13} />
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

      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); fetchCampaigns() }}
        />
      )}
    </div>
  )
}
