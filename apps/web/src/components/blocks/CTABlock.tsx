import type { CTABlock as CTABlockType } from '@/payload-types'

import { Container } from '@/components/Container'
import { ButtonLink } from '@/components/ui/Button'

export function CTABlock({ heading, text, buttonLabel, buttonHref }: CTABlockType) {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="rounded-2xl bg-brand-700 px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
          {text && <p className="mx-auto mt-3 max-w-2xl text-brand-100">{text}</p>}
          {buttonLabel && buttonHref && (
            <div className="mt-7">
              <ButtonLink href={buttonHref} variant="secondary">
                {buttonLabel}
              </ButtonLink>
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
