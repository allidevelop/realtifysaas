import Link from 'next/link'

import { Icon, type IconName } from '@/components/Icon'
import type { Tool } from '@/payload-types'

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex flex-col rounded-xl border border-ink-100 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
        <Icon name={(tool.icon ?? 'spark') as IconName} className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-ink-900 group-hover:text-brand-700">
        {tool.title}
      </h3>
      <p className="mt-2 text-sm text-ink-500">{tool.summary}</p>
      <span className="mt-4 text-sm font-medium text-brand-600">Подробнее →</span>
    </Link>
  )
}
