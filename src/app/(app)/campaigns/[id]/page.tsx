'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { CampaignWithTemplate, Recipient, PaginatedResult } from '@/types'
import { format } from 'date-fns'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sending: 'bg-blue-50 text-blue-600',
  sent: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
  opened: 'bg-indigo-50 text-indigo-700',
  failed: 'bg-red-50 text-red-600',
  bounced: 'bg-orange-50 text-orange-700',
  complained: 'bg-yellow-50 text-yellow-700',
}

const CAMPAIGN_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-50 text-blue-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
}

export default function CampaignDetailPage() {
  const { id } = useParams() as { id: string }
  const [campaign, setCampaign] = useState<CampaignWithTemplate | null>(null)
  const [recipients, setRecipients] = useState<PaginatedResult<Recipient> | null>(null)
  const [recipientStatus, setRecipientStatus] = useState('')
  const [recipientPage, setRecipientPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${id}`)
    if (res.ok) setCampaign(await res.json())
    setLoading(false)
  }, [id])

  const fetchRecipients = useCallback(async () => {
    const params = new URLSearchParams({
      recipients: '1',
      page: String(recipientPage),
      pageSize: '50',
      status: recipientStatus,
    })
    const res = await fetch(`/api/campaigns/${id}?${params}`)
    if (res.ok) setRecipients(await res.json())
  }, [id, recipientPage, recipientStatus])

  useEffect(() => { fetchCampaign(); fetchRecipients() }, [fetchCampaign, fetchRecipients])

  // Auto-poll when running
  useEffect(() => {
    if (campaign?.status !== 'running') return
    const interval = setInterval(() => { fetchCampaign(); fetchRecipients() }, 3000)
    return () => clearInterval(interval)
  }, [campaign?.status, fetchCampaign, fetchRecipients])

  async function doAction(action: string) {
    await fetch(`/api/campaigns/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    fetchCampaign()
    fetchRecipients()
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!campaign) return <div className="p-8 text-red-500 text-sm">Campaign not found.</div>

  const pct = campaign.total_count > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_count) * 100)
    : 0

  const totalPages = recipients ? Math.ceil(recipients.total / 50) : 1

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/campaigns" className="hover:text-indigo-600">Campaigns</Link>
        <span>/</span>
        <span className="text-gray-700">{campaign.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAMPAIGN_STATUS_STYLES[campaign.status]}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">Template: {campaign.template_name} · From: {campaign.from_name} &lt;{campaign.from_email}&gt;</p>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <button onClick={() => doAction('start')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
              Start
            </button>
          )}
          {campaign.status === 'running' && (
            <button onClick={() => doAction('pause')}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg">
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <>
              <button onClick={() => doAction('start')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
                Resume
              </button>
              <button onClick={() => doAction('cancel')}
                className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg">
                Cancel
              </button>
            </>
          )}
          {(campaign.status === 'completed' || campaign.status === 'paused') && campaign.failed_count > 0 && (
            <button onClick={() => doAction('retry')}
              className="px-4 py-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-sm font-medium rounded-lg">
              Retry Failed ({campaign.failed_count})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: campaign.total_count, color: 'text-gray-900' },
          { label: 'Sent', value: campaign.sent_count, color: 'text-blue-700' },
          { label: 'Opened', value: campaign.opened_count, color: 'text-indigo-700' },
          { label: 'Bounced', value: campaign.bounced_count, color: 'text-orange-700' },
          { label: 'Failed', value: campaign.failed_count, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {campaign.status !== 'draft' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${campaign.status === 'running' ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{campaign.started_at ? `Started ${format(new Date(campaign.started_at), 'd MMM HH:mm')}` : ''}</span>
            <span>{campaign.finished_at ? `Finished ${format(new Date(campaign.finished_at), 'd MMM HH:mm')}` : ''}</span>
          </div>
        </div>
      )}

      {/* Recipients table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Recipients</h2>
          <select
            value={recipientStatus}
            onChange={e => { setRecipientStatus(e.target.value); setRecipientPage(1) }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            {['pending', 'sent', 'delivered', 'opened', 'failed', 'bounced', 'complained'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attempts</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recipients?.data.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.email}</td>
                  <td className="px-4 py-3 text-gray-500">{r.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                    {r.last_error && (
                      <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs" title={r.last_error}>{r.last_error}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.attempt_count}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {r.sent_at ? format(new Date(r.sent_at), 'd MMM HH:mm') : '—'}
                  </td>
                </tr>
              ))}
              {recipients?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No recipients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm text-gray-500">Page {recipientPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={recipientPage === 1} onClick={() => setRecipientPage(p => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <button disabled={recipientPage === totalPages} onClick={() => setRecipientPage(p => p + 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
