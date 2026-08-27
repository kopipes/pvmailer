'use client'

import { useEffect, useState } from 'react'
import type { Template } from '@/types'
import TemplateEditor from '@/components/templates/TemplateEditor'
import { format } from 'date-fns'
import { FileText, Plus, Search, Copy, Pencil, Trash2 } from 'lucide-react'

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

  function duplicateTemplate(t: Template) {
    const copy: Template = { ...t, id: '', name: `${t.name} (Copy)`, created_at: '', updated_at: '' }
    setEditing(copy as Template)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">{templates.length} templates</p>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium rounded-lg shadow-sm transition-all">
          <Plus size={15} />
          New Template
        </button>
      </div>

      <div className="mb-5 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search templates…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-sm text-gray-400">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <FileText size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">No templates yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first email template</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col hover:border-indigo-200 hover:shadow-md transition-all group">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={16} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
                <span className="truncate">{t.from_name} &lt;{t.from_email}&gt;</span>
              </div>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">{format(new Date(t.updated_at), 'd MMM yyyy')}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(t)} title="Edit"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => duplicateTemplate(t)} title="Duplicate"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                    <Copy size={13} />
                  </button>
                  <button onClick={() => deleteTemplate(t.id)} title="Delete"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
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
