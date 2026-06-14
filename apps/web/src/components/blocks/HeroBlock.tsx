import type { HeroBlock as HeroBlockType } from '@/payload-types'

import { Container } from '@/components/Container'
import { ButtonLink } from '@/components/ui/Button'

export function HeroBlock(props: HeroBlockType) {
  const { heading, subheading, ctaLabel, ctaHref, secondaryLabel, secondaryHref } = props
  return (
    <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50 to-white">
      <Container className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">{heading}</h1>
          {subheading && <p className="mt-5 text-lg text-ink-700 sm:text-xl">{subheading}</p>}
          {(ctaLabel || secondaryLabel) && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {ctaLabel && ctaHref && <ButtonLink href={ctaHref}>{ctaLabel}</ButtonLink>}
              {secondaryLabel && secondaryHref && (
                <ButtonLink href={secondaryHref} variant="secondary">
                  {secondaryLabel}
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
