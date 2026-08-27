'use client'

import { useEffect, useState } from 'react'
import type { DashboardStats } from '@/types'
import { format } from 'date-fns'
import { Users, FileText, Send, TrendingUp, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
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

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <div className="text-sm text-gray-400">Loading…</div>
    </div>
  )
  if (!stats) return null

  const openRate = stats.emailsSentTotal > 0
    ? ((stats.emailsOpenedTotal / stats.emailsSentTotal) * 100).toFixed(1)
    : '0'

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Running banner */}
      {stats.runningCampaigns > 0 && (
        <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Zap size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-800">
              {stats.runningCampaigns} campaign{stats.runningCampaigns > 1 ? 's' : ''} running
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">Emails are being sent right now</p>
          </div>
          <Link href="/campaigns"
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0">
            View <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Contacts"
          value={stats.totalContacts}
          sub={`${stats.suppressedContacts} suppressed`}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Templates"
          value={stats.totalTemplates}
          icon={FileText}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          label="Campaigns"
          value={stats.totalCampaigns}
          sub={stats.runningCampaigns > 0 ? `${stats.runningCampaigns} running` : 'all done'}
          icon={Send}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          label="Open Rate"
          value={`${openRate}%`}
          sub={`${stats.emailsOpenedTotal.toLocaleString()} / ${stats.emailsSentTotal.toLocaleString()} sent`}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/contacts', label: 'Manage Contacts', sub: 'Import, edit, suppress', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { href: '/templates', label: 'Email Templates', sub: 'Create and edit templates', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
          { href: '/campaigns', label: 'Campaigns', sub: 'Start or review sends', icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-indigo-200 hover:shadow-md transition-all group">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                <Icon size={16} className={item.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
