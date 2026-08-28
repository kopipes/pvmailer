'use client'

import { useState, useRef } from 'react'
import ExcelJS from 'exceljs'
import { Upload, FileSpreadsheet, X, ChevronRight } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: (result: { imported: number; skipped: number; errors: string[] }) => void
}

type Step = 'upload' | 'map' | 'done'

// What each column maps to: 'email' | 'name' | 'skip' | custom variable name
type ColRole = 'email' | 'name' | 'skip' | string

export default function UploadModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<string[][]>([]) // first 2 data rows
  const [roles, setRoles] = useState<Record<string, ColRole>>({}) // header -> role
  const [groupTag, setGroupTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    const buffer = await f.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const ws = workbook.worksheets[0]
    const row1 = ws.getRow(1)
    const hdrs: string[] = []
    row1.eachCell((cell) => hdrs.push(String(cell.value ?? '').trim()))
    setHeaders(hdrs)

    // Preview: first 2 data rows
    const rows: string[][] = []
    for (let r = 2; r <= Math.min(3, ws.rowCount); r++) {
      const row = ws.getRow(r)
      const vals: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        vals[col - 1] = String(cell.value ?? '').trim()
      })
      rows.push(hdrs.map((_, i) => vals[i] ?? ''))
    }
    setPreview(rows)

    // Default roles: each column starts as the header name (= variable name)
    // user can change to email / name / skip
    const defaultRoles: Record<string, ColRole> = {}
    hdrs.forEach(h => { defaultRoles[h] = h })
    setRoles(defaultRoles)
    setStep('map')
  }

  function setRole(header: string, role: ColRole) {
    setRoles(prev => {
      const next = { ...prev }
      // If assigning email/name, unassign from any other column that had it
      if (role === 'email' || role === 'name') {
        Object.keys(next).forEach(h => { if (next[h] === role) next[h] = h })
      }
      next[header] = role
      return next
    })
  }

  const emailCol = Object.entries(roles).find(([, v]) => v === 'email')?.[0]
  const nameCol = Object.entries(roles).find(([, v]) => v === 'name')?.[0]
  const variableCols = Object.entries(roles).filter(([, v]) => v !== 'email' && v !== 'name' && v !== 'skip')

  async function handleImport() {
    if (!file || !emailCol) return
    setLoading(true)

    // Build mapping and extraColumns
    const mapping: Record<string, string> = { email: emailCol }
    if (nameCol) mapping.name = nameCol

    // extraColumns: { variableName -> columnHeader }
    const extraColumns: Record<string, string> = {}
    variableCols.forEach(([header, varName]) => {
      extraColumns[String(varName)] = header
    })

    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    fd.append('extraColumns', JSON.stringify(extraColumns))
    if (groupTag) fd.append('groupTag', groupTag)

    const res = await fetch('/api/contacts/import', { method: 'POST', body: fd })
    const data = await res.json()
    setResult(data)
    setStep('done')
    setLoading(false)
    if (data.imported > 0) onSuccess(data)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileSpreadsheet size={16} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Import Contacts</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-2">
          {['Upload', 'Map columns', 'Done'].map((s, i) => {
            const stepMap = ['upload', 'map', 'done']
            const current = stepMap.indexOf(step)
            const done = i < current
            const active = i === current
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${active ? 'bg-indigo-100 text-indigo-700' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {done ? '✓ ' : ''}{s}
                </span>
              </div>
            )
          })}
        </div>

        <div className="p-6 pt-3">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                onClick={() => fileRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                  <Upload size={18} className="text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-gray-700">Click or drop your Excel file here</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx files only</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <div>
              <p className="text-xs text-gray-500 mb-4">
                For each column, choose what it maps to. Set one column as <strong>Email</strong> (required) and one as <strong>Name</strong>. All others become template variables or can be skipped.
              </p>

              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Column</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Sample values</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Maps to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {headers.map(h => {
                      const role = roles[h] ?? h
                      const isEmail = role === 'email'
                      const isName = role === 'name'
                      const isSkip = role === 'skip'
                      const colIdx = headers.indexOf(h)
                      const samples = preview.map(row => row[colIdx]).filter(Boolean).slice(0, 2)

                      return (
                        <tr key={h} className={`${isSkip ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-2.5 font-mono font-medium text-gray-700">{h}</td>
                          <td className="px-4 py-2.5 text-gray-400 max-w-xs">
                            {samples.map((s, i) => (
                              <span key={i} className="mr-2 truncate inline-block max-w-[140px]" title={s}>{s}</span>
                            ))}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {/* Quick role buttons */}
                              <button onClick={() => setRole(h, 'email')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isEmail ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                                Email
                              </button>
                              <button onClick={() => setRole(h, 'name')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isName ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                                Name
                              </button>
                              <button onClick={() => setRole(h, 'skip')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isSkip ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                Skip
                              </button>
                              {/* Variable name input */}
                              {!isEmail && !isName && !isSkip && (
                                <div className="flex items-center gap-1 ml-1">
                                  <span className="text-gray-400 font-mono text-xs">{'{{'}</span>
                                  <input
                                    type="text"
                                    value={role}
                                    onChange={e => setRole(h, e.target.value || h)}
                                    className="w-24 text-xs px-1.5 py-0.5 border border-indigo-200 rounded font-mono text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-indigo-50"
                                  />
                                  <span className="text-gray-400 font-mono text-xs">{'}}'}</span>
                                </div>
                              )}
                              {isEmail && <span className="text-xs text-indigo-500 ml-1">→ contact email</span>}
                              {isName && <span className="text-xs text-indigo-500 ml-1">→ contact name</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex items-center gap-3 mb-4 text-xs">
                {emailCol
                  ? <span className="text-emerald-600 font-medium">✓ Email: <code className="bg-emerald-50 px-1 rounded">{emailCol}</code></span>
                  : <span className="text-red-500 font-medium">✗ No email column selected</span>
                }
                {nameCol
                  ? <span className="text-emerald-600 font-medium">✓ Name: <code className="bg-emerald-50 px-1 rounded">{nameCol}</code></span>
                  : <span className="text-gray-400">No name column</span>
                }
                {variableCols.length > 0 && (
                  <span className="text-violet-600 font-medium">
                    {variableCols.length} variable{variableCols.length > 1 ? 's' : ''}: {variableCols.map(([, v]) => `{{${v}}}`).join(', ')}
                  </span>
                )}
              </div>

              {/* Group tag */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Group tag (optional)</label>
                <input type="text" value={groupTag} onChange={e => setGroupTag(e.target.value)}
                  placeholder="e.g. event-2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2.5">
                <button onClick={() => setStep('upload')}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  Back
                </button>
                <button onClick={handleImport} disabled={!emailCol || loading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all">
                  {loading ? 'Importing…' : `Import${variableCols.length > 0 ? ` with ${variableCols.length} variable${variableCols.length > 1 ? 's' : ''}` : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && result && (
            <div className="text-center space-y-4 py-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${result.imported > 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <span className="text-2xl">{result.imported > 0 ? '✓' : '!'}</span>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{result.imported} contacts imported</p>
                {result.skipped > 0 && <p className="text-sm text-gray-500 mt-0.5">{result.skipped} skipped (duplicates)</p>}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-left max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <button onClick={onClose}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
