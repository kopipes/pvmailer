'use client'

import { useState, useEffect } from 'react'
import type { Template, Contact, PaginatedResult } from '@/types'

interface Props {
  onClose: () => void
  onCreated: () => void
}

type Step = 'template' | 'contacts' | 'variables' | 'confirm'

export default function CampaignWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('template')
  const [name, setName] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [contacts, setContacts] = useState<PaginatedResult<Contact> | null>(null)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [contactSearch, setContactSearch] = useState('')
  const [contactPage, setContactPage] = useState(1)
  const [contactTag, setContactTag] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contactVarKeys, setContactVarKeys] = useState<string[]>([])
  const [selectAllPages, setSelectAllPages] = useState(false) // true = all pages selected
  const [totalFiltered, setTotalFiltered] = useState(0) // total contacts matching filter

  useEffect(() => {
    fetch('/api/templates?pageSize=100').then(r => r.json()).then(d => setTemplates(d.data))
    fetch('/api/contacts?tags=1').then(r => r.json()).then(setTags)
    fetch('/api/contacts/variables').then(r => r.json()).then(d => setContactVarKeys(Object.keys(d ?? {})))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(contactPage),
      pageSize: '50',
      search: contactSearch,
      tag: contactTag,
      suppressed: 'false',
    })
    fetch(`/api/contacts?${params}`).then(r => r.json()).then(setContacts)
  }, [contactPage, contactSearch, contactTag])

  // Init variables when template selected — exclude contact variables and builtins
  useEffect(() => {
    if (!selectedTemplate?.variables) return
    const vars = JSON.parse(selectedTemplate.variables) as string[]
    const init: Record<string, string> = {}
    for (const v of vars) {
      // Skip built-ins, RSVP auto-vars, and variables already covered by contacts
      if (['name', 'email', 'rsvp_yes_link', 'rsvp_no_link'].includes(v)) continue
      if (contactVarKeys.includes(v)) continue
      init[v] = ''
    }
    setVariables(init)
  }, [selectedTemplate, contactVarKeys])

  function toggleContact(id: string) {
    setSelectedContactIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSelectAllPages(false)
  }

  function toggleAll() {
    if (!contacts?.data) return
    const allIds = contacts.data.map(c => c.id)
    const allSelected = allIds.every(id => selectedContactIds.has(id))
    setSelectedContactIds(prev => {
      const next = new Set(prev)
      if (allSelected) { allIds.forEach(id => next.delete(id)); setSelectAllPages(false) }
      else allIds.forEach(id => next.add(id))
      return next
    })
    if (!allIds.every(id => selectedContactIds.has(id))) setSelectAllPages(false)
  }

  async function selectAllFilteredContacts() {
    const params = new URLSearchParams({ search: contactSearch, tag: contactTag })
    const res = await fetch(`/api/contacts/ids?${params}`)
    const ids: string[] = await res.json()
    setSelectedContactIds(new Set(ids))
    setSelectAllPages(true)
    setTotalFiltered(ids.length)
  }

  function clearSelection() {
    setSelectedContactIds(new Set())
    setSelectAllPages(false)
  }

  async function create() {
    if (!name || !selectedTemplate || selectedContactIds.size === 0) {
      setError('Please fill all required fields')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        template_id: selectedTemplate.id,
        variables,
        contact_ids: Array.from(selectedContactIds),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to create campaign')
      return
    }
    onCreated()
  }

  const steps: Step[] = ['template', 'contacts', 'variables', 'confirm']
  const stepLabels = { template: 'Template', contacts: 'Recipients', variables: 'Variables', confirm: 'Confirm' }
  const stepIdx = steps.indexOf(step)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">New Campaign</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-6 py-3 border-b border-gray-100 gap-1 shrink-0">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < stepIdx ? 'bg-indigo-600 text-white' :
                i === stepIdx ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500' :
                'bg-gray-100 text-gray-400'
              }`}>{i + 1}</div>
              <span className={`text-xs ${i === stepIdx ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>
                {stepLabels[s]}
              </span>
              {i < steps.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {step === 'template' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name <span className="text-red-500">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="August Newsletter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select template <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        selectedTemplate?.id === t.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.subject}</p>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No templates. Create one first.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'contacts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700 font-medium">
                  {selectedContactIds.size} selected
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search…"
                    value={contactSearch}
                    onChange={e => { setContactSearch(e.target.value); setContactPage(1); setSelectAllPages(false) }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select value={contactTag} onChange={e => { setContactTag(e.target.value); setContactPage(1); setSelectAllPages(false) }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All tags</option>
                    {tags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Select all pages banner */}
              {contacts && contacts.total > 50 && contacts?.data.every(c => selectedContactIds.has(c.id)) && (contacts?.data.length ?? 0) > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  {selectAllPages ? (
                    <>
                      <span className="text-sm text-indigo-700">
                        All <strong>{totalFiltered}</strong> contacts selected.
                      </span>
                      <button onClick={clearSelection}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline">
                        Clear selection
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-indigo-700">
                        All <strong>{contacts.data.length}</strong> contacts on this page selected.
                      </span>
                      <button onClick={selectAllFilteredContacts}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline">
                        Select all {contacts.total} contacts{contactTag ? ` in "${contactTag}"` : ''}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 w-8">
                        <input type="checkbox" onChange={toggleAll}
                          checked={contacts?.data.every(c => selectedContactIds.has(c.id)) && (contacts?.data.length ?? 0) > 0}
                          className="rounded text-indigo-600" />
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Email</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Name</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 max-h-48">
                    {contacts?.data.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleContact(c.id)}>
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={selectedContactIds.has(c.id)} onChange={() => toggleContact(c.id)}
                            className="rounded text-indigo-600" onClick={e => e.stopPropagation()} />
                        </td>
                        <td className="px-4 py-2 text-gray-900">{c.email}</td>
                        <td className="px-4 py-2 text-gray-500">{c.name ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{c.group_tags ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {contacts && Math.ceil(contacts.total / 50) > 1 && (
                <div className="flex justify-end gap-2">
                  <button disabled={contactPage === 1} onClick={() => setContactPage(p => p - 1)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40">Prev</button>
                  <span className="text-xs text-gray-500 py-1">{contactPage} / {Math.ceil(contacts.total / 50)}</span>
                  <button disabled={contactPage === Math.ceil(contacts.total / 50)} onClick={() => setContactPage(p => p + 1)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40">Next</button>
                </div>
              )}
            </div>
          )}

          {step === 'variables' && (
            <div className="space-y-4">
              {/* Auto-filled variables from contacts */}
              {(() => {
                const autoFilled = selectedTemplate?.variables
                  ? (JSON.parse(selectedTemplate.variables) as string[])
                      .filter(v => !['name', 'email'].includes(v) && contactVarKeys.includes(v))
                  : []
                if (!autoFilled.length) return null
                return (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Auto-filled from contacts</p>
                    <div className="flex flex-wrap gap-2">
                      {['name', 'email', ...autoFilled].map(v => (
                        <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-mono rounded-md">
                          {`{{${v}}}`}
                          <span className="text-emerald-400 font-sans text-xs">✓</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600 mt-2">These variables are automatically filled from each contact's data — no action needed.</p>
                  </div>
                )
              })()}

              <p className="text-sm text-gray-600">
                {Object.keys(variables).length > 0
                  ? 'Set campaign-wide values for these variables — same for all recipients.'
                  : ''}
              </p>
              {Object.keys(variables).length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-600">No campaign variables needed</p>
                  <p className="text-xs text-gray-400 mt-1">All template variables are auto-filled from contacts.</p>
                </div>
              ) : (
                Object.keys(variables).map(key => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs">{`{{${key}}}`}</code>
                      <span className="text-xs text-gray-400 ml-2">same for all recipients</span>
                    </label>
                    <input
                      value={variables[key]}
                      onChange={e => setVariables(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={`Value for ${key}…`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Review before creating</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Campaign name</span>
                  <span className="font-medium text-gray-900">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Template</span>
                  <span className="font-medium text-gray-900">{selectedTemplate?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recipients</span>
                  <span className="font-medium text-gray-900">{selectedContactIds.size} contacts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">From</span>
                  <span className="font-medium text-gray-900">{selectedTemplate?.from_name} &lt;{selectedTemplate?.from_email}&gt;</span>
                </div>
                {Object.entries(variables).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{`{{${k}}}`}</span>
                    <span className="font-medium text-gray-900">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                The campaign will be created in <strong>draft</strong> status. You can start it from the campaigns list.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between shrink-0">
          <button
            onClick={() => stepIdx > 0 ? setStep(steps[stepIdx - 1]) : onClose()}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            {stepIdx === 0 ? 'Cancel' : 'Back'}
          </button>
          {step !== 'confirm' ? (
            <button
              onClick={() => setStep(steps[stepIdx + 1])}
              disabled={
                (step === 'template' && (!name || !selectedTemplate)) ||
                (step === 'contacts' && selectedContactIds.size === 0)
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={create}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
