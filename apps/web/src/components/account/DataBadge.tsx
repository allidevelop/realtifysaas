// Бейдж происхождения данных модуля: честно различает демонстрационные и реальные
// данные (DOM.RIA / Prozorro), чтобы не создавать впечатление, что всё реальное.

type Kind = 'demo' | 'real' | 'mixed'

const STYLE: Record<Kind, string> = {
  demo: 'bg-amber-50 text-amber-700 border-amber-200',
  real: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mixed: 'bg-sky-50 text-sky-700 border-sky-200',
}

export function DataBadge({
  kind,
  source,
  note,
}: {
  kind: Kind
  /** Источник реальных данных, напр. 'DOM.RIA', 'Prozorro'. */
  source?: string
  /** Поясняющий текст рядом с бейджем. */
  note?: string
}) {
  const label =
    kind === 'real'
      ? `реальні дані${source ? ` · ${source}` : ''}`
      : kind === 'mixed'
        ? `демо + реальні${source ? ` · ${source}` : ''}`
        : 'демонстраційні дані'

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[kind]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      {note && <span className="text-xs text-ink-400">{note}</span>}
    </span>
  )
}
