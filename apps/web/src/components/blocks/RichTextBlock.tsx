import type { RichTextBlock as RichTextBlockType } from '@/payload-types'

import { RichText } from '@/components/RichText'
import { Section } from '@/components/Section'
import { cn } from '@/lib/cn'

export function RichTextBlock({ content, width }: RichTextBlockType) {
  return (
    <Section>
      <div className={cn('mx-auto', width === 'narrow' ? 'max-w-2xl' : 'max-w-4xl')}>
        <RichText data={content} />
      </div>
    </Section>
  )
}
