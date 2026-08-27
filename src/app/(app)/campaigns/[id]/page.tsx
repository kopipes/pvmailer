'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [campaign, setCampaign] = useState<CampaignWithTemplate | null>(null)
  const [recipients, setRecipients] = useState<PaginatedResult<Recipient> | null>(null)
  const [recipientStatus, setRecipientStatus] = useState('')
  const [recipientPage, setRecipientPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Preview
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Edit
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [actionPending, setActionPending] = useState<string | null>(null)

  // Edit Variables
  const [showVars, setShowVars] = useState(false)
  const [vars, setVars] = useState<Record<string, string>>({})
  const [varsSaving, setVarsSaving] = useState(false)
  const [varsError, setVarsError] = useState('')

  async function openVars() {
    const res = await fetch(`/api/campaigns/${id}?variables=1`)
    if (res.ok) setVars(await res.json())
    setVarsError('')
    setShowVars(true)
  }

  async function saveVars() {
    setVarsSaving(true)
    setVarsError('')
    const res = await fetch(`/api/campaigns/${id}?variables=1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables: vars }),
    })
    setVarsSaving(false)
    if (res.ok) {
      setShowVars(false)
      setPreviewHtml(null) // invalidate preview cache
    } else {
      const d = await res.json()
      setVarsError(d.error ?? 'Failed to save')
    }
  }

  // Fix recipient
  const [fixRecipient, setFixRecipient] = useState<Recipient | null>(null)
  const [fixEmail, setFixEmail] = useState('')
  const [fixName, setFixName] = useState('')
  const [fixSaving, setFixSaving] = useState(false)
  const [fixError, setFixError] = useState('')

  async function saveFix() {
    if (!fixEmail.trim()) { setFixError('Email is required'); return }
    if (!fixEmail.includes('@')) { setFixError('Invalid email'); return }
    setFixSaving(true)
    setFixError('')
    const res = await fetch(`/api/campaigns/${id}/recipients/${fixRecipient!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fixEmail.trim(), name: fixName.trim() }),
    })
    setFixSaving(false)
    if (res.ok) {
      setFixRecipient(null)
      fetchRecipients()
      fetchCampaign()
    } else {
      const d = await res.json()
      setFixError(d.error ?? 'Failed to update')
    }
  }

  function openFix(r: Recipient) {
    setFixRecipient(r)
    setFixEmail(r.email)
    setFixName(r.name ?? '')
    setFixError('')
  }

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
    setActionPending(action)
    await fetch(`/api/campaigns/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setActionPending(null)
    fetchCampaign()
    fetchRecipients()
  }

  async function openPreview() {
    setShowPreview(true)
    if (previewHtml) return
    setPreviewLoading(true)
    const res = await fetch(`/api/campaigns/${id}/preview`)
    if (res.ok) setPreviewHtml(await res.text())
    setPreviewLoading(false)
  }

  function openEdit() {
    setEditName(campaign?.name ?? '')
    setEditError('')
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!editName.trim()) { setEditError('Name is required'); return }
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    setEditSaving(false)
    if (res.ok) {
      setShowEdit(false)
      fetchCampaign()
    } else {
      const d = await res.json()
      setEditError(d.error ?? 'Failed to save')
    }
  }

  async function doDelete() {
    setDeleteError('')
    const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/campaigns')
    } else {
      const d = await res.json()
      setDeleteError(d.error ?? 'Failed to delete')
      setDeleteConfirm(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!campaign) return <div className="p-8 text-red-500 text-sm">Campaign not found.</div>

  const pct = campaign.total_count > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_count) * 100)
    : 0

  const totalPages = recipients ? Math.ceil(recipients.total / 50) : 1
  const canDelete = ['draft', 'paused', 'completed', 'cancelled'].includes(campaign.status)
  const canEdit = campaign.status !== 'running'

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
          {deleteError && <p className="text-xs text-red-600 mt-1">{deleteError}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Preview — always */}
          <button onClick={openPreview}
            className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            Preview
          </button>

          {/* Edit — not while running */}
          {canEdit && (
            <button onClick={openEdit}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
              Rename
            </button>
          )}

          {/* Edit Variables — draft only */}
          {campaign.status === 'draft' && (
            <button onClick={openVars}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
              Edit Variables
            </button>
          )}

          {/* Delete — not while running */}
          {canDelete && (
            <button onClick={() => setDeleteConfirm(true)}
              className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition-colors">
              Delete
            </button>
          )}

          {/* Campaign actions */}
          {campaign.status === 'draft' && (
            <button onClick={() => doAction('start')} disabled={!!actionPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {actionPending === 'start' ? 'Starting…' : 'Start'}
            </button>
          )}
          {campaign.status === 'running' && (
            <button onClick={() => doAction('pause')} disabled={!!actionPending}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {actionPending === 'pause' ? 'Pausing…' : 'Pause'}
            </button>
          )}
          {campaign.status === 'paused' && (
            <>
              <button onClick={() => doAction('start')} disabled={!!actionPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {actionPending === 'start' ? 'Resuming…' : 'Resume'}
              </button>
              <button onClick={() => doAction('cancel')} disabled={!!actionPending}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-60 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                {actionPending === 'cancel' ? 'Cancelling…' : 'Cancel'}
              </button>
            </>
          )}
          {['completed', 'paused'].includes(campaign.status) && campaign.failed_count > 0 && (
            <button onClick={() => doAction('retry')} disabled={!!actionPending}
              className="px-3 py-2 border border-orange-300 hover:bg-orange-50 disabled:opacity-60 text-orange-600 text-sm font-medium rounded-lg transition-colors"
              title={`${campaign.failed_count} recipient(s) failed to send — click to reset and resend only those`}>
              {actionPending === 'retry' ? 'Retrying…' : `Resend ${campaign.failed_count} Failed`}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
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
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recipients?.data.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.email}</td>
                  <td className="px-4 py-3 text-gray-600">{r.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                    {r.last_error && <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={r.last_error}>{r.last_error}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.attempt_count}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {r.sent_at ? format(new Date(r.sent_at), 'd MMM HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(r.status === 'failed' || r.status === 'bounced') && (
                      <button
                        onClick={() => openFix(r)}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Fix
                      </button>
                    )}
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

      {/* ── Preview Modal ──────────────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ height: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Email Preview</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {recipients?.data[0]
                    ? `Sample: ${recipients.data[0].name ?? recipients.data[0].email}`
                    : 'Placeholder values'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setPreviewHtml(null); openPreview() }}
                  className="text-xs text-gray-500 hover:text-indigo-600"
                  title="Refresh preview"
                >
                  Refresh
                </button>
                <button onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
            </div>
            {previewLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading preview…</div>
            ) : (
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml ?? ''}
                className="flex-1 w-full rounded-b-2xl"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Edit/Rename Modal ──────────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Rename Campaign</h2>
            <input
              autoFocus
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setShowEdit(false) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              placeholder="Campaign name"
            />
            {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{editError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg">
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete Campaign?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete <strong>{campaign.name}</strong> and all its recipient records.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={doDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Variables Modal ───────────────────────────────────────── */}
      {showVars && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Edit Campaign Variables</h2>
            <p className="text-xs text-gray-400 mb-4">These values replace <code className="bg-gray-100 px-1 rounded">{'{{variable}}'}</code> tokens in the template for all recipients.</p>
            {Object.keys(vars).length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No custom variables for this campaign.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {Object.entries(vars).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{`{{${key}}}`}</code>
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={e => setVars(v => ({ ...v, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={`Value for ${key}`}
                    />
                  </div>
                ))}
              </div>
            )}
            {varsError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{varsError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowVars(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveVars} disabled={varsSaving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg">
                {varsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fix Recipient Modal ─────────────────────────────────────────── */}
      {fixRecipient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Fix Recipient</h2>
            <p className="text-xs text-gray-400 mb-4">
              Update the details and the recipient will be reset to pending for the next send.
            </p>
            {fixRecipient.last_error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs font-medium text-red-700 mb-0.5">Error</p>
                <p className="text-xs text-red-600">{fixRecipient.last_error}</p>
                {/domain|sender|from|verified|dkim|spf/i.test(fixRecipient.last_error) && (
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1.5 mt-2">
                    This looks like a <strong>sender domain error</strong> — the recipient email is fine.
                    Go to <strong>Templates</strong> and update the <em>From Email</em> to a verified domain
                    (e.g. <code>no-reply@provaliantgroup.com</code>), then retry.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  type="email"
                  value={fixEmail}
                  onChange={e => setFixEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveFix(); if (e.key === 'Escape') setFixRecipient(null) }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={fixName}
                  onChange={e => setFixName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setFixRecipient(null) }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {fixError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{fixError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setFixRecipient(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveFix} disabled={fixSaving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg">
                {fixSaving ? 'Saving…' : 'Save & Queue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
