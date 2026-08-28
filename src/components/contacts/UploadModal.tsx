'use client'

import { useState, useRef } from 'react'
import ExcelJS from 'exceljs'
import { Upload, FileSpreadsheet, CheckSquare, Square, X, ChevronRight } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: (result: { imported: number; skipped: number; errors: string[] }) => void
}

type Step = 'upload' | 'map' | 'done'

export default function UploadModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({ email: '', name: '' })
  const [groupTag, setGroupTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  // Extra columns: key = original header, value = variable name (empty = excluded)
  const [extraCols, setExtraCols] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    const buffer = await f.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const ws = workbook.worksheets[0]
    const row = ws.getRow(1)
    const hdrs: string[] = []
    row.eachCell((cell) => hdrs.push(String(cell.value ?? '').trim()))
    setHeaders(hdrs)

    const emailGuess = hdrs.find(h => /email/i.test(h)) ?? ''
    const nameGuess = hdrs.find(h => /^name$/i.test(h))
      ?? hdrs.find(h => /^nama$/i.test(h))
      ?? hdrs.find(h => /nama lengkap/i.test(h))
      ?? hdrs.find(h => /full.?name/i.test(h))
      ?? ''
    setMapping({ email: emailGuess, name: nameGuess })

    // All non-email, non-name columns become extra variables by default
    const extras: Record<string, string> = {}
    hdrs.forEach(h => {
      if (!h) return
      if (emailGuess && h === emailGuess) return
      if (nameGuess && h === nameGuess) return
      extras[h] = h // default variable name = column header
    })
    setExtraCols(extras)
    setStep('map')
  }

  // Extra columns excluding whatever is selected as email
  function getAvailableExtras() {
    return headers.filter(h => h && h !== mapping.email)
  }

  function toggleExtra(h: string) {
    setExtraCols(prev => ({
      ...prev,
      [h]: prev[h] === '' ? h : '',
    }))
  }

  function renameExtra(h: string, newName: string) {
    setExtraCols(prev => ({ ...prev, [h]: newName }))
  }

  async function handleImport() {
    if (!file || !mapping.email) return
    setLoading(true)

    const availableExtras = getAvailableExtras()

    // Extra variables: columns not used as name, that are checked and have a variable name
    const extraColumnsMap = Object.fromEntries(
      availableExtras
        .filter(h => h !== mapping.name && extraCols[h]?.trim())
        .map(h => [extraCols[h].trim(), h])
    )

    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    fd.append('extraColumns', JSON.stringify(extraColumnsMap))
    if (groupTag) fd.append('groupTag', groupTag)

    const res = await fetch('/api/contacts/import', { method: 'POST', body: fd })
    const data = await res.json()
    setResult(data)
    setStep('done')
    setLoading(false)
    if (data.imported > 0) onSuccess(data)
  }

  const extras = getAvailableExtras()
  // Variables = extra cols that are checked AND not used as the name column
  const variableCount = extras.filter(h => h !== mapping.name && extraCols[h]?.trim()).length

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
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

        {/* Steps indicator */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-2">
          {['Upload', 'Map columns', 'Done'].map((s, i) => {
            const stepMap = ['upload', 'map', 'done']
            const current = stepMap.indexOf(step)
            const done = i < current
            const active = i === current
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  active ? 'bg-indigo-100 text-indigo-700' :
                  done ? 'text-emerald-600' : 'text-gray-400'
                }`}>{done ? '✓ ' : ''}{s}</span>
              </div>
            )
          })}
        </div>

        <div className="p-6 pt-3">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                }`}
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
            <div className="space-y-4">
              {/* Required fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Email column <span className="text-red-500">*</span>
                  </label>
                  <select value={mapping.email}
                    onChange={e => setMapping(m => ({ ...m, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select…</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Name column</label>
                  <select value={mapping.name}
                    onChange={e => setMapping(m => ({ ...m, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">None</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {/* Extra columns */}
              {extras.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">
                      Extra columns as variables
                      <span className="ml-1.5 text-gray-400 font-normal">
                        ({variableCount} variable{variableCount !== 1 ? 's' : ''})
                      </span>
                    </label>
                    <span className="text-xs text-gray-400">
                      usable as <code className="bg-gray-100 px-1 rounded">{'{{'+'variable'+'}}' }</code>
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {extras.map(h => {
                      const isNameCol = h === mapping.name
                      const included = !isNameCol && !!extraCols[h]?.trim()
                      return (
                        <div key={h} className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${isNameCol ? 'bg-gray-50 opacity-50' : included ? 'bg-white' : 'bg-gray-50'}`}>
                          <button
                            onClick={() => !isNameCol && toggleExtra(h)}
                            disabled={isNameCol}
                            className={`shrink-0 transition-colors ${included ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'} disabled:cursor-not-allowed`}>
                            {included ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <span className="text-xs text-gray-500 w-24 shrink-0 truncate" title={h}>{h}</span>
                          {isNameCol && <span className="text-xs text-gray-400 italic">used as name</span>}
                          {!isNameCol && included && (
                            <>
                              <ChevronRight size={12} className="text-gray-300 shrink-0" />
                              <input
                                type="text"
                                value={extraCols[h]}
                                onChange={e => renameExtra(h, e.target.value)}
                                className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                                placeholder="variable name"
                              />
                              <span className="text-xs text-indigo-400 shrink-0 font-mono">
                                {`{{${extraCols[h] || '...'}}}`}
                              </span>
                            </>
                          )}
                          {!isNameCol && !included && (
                            <span className="text-xs text-gray-300 italic">excluded</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Group tag */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Group tag (optional)</label>
                <input type="text" value={groupTag} onChange={e => setGroupTag(e.target.value)}
                  placeholder="e.g. event-2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setStep('upload')}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  Back
                </button>
                <button onClick={handleImport} disabled={!mapping.email || loading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all">
                  {loading ? 'Importing…' : variableCount > 0 ? `Import with ${variableCount} variable${variableCount !== 1 ? 's' : ''}` : 'Import'}
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
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
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
