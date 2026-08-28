'use client'

import { useEffect, useState } from 'react'
import type { WebhookEventLog } from '@/types'
import { fmtDateTimeSec } from '@/lib/date'

const EVENT_COLORS: Record<string, string> = {
  'email.sent': 'bg-blue-50 text-blue-700',
  'email.delivered': 'bg-green-50 text-green-700',
  'email.opened': 'bg-indigo-50 text-indigo-700',
  'email.bounced': 'bg-orange-50 text-orange-700',
  'email.complained': 'bg-yellow-50 text-yellow-700',
  'email.clicked': 'bg-purple-50 text-purple-700',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<WebhookEventLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function fetchLogs() {
    setLoading(true)
    const res = await fetch(`/api/logs?page=${page}&pageSize=50`)
    const data = await res.json()
    setLogs(data.data)
    setTotal(data.total)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [page])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Webhook Logs</h1>
        <p className="text-sm text-gray-500 mt-1">{total} events received from Resend</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No webhook events yet.</p>
          <p className="text-xs mt-1">Events appear here once Resend sends callbacks to your webhook URL.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Message ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {fmtDateTimeSec(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[log.event_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{log.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono truncate max-w-[180px]">
                      {log.resend_message_id ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${log.processed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {log.processed ? 'processed' : 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="text-xs text-gray-400 hover:text-indigo-600"
                      >
                        {expanded === log.id ? 'hide' : 'payload'}
                      </button>
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-payload`}>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(JSON.parse(log.raw_payload), null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
