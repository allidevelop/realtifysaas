import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { cn } from '@/lib/cn'

// Lexical-контент в payload-types типизирован структурно (с index-signature),
// поэтому принимаем широкий тип и приводим к SerializedEditorState на границе.
type LexicalData = { [k: string]: unknown }

// Рендер lexical-контента Payload в HTML (ТЗ §8). Типографика — Tailwind prose.
export function RichText({
  data,
  className,
}: {
  data?: LexicalData | null
  className?: string
}) {
  if (!data) return null
  return (
    <div
      className={cn(
        'prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-brand-600',
        className,
      )}
    >
      <LexicalRichText data={data as unknown as SerializedEditorState} />
    </div>
  )
}
