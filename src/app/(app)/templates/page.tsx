'use client'

import { useEffect, useState } from 'react'
import type { Template } from '@/types'
import TemplateEditor from '@/components/templates/TemplateEditor'
import { format } from 'date-fns'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Template | null | 'new'>(null)
  const [search, setSearch] = useState('')

  async function fetchTemplates() {
    setLoading(true)
    const res = await fetch(`/api/templates?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setTemplates(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchTemplates() }, [search])

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    fetchTemplates()
  }

  // Duplicate: open editor pre-filled as a new template (no id = POST on save)
  function duplicateTemplate(t: Template) {
    const copy: Template = {
      ...t,
      id: '',
      name: `${t.name} (Copy)`,
      created_at: '',
      updated_at: '',
    }
    setEditing(copy as Template)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">{templates.length} templates</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Template
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-sm">No templates yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
              </div>
              <p className="text-sm text-gray-600 truncate mb-3">{t.subject}</p>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span className="truncate">{t.from_name} &lt;{t.from_email}&gt;</span>
                <span className="shrink-0 ml-2">{format(new Date(t.updated_at), 'd MMM yyyy')}</span>
              </div>
              {t.variables && JSON.parse(t.variables).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {(JSON.parse(t.variables) as string[]).map((v: string) => (
                    <span key={v} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
              {/* Action row */}
              <div className="mt-auto pt-3 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setEditing(t)}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >Edit</button>
                <button
                  onClick={() => duplicateTemplate(t)}
                  className="text-xs text-gray-500 hover:text-indigo-600 hover:underline"
                  title="Create a copy of this template to edit"
                >Duplicate</button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="text-xs text-red-500 hover:underline ml-auto"
                >Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <TemplateEditor
          template={editing === 'new' ? null : (editing.id === '' ? { ...editing, id: '' } : editing)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchTemplates() }}
        />
      )}
    </div>
  )
}
