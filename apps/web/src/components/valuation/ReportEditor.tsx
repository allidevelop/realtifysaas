'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = { type: string; version?: number; content: any[] }

// Людські підказки для полів, що оцінювач заповнює вручну.
const FIELD_LABELS: Record<string, string> = {
  rooms_text: 'кімнатність (напр. однокімнатної)',
  rooms_text_upper: 'кімнатність (напр. ОДНОКІМНАТНОЇ)',
  object_valuation_description: 'опис обʼєкта оцінки',
  object_valuation_description_short: 'короткий опис обʼєкта',
  location_description: 'характеристика місцезнаходження / району',
  object_building_details: 'характеристики будинку / ЖК',
  object_complex_name: 'назва ЖК',
}

// ── variableField: інлайн-значення з provenance (auto/placeholder/manual) ──────
function VariableFieldView(props: any) {
  const { node, updateAttributes } = props
  const { field, source, value } = node.attrs as { field: string; source: string; value: string }
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState<string>(value ?? '')
  const hint = FIELD_LABELS[field] || field

  // Навігатор полів просить відкрити саме це поле (по його позиції в документі).
  useEffect(() => {
    const onEdit = (e: Event) => {
      const detail = (e as CustomEvent).detail as { pos: number }
      if (typeof props.getPos === 'function' && detail?.pos === props.getPos()) {
        setVal(value ?? '')
        setEditing(true)
      }
    }
    window.addEventListener('vf-edit', onEdit)
    return () => window.removeEventListener('vf-edit', onEdit)
  }, [props, value])

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
          title={source === 'placeholder' ? `Заповнити: ${hint}` : `${hint} · ${source}`}
        >
          {value ? value : source === 'placeholder' ? `[${hint}]` : '———'}
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

// ── image / documentScan: блокові картинки (data-URI), read-only ──────────────
function ImageView(props: any) {
  const { srcRef, widthEmu, caption, href } = props.node.attrs as {
    srcRef: string
    widthEmu: number
    caption?: string | null
    href?: string | null
  }
  const widthMm = widthEmu ? Number(widthEmu) / 36000 : null
  return (
    <NodeViewWrapper className="rep-image" contentEditable={false}>
      {srcRef ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={srcRef} alt="" style={{ width: widthMm ? `${widthMm}mm` : '100%', maxWidth: '100%', display: 'block', margin: '0 auto' }} />
      ) : null}
      {(caption || href) && (
        <div className="rep-caption">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer">
              {caption || href}
            </a>
          ) : (
            caption
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { srcRef: { default: '' }, widthEmu: { default: 0 }, aspect: { default: 1 }, caption: { default: null }, href: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'figure[data-rep-image]' }]
  },
  renderHTML() {
    return ['figure', { 'data-rep-image': 'true' }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

const DocumentScanNode = Node.create({
  name: 'documentScan',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { kind: { default: '' }, srcRef: { default: '' }, widthEmu: { default: 0 }, aspect: { default: 1 }, locked: { default: true } }
  },
  parseHTML() {
    return [{ tag: 'figure[data-rep-scan]' }]
  },
  renderHTML() {
    return ['figure', { 'data-rep-scan': 'true' }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
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
  const [todo, setTodo] = useState<{ field: string; pos: number; hint: string }[]>([])
  const [navOpen, setNavOpen] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit, VariableField, LockedTable, ImageNode, DocumentScanNode],
    content: { type: 'doc', content: initialDoc.content },
    immediatelyRender: false,
  })

  // Живий список незаповнених полів (placeholder) — оновлюється при кожній правці.
  useEffect(() => {
    if (!editor) return
    const recompute = () => {
      const list: { field: string; pos: number; hint: string }[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'variableField' && node.attrs.source === 'placeholder') {
          list.push({ field: node.attrs.field, pos, hint: FIELD_LABELS[node.attrs.field] || node.attrs.field })
        }
      })
      setTodo(list)
    }
    recompute()
    editor.on('update', recompute)
    return () => {
      editor.off('update', recompute)
    }
  }, [editor])

  // Прыжок до поля: виділити, проскролити й відкрити інлайн-ввод.
  const jumpTo = (pos: number) => {
    if (!editor) return
    editor.chain().focus().setNodeSelection(pos).scrollIntoView().run()
    window.dispatchEvent(new CustomEvent('vf-edit', { detail: { pos } }))
    setNavOpen(false)
  }

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
      <div className="sticky top-[4.25rem] z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-surface/95 p-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className="ed-btn">B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className="ed-btn italic">I</button>
        <span className="mx-1 h-5 w-px bg-ink-200" />
        <label className="flex items-center gap-1.5 text-sm text-ink-700">
          <input type="checkbox" checked={showProv} onChange={(e) => setShowProv(e.target.checked)} className="accent-brand-600" />
          Показати походження
        </label>
        <span className="mx-1 h-5 w-px bg-ink-200" />
        <div className="relative">
          <button
            onClick={() => setNavOpen((o) => !o)}
            className={`ed-btn ${todo.length ? 'vf-todo-btn' : 'vf-done-btn'}`}
            title="Поля, які треба заповнити вручну"
          >
            {todo.length ? `📝 Заповнити: ${todo.length}` : '✓ Усі поля заповнені'}
          </button>
          {navOpen && todo.length > 0 && (
            <div className="vf-nav">
              <div className="vf-nav-head">Натисніть, щоб перейти й заповнити:</div>
              {todo.map((p, i) => (
                <button key={`${p.field}-${p.pos}`} onClick={() => jumpTo(p.pos)} className="vf-nav-item">
                  <span className="vf-nav-num">{i + 1}</span>
                  {p.hint}
                </button>
              ))}
            </div>
          )}
        </div>
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

      {/* Швидкий доступ знизу: вгору + зберегти/експорт (видно з будь-якого місця) */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Вгору" className="fab" aria-label="Вгору">
          ↑
        </button>
        <div className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-surface/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          <button onClick={save} disabled={busy} className="ed-btn-primary">Зберегти</button>
          <button onClick={() => exportReport('pdf', 'clean')} disabled={busy} className="ed-btn-primary">PDF</button>
          <button onClick={() => exportReport('docx', 'clean')} disabled={busy} className="ed-btn-primary">Word</button>
        </div>
      </div>

      <style>{`
        .report-canvas { background:#fff; color:#000; border:1px solid var(--color-ink-200); border-radius:12px; padding:24mm 18mm; font-family:"Times New Roman","Tinos",serif; font-size:14pt; line-height:1.4; }
        .report-canvas h2 { text-align:center; font-size:14pt; font-weight:bold; margin:10pt 0 4pt; }
        .report-canvas h3 { font-size:14pt; font-weight:bold; margin:8pt 0 4pt; }
        .report-canvas p { text-align:justify; text-indent:12.5mm; margin:0; }
        .report-canvas .ProseMirror:focus { outline:none; }
        .vf { border-radius:3px; padding:0 1px; cursor:text; }
        .vf-placeholder { outline:1px dashed #e57373; color:#c62828; font-style:italic; }
        .show-prov .vf-auto { background:#E6F4EA; }
        .show-prov .vf-placeholder { background:#FDECEA; }
        .show-prov .vf-manual { background:#E8F0FE; }
        .vf-input { font:inherit; border:1px solid #90caf9; border-radius:3px; padding:0 2px; min-width:60px; }
        .locked-wrap { margin:6pt 0; position:relative; }
        .locked-badge { font-family:system-ui; font-size:11px; color:#777; margin-bottom:2px; }
        .locked-tbl { border-collapse:collapse; table-layout:fixed; font-size:8pt; }
        .locked-tbl td, .locked-tbl th { border:0.5pt solid #000; vertical-align:top; padding:0.3mm 1mm; text-align:center; word-wrap:break-word; }
        .rep-image { margin:6pt 0; }
        .rep-image img { border:1px solid var(--color-ink-100); }
        .rep-caption { text-align:center; font-size:11pt; margin-top:2px; }
        .rep-caption a { color:#0563C1; }
        .ed-btn { border:1px solid var(--color-ink-200); border-radius:8px; padding:4px 10px; font-size:13px; background:var(--color-surface); }
        .ed-btn-primary { border:none; border-radius:8px; padding:5px 12px; font-size:13px; font-weight:600; color:#fff; background:var(--color-brand-600); }
        .ed-btn-primary:disabled { opacity:.6; }
        .fab { width:42px; height:42px; border-radius:9999px; border:1px solid var(--color-ink-200); background:var(--color-surface); color:var(--color-ink-700); font-size:20px; line-height:1; box-shadow:0 2px 10px rgba(0,0,0,.18); cursor:pointer; }
        .fab:hover { background:var(--color-ink-100); }
        .vf-todo-btn { border-color:#e57373; color:#c62828; font-weight:600; }
        .vf-done-btn { border-color:#66bb6a; color:#2e7d32; font-weight:600; }
        .vf-nav { position:absolute; top:calc(100% + 6px); left:0; z-index:50; width:300px; max-height:50vh; overflow:auto; background:var(--color-surface); border:1px solid var(--color-ink-200); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); padding:6px; }
        .vf-nav-head { font-size:11px; color:var(--color-ink-500); padding:4px 6px 6px; }
        .vf-nav-item { display:flex; align-items:center; gap:8px; width:100%; text-align:left; font-size:13px; color:var(--color-ink-800); padding:6px 8px; border-radius:7px; background:none; border:none; cursor:pointer; }
        .vf-nav-item:hover { background:var(--color-ink-100); }
        .vf-nav-num { flex:0 0 auto; width:18px; height:18px; border-radius:9999px; background:#FDECEA; color:#c62828; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }
        .ProseMirror .ProseMirror-selectednode .vf { box-shadow:0 0 0 2px #fbc02d; border-radius:3px; }
      `}</style>
    </div>
  )
}
