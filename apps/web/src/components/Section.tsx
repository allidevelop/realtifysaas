import type { ReactNode } from 'react'

import { Container } from '@/components/Container'
import { cn } from '@/lib/cn'

// Универсальная секция с вертикальными отступами и опц. фоном.
export function Section({
  children,
  className,
  muted = false,
  containerClassName,
}: {
  children: ReactNode
  className?: string
  muted?: boolean
  containerClassName?: string
}) {
  return (
    <section className={cn('py-16 sm:py-20', muted && 'bg-ink-100/40', className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  )
}

export function SectionHeading({
  title,
  intro,
  centered = true,
}: {
  title?: string | null
  intro?: string | null
  centered?: boolean
}) {
  if (!title && !intro) return null
  return (
    <div className={cn('mb-10 max-w-2xl', centered && 'mx-auto text-center')}>
      {title && <h2 className="text-3xl font-bold tracking-tight text-ink-900">{title}</h2>}
      {intro && <p className="mt-3 text-lg text-ink-500">{intro}</p>}
    </div>
  )
}
