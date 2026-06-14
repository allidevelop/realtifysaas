import type { Metadata } from 'next'
import Link from 'next/link'

import { PlanCard } from '@/components/PlanCard'
import { Section, SectionHeading } from '@/components/Section'
import { getServicePlans } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Тарифы',
    description:
      'Тарифы Realtify: подписки на инструменты оценки и аналитики, корпоративные планы, безнал для юрлиц.',
    path: '/pricing',
  })
}

export default async function PricingPage() {
  const plans = await getServicePlans()

  // JSON-LD: каждый тариф как Offer (ТЗ §13).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Realtify — подписки',
    offers: plans.map((p) => ({
      '@type': 'Offer',
      name: p.name,
      price: p.price,
      priceCurrency: p.currency,
    })),
  }

  return (
    <Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SectionHeading
        title="Тарифы и подписки"
        intro="Выберите план под свои задачи. Для банков и юрлиц — оплата по безналу (счёт/акт)."
      />
      {plans.length === 0 ? (
        <p className="text-center text-ink-500">Тарифы ещё не настроены в CMS.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
      <p className="mt-10 text-center text-sm text-ink-500">
        Юридическим лицам и банкам доступна оплата по счёту (рахунок-фактура → акт). Реквизиты — на
        странице{' '}
        <Link className="text-brand-600" href="/contacts">
          контактов
        </Link>
        .
      </p>
    </Section>
  )
}
