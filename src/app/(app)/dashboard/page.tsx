'use client'

import { useEffect, useState } from 'react'
import type { DashboardStats } from '@/types'
import { format } from 'date-fns'

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false) })
  }, [])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!stats) return null

  const openRate = stats.emailsSentTotal > 0
    ? ((stats.emailsOpenedTotal / stats.emailsSentTotal) * 100).toFixed(1)
    : '0'

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Contacts" value={stats.totalContacts} sub={`${stats.suppressedContacts} suppressed`} />
        <StatCard label="Templates" value={stats.totalTemplates} />
        <StatCard label="Campaigns" value={stats.totalCampaigns} sub={stats.runningCampaigns > 0 ? `${stats.runningCampaigns} running` : undefined} />
        <StatCard label="Open Rate" value={`${openRate}%`} sub={`${stats.emailsOpenedTotal} / ${stats.emailsSentTotal} sent`} />
      </div>

      {stats.runningCampaigns > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-indigo-600 text-lg">⚡</span>
          <span className="text-sm text-indigo-700 font-medium">
            {stats.runningCampaigns} campaign{stats.runningCampaigns > 1 ? 's' : ''} currently running
          </span>
          <a href="/campaigns" className="ml-auto text-sm text-indigo-600 hover:underline font-medium">View →</a>
        </div>
      )}
    </div>
  )
}
