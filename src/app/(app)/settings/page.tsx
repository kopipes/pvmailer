'use client'

import { useEffect, useState } from 'react'
import type { Division } from '@/lib/divisions'

interface ProfileData {
  id: string
  name: string
  email: string
  role: string
  division_id: string | null
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/divisions').then(r => r.json()),
    ]).then(([p, d]) => {
      setProfile(p)
      setName(p.name ?? '')
      setEmail(p.email ?? '')
      setDivisionId(p.division_id ?? '')
      setDivisions(d)
    })
  }, [])

  async function saveProfile() {
    if (!name || !email) { setMessage({ type: 'error', text: 'Name and email required' }); return }
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, division_id: divisionId || null }),
    })
    setSaving(false)
    if (res.ok) {
      setMessage({ type: 'success', text: 'Profile updated.' })
    } else {
      const d = await res.json()
      setMessage({ type: 'error', text: d.error ?? 'Failed' })
    }
  }

  async function changePassword() {
    if (!newPassword) { setMessage({ type: 'error', text: 'New password required' }); return }
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match' }); return }
    if (newPassword.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters' }); return }
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    setSaving(false)
    if (res.ok) {
      setMessage({ type: 'success', text: 'Password changed.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      const d = await res.json()
      setMessage({ type: 'error', text: d.error ?? 'Failed' })
    }
  }

  if (!profile) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}

      {/* Profile section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
            <select value={divisionId} onChange={e => setDivisionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">None</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-400">Role: <strong>{profile.role}</strong></span>
            <button onClick={saveProfile} disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Password section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Repeat new password" />
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={changePassword} disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg">
              {saving ? 'Saving…' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Resend config (read-only info) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Resend Configuration</h2>
        <p className="text-sm text-gray-500 mb-2">
          API key and webhook secret are configured via environment variables.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1 text-gray-600">
          <div>RESEND_API_KEY = {process.env.NEXT_PUBLIC_RESEND_CONFIGURED === '1' ? '••••••••••••' : 'not set'}</div>
          <div>Webhook URL = <span className="text-indigo-600">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/resend</span></div>
        </div>
      </div>
    </div>
  )
}
