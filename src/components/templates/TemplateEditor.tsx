'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Template } from '@/types'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  template: Template | null
  onClose: () => void
  onSaved: () => void
}

// Always-available built-in variables
const BUILTIN_VARS = ['name', 'email']

// Auto-injected RSVP variables — available when template uses them
const RSVP_VARS = ['rsvp_yes_link', 'rsvp_no_link']

// Extract {{variable}} names from text
function extractVars(text: string): string[] {
  const matches = text.matchAll(/\{\{(\w+)\}\}/g)
  const vars = new Set<string>()
  for (const m of matches) vars.add(m[1])
  return Array.from(vars)
}

function buildEmailHtml(subject: string, fromName: string, fromEmail: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F3F4F6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;">
          <tr>
            <td style="background-color:#ffffff;border:1px solid #E5E7EB;border-radius:12px 12px 0 0;border-bottom:none;padding:16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:1px solid #F3F4F6;">
                    <span style="font-size:15px;font-weight:700;color:#111827;">${subject || '(no subject)'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;">
                    <span style="font-size:13px;font-weight:600;color:#374151;">From&nbsp;&nbsp;</span>
                    <span style="font-size:13px;color:#6B7280;">${fromName} &lt;${fromEmail}&gt;</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:4px;">
                    <span style="font-size:13px;font-weight:600;color:#374151;">To&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    <em style="font-size:13px;color:#9CA3AF;">recipient@example.com</em>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
              <div style="padding:16px 28px 28px 28px;font-size:15px;line-height:1.7;color:#111827;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
        </table>
        <p style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:16px;letter-spacing:0.05em;text-transform:uppercase;">Preview only — variables like {{name}} will be replaced on send</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export default function TemplateEditor({ template, onClose, onSaved }: Props) {
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [fromName, setFromName] = useState(template?.from_name ?? '')
  const [fromEmail, setFromEmail] = useState(template?.from_email ?? 'no-reply@provaliantgroup.com')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allVars, setAllVars] = useState<string[]>(BUILTIN_VARS)
  const [contactVars, setContactVars] = useState<Record<string, string>>({}) // key -> sample value
  // Track which field is focused: 'subject' | 'body'
  const [focusedField, setFocusedField] = useState<'subject' | 'body'>('body')
  const subjectRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Fetch contact variables on mount
  useEffect(() => {
    fetch('/api/contacts/variables')
      .then(r => r.json())
      .then(data => setContactVars(data ?? {}))
      .catch(() => {})
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your email body here… Use {{name}}, {{email}}, etc. for personalization.' }),
    ],
    content: template?.body_html ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
    onFocus: () => setFocusedField('body'),
  })

  // Recompute variable list whenever subject or body changes
  useEffect(() => {
    const bodyHtml = editor?.getHTML() ?? ''
    const found = extractVars(`${subject} ${bodyHtml}`)
    const merged = Array.from(new Set([...BUILTIN_VARS, ...found]))
    setAllVars(merged)
  }, [subject, editor])

  // Insert variable at cursor — into editor or subject field
  const insertVariable = useCallback((varName: string) => {
    const token = `{{${varName}}}`
    if (focusedField === 'subject') {
      // Insert at cursor position in subject input
      const input = subjectRef.current
      if (input) {
        const start = input.selectionStart ?? subject.length
        const end = input.selectionEnd ?? subject.length
        const newVal = subject.slice(0, start) + token + subject.slice(end)
        setSubject(newVal)
        // Restore cursor after the inserted token
        requestAnimationFrame(() => {
          input.focus()
          input.setSelectionRange(start + token.length, start + token.length)
        })
      } else {
        setSubject(s => s + token)
      }
    } else {
      // Insert into Tiptap editor at current cursor
      editor?.chain().focus().insertContent(token).run()
    }
  }, [focusedField, subject, editor])

  // Inject full HTML into iframe when preview is shown
  useEffect(() => {
    if (!preview || !iframeRef.current) return
    const html = buildEmailHtml(subject, fromName, fromEmail, editor?.getHTML() ?? '')
    const doc = iframeRef.current.contentDocument
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    }
  }, [preview, subject, fromName, fromEmail, editor])

  async function save() {
    const body_html = editor?.getHTML() ?? ''
    if (!name || !subject || !fromName || !fromEmail || !body_html) {
      setError('All fields are required')
      return
    }
    setSaving(true)
    setError('')
    const isNew = !template || !template.id
    const url = isNew ? '/api/templates' : `/api/templates/${template.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, from_name: fromName, from_email: fromEmail, body_html }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ${preview ? 'w-full max-w-4xl' : 'w-full max-w-3xl'}`}
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {!template || !template.id ? (template ? 'Duplicate Template' : 'New Template') : 'Edit Template'}
            </h2>
            {preview && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                Email Preview
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreview(p => !p)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${preview ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 hover:bg-indigo-50'}`}
            >
              {preview ? '← Edit' : 'Preview →'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
            >×</button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {!preview ? (
            <div className="p-6 space-y-4">
              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Welcome Email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    ref={subjectRef}
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    onFocus={() => setFocusedField('subject')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Hello {{name}}!"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From name</label>
                  <input
                    value={fromName}
                    onChange={e => setFromName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Company Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From email</label>
                  <input
                    value={fromEmail}
                    onChange={e => setFromEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>

              {/* Variable insert panel */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Insert Variable</span>
                  <span className="text-xs text-indigo-400">
                    — click to insert at cursor in {focusedField === 'subject' ? 'Subject' : 'Body'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Built-in variables */}
                  {BUILTIN_VARS.map(v => (
                    <button key={v} type="button" onClick={() => insertVariable(v)}
                      title={`Built-in: always available`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-mono rounded-lg transition-colors shadow-sm">
                      <span>{`{{${v}}}`}</span>
                      <span className="text-indigo-300 text-xs ml-0.5 font-sans not-italic">built-in</span>
                    </button>
                  ))}
                  {/* RSVP variables */}
                  {RSVP_VARS.map(v => (
                    <button key={v} type="button" onClick={() => insertVariable(v)}
                      title="RSVP link — auto-generated per recipient. Use as href in an anchor tag."
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-200 hover:border-emerald-500 hover:bg-emerald-600 hover:text-white text-emerald-700 text-xs font-mono rounded-lg transition-colors shadow-sm group">
                      <span>{`{{${v}}}`}</span>
                      <span className="text-emerald-300 group-hover:text-emerald-200 text-xs font-sans">RSVP</span>
                    </button>
                  ))}
                  {/* Insert RSVP buttons as actual HTML */}
                  <button
                    type="button"
                    onClick={() => {
                      const html = `<p style="text-align:center;margin:24px 0">
<a href="{{rsvp_yes_link}}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;margin:6px;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(22,163,74,0.3)">✓ &nbsp;Ya, Saya Hadir</a>
&nbsp;&nbsp;
<a href="{{rsvp_no_link}}" style="display:inline-block;padding:14px 32px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;margin:6px;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(220,38,38,0.3)">✗ &nbsp;Maaf, Saya Tidak Bisa Hadir</a>
</p>`
                      editor?.chain().focus().insertContent(html).run()
                      setFocusedField('body')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                    title="Insert RSVP Yes/No buttons as clickable HTML into the email body"
                  >
                    + Insert RSVP Buttons
                  </button>
                  {/* Contact variables from import */}
                  {Object.entries(contactVars).map(([v, sample]) => (
                    <button key={v} type="button" onClick={() => insertVariable(v)}
                      title={`From contacts — e.g. "${sample}"`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-violet-200 hover:border-violet-500 hover:bg-violet-600 hover:text-white text-violet-700 text-xs font-mono rounded-lg transition-colors shadow-sm group">
                      <span>{`{{${v}}}`}</span>
                      <span className="text-violet-300 group-hover:text-violet-200 text-xs font-sans truncate max-w-[80px]" title={sample}>
                        e.g. {sample}
                      </span>
                    </button>
                  ))}
                  {/* Custom variable input */}
                  <CustomVarInput onInsert={insertVariable} />
                </div>
              </div>

              {/* Body editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
                    {[
                      { label: 'B', title: 'Bold', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                      { label: 'I', title: 'Italic', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
                      { label: 'H2', title: 'Heading', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
                      { label: 'UL', title: 'Bullet list', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
                      { label: 'OL', title: 'Numbered list', action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        title={btn.title}
                        onClick={btn.action}
                        className={`px-2 py-1 text-xs font-mono rounded transition-colors ${btn.active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <EditorContent editor={editor} />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              className="w-full border-0"
              style={{ height: '600px' }}
              sandbox="allow-same-origin"
              title="Email Preview"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-400">
            {preview
              ? 'Variables like {{name}} will be replaced with real values on send.'
              : 'Click a variable chip to insert it at your cursor position.'}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Small inline component for adding a custom variable
function CustomVarInput({ onInsert }: { onInsert: (v: string) => void }) {
  const [val, setVal] = useState('')
  const [open, setOpen] = useState(false)

  function commit() {
    const clean = val.trim().replace(/\W/g, '_').replace(/^_+|_+$/g, '')
    if (clean) {
      onInsert(clean)
      setVal('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-500 hover:text-indigo-700 text-xs rounded-lg transition-colors"
      >
        + custom
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-xs font-mono text-indigo-400">{'{{'}</span>
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setOpen(false)
        }}
        className="w-24 px-2 py-1 border border-indigo-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
        placeholder="var_name"
      />
      <span className="text-xs font-mono text-indigo-400">{'}}'}</span>
      <button
        type="button"
        onClick={commit}
        className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
      >
        Insert
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-gray-400 hover:text-gray-600 text-xs"
      >✕</button>
    </div>
  )
}
