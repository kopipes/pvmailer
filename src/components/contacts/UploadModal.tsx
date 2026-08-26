'use client'

import { useState, useRef } from 'react'
import ExcelJS from 'exceljs'

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
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    setFile(f)
    // Read headers client-side
    const buffer = await f.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const ws = workbook.worksheets[0]
    const row = ws.getRow(1)
    const hdrs: string[] = []
    row.eachCell((cell) => hdrs.push(String(cell.value ?? '').trim()))
    setHeaders(hdrs)
    // Auto-detect email column
    const emailGuess = hdrs.find(h => /email/i.test(h)) ?? ''
    const nameGuess = hdrs.find(h => /name/i.test(h)) ?? ''
    setMapping({ email: emailGuess, name: nameGuess })
    setStep('map')
  }

  async function handleImport() {
    if (!file || !mapping.email) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    if (groupTag) fd.append('groupTag', groupTag)

    const res = await fetch('/api/contacts/import', { method: 'POST', body: fd })
    const data = await res.json()
    setResult(data)
    setStep('done')
    setLoading(false)
    if (data.imported > 0) onSuccess(data)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Import Contacts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onDragOver={(e) => e.preventDefault()}
              >
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm text-gray-600 font-medium">Click or drop your Excel file here</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx files only</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Map Excel columns to contact fields. <span className="font-medium">Email is required.</span>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email column <span className="text-red-500">*</span></label>
                <select
                  value={mapping.email}
                  onChange={e => setMapping(m => ({ ...m, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select column…</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name column (optional)</label>
                <select
                  value={mapping.name}
                  onChange={e => setMapping(m => ({ ...m, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group tag (optional)</label>
                <input
                  type="text"
                  value={groupTag}
                  onChange={e => setGroupTag(e.target.value)}
                  placeholder="e.g. event-2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('upload')} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={!mapping.email || loading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="text-center space-y-4">
              <div className="text-4xl">{result.imported > 0 ? '✅' : '⚠️'}</div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{result.imported} contacts imported</p>
                {result.skipped > 0 && <p className="text-sm text-gray-500">{result.skipped} skipped</p>}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 text-left max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
              <button onClick={onClose} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
