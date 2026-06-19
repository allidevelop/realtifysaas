'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = { type: string; version?: number; content: any[] }

// ── variableField: інлайн-значення з provenance (auto/placeholder/manual) ──────
function VariableFieldView(props: any) {
  const { node, updateAttributes } = props
  const { field, source, value } = node.attrs as { field: string; source: string; value: string }
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState<string>(value ?? '')

  const commit = () => {
    setEditing(false)
    if (val !== value) updateAttributes({ value: val, source: 'manual' })
  }
  return (
    <NodeViewWrapper as="span" className={`vf vf-${editing ? 'editing' : source}`}>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          className="vf-input"
        />
      ) : (
        <span
          onClick={() => {
            setVal(value ?? '')
            setEditing(true)
          }}
          title={`{${field}} · ${source}`}
        >
          {value || '———'}
        </span>
      )}
    </NodeViewWrapper>
  )
}

const VariableField = Node.create({
  name: 'variableField',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { field: { default: '' }, source: { default: 'auto' }, value: { default: '' }, format: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'span[data-field]' }]
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'vf' }), HTMLAttributes.value || '']
  },
  addNodeView() {
    return ReactNodeViewRenderer(VariableFieldView)
  },
})

// ── table: locked-atom, лише читання (пересобирается з Excel-сайдкара) ─────────
function LockedTableView(props: any) {
  const { header, rows, columnsMm } = props.node.attrs as {
    header: string[]
    rows: string[][]
    columnsMm: number[]
  }
  return (
    <NodeViewWrapper className="locked-wrap" contentEditable={false}>
      <div className="locked-badge">🔒 Розраховано з Excel — редагується лише у вихідних даних</div>
      <table className="locked-tbl" style={{ width: `${(columnsMm || []).reduce((a, b) => a + b, 0)}mm` }}>
        <colgroup>
          {(columnsMm || []).map((w, i) => (
            <col key={i} style={{ width: `${w}mm` }} />
          ))}
        </colgroup>
        {header && header.length > 0 && (
          <thead>
            <tr>
              {header.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </NodeViewWrapper>
  )
}

const LockedTable = Node.create({
  name: 'table',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: { default: '' },
      header: { default: [] },
      rows: { default: [] },
      columnsMm: { default: [] },
      source: { default: '' },
      locked: { default: true },
    }
  },
  parseHTML() {
    return [{ tag: 'table[data-locked]' }]
  },
  renderHTML() {
    return ['table', { 'data-locked': 'true' }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(LockedTableView)
  },
})

function countPlaceholders(doc: any): number {
  let n = 0
  const walk = (node: any) => {
    if (node?.type === 'variableField' && node?.attrs?.source === 'placeholder') n += 1
    for (const c of node?.content || []) walk(c)
  }
  walk(doc)
  return n
}

export function ReportEditor({ jobId, object, initialDoc }: { jobId: string; object: string; initialDoc: Doc }) {
  const [showProv, setShowProv] = useState(true)
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit, VariableField, LockedTable],
    content: { type: 'doc', content: initialDoc.content },
    immediatelyRender: false,
  })

  const getDoc = () => ({ type: 'doc', version: 1, content: editor?.getJSON().content ?? [] })

  async function save() {
    if (!editor) return
    setBusy(true)
    setStatus('Збереження…')
    try {
      const r = await fetch(`/account/auto-valuation/report?job=${jobId}&object=${encodeURIComponent(object)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: getDoc() }),
      })
      const d = await r.json()
      setStatus(r.ok ? `Збережено. Незаповнених полів: ${d.unfilled?.length ?? 0}` : `Помилка: ${JSON.stringify(d.detail || d.error)}`)
    } catch {
      setStatus('Помилка мережі.')
    } finally {
      setBusy(false)
    }
  }

  async function exportReport(fmt: 'pdf' | 'docx', mode: 'clean' | 'review') {
    if (!editor) return
    const doc = getDoc()
    if (mode === 'clean') {
      const left = countPlaceholders(doc)
      if (left > 0) {
        setStatus(`Заповніть ${left} плейсхолдер(ів) перед чистовим експортом (або експортуйте ревʼю-копію).`)
        return
      }
    }
    setBusy(true)
    setStatus(`Експорт ${fmt.toUpperCase()} (${mode})…`)
    try {
      const r = await fetch(`/account/auto-valuation/export-${fmt}?job=${jobId}&object=${encodeURIComponent(object)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: doc, mode }),
      })
      const d = await r.json()
      if (!r.ok) {
        setStatus(`Помилка експорту: ${JSON.stringify(d.detail || d.error)}`)
        return
      }
      setStatus('Готово — завантаження…')
      window.location.href = `/account/auto-valuation/download?job=${jobId}&name=${encodeURIComponent(d.file)}`
    } catch {
      setStatus('Помилка мережі.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-surface p-3 shadow-sm">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className="ed-btn">B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className="ed-btn italic">I</button>
        <span className="mx-1 h-5 w-px bg-ink-200" />
        <label className="flex items-center gap-1.5 text-sm text-ink-700">
          <input type="checkbox" checked={showProv} onChange={(e) => setShowProv(e.target.checked)} className="accent-brand-600" />
          Показати походження
        </label>
        <span className="mx-1 h-5 w-px bg-ink-200" />
        <button onClick={save} disabled={busy} className="ed-btn-primary">Зберегти</button>
        <button onClick={() => exportReport('pdf', 'clean')} disabled={busy} className="ed-btn-primary">PDF</button>
        <button onClick={() => exportReport('docx', 'clean')} disabled={busy} className="ed-btn-primary">Word</button>
        <button onClick={() => exportReport('pdf', 'review')} disabled={busy} className="ed-btn">PDF (ревʼю)</button>
        {status && <span className="ml-2 text-sm text-ink-500">{status}</span>}
      </div>

      <div className={`report-canvas${showProv ? ' show-prov' : ''}`}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .report-canvas { background:#fff; color:#000; border:1px solid var(--color-ink-200); border-radius:12px; padding:24mm 18mm; font-family:"Times New Roman","Tinos",serif; font-size:14pt; line-height:1.4; }
        .report-canvas h2 { text-align:center; font-size:14pt; font-weight:bold; margin:10pt 0 4pt; }
        .report-canvas h3 { font-size:14pt; font-weight:bold; margin:8pt 0 4pt; }
        .report-canvas p { text-align:justify; text-indent:12.5mm; margin:0; }
        .report-canvas .ProseMirror:focus { outline:none; }
        .vf { border-radius:3px; padding:0 1px; cursor:text; }
        .vf-placeholder { outline:1px dashed #e57373; }
        .show-prov .vf-auto { background:#E6F4EA; }
        .show-prov .vf-placeholder { background:#FDECEA; }
        .show-prov .vf-manual { background:#E8F0FE; }
        .vf-input { font:inherit; border:1px solid #90caf9; border-radius:3px; padding:0 2px; min-width:60px; }
        .locked-wrap { margin:6pt 0; position:relative; }
        .locked-badge { font-family:system-ui; font-size:11px; color:#777; margin-bottom:2px; }
        .locked-tbl { border-collapse:collapse; table-layout:fixed; font-size:8pt; }
        .locked-tbl td, .locked-tbl th { border:0.5pt solid #000; vertical-align:top; padding:0.3mm 1mm; text-align:center; word-wrap:break-word; }
        .ed-btn { border:1px solid var(--color-ink-200); border-radius:8px; padding:4px 10px; font-size:13px; background:var(--color-surface); }
        .ed-btn-primary { border:none; border-radius:8px; padding:5px 12px; font-size:13px; font-weight:600; color:#fff; background:var(--color-brand-600); }
        .ed-btn-primary:disabled { opacity:.6; }
      `}</style>
    </div>
  )
}
