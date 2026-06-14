import type { Metadata } from 'next'
import Link from 'next/link'

import { PlanCard } from '@/components/PlanCard'
import { Section, SectionHeading } from '@/components/Section'
import { getPacksGroupedByModule } from '@/lib/billing/catalog'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Тарифы',
    description:
      'Пакеты Realtify по модулям: карта, оценка, отчёты, аналитика. Квоты и периоды; для банков и юрлиц — безнал (счёт/акт).',
    path: '/pricing',
  })
}

export default async function PricingPage() {
  const groups = await getPacksGroupedByModule()
  const allPacks = groups.flatMap((g) => g.packs)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Realtify — пакети модулів',
    offers: allPacks.map((p) => ({
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
        title="Пакети та тарифи"
        intro="Кожен модуль — окремими пакетами квот або за періодом. Для банків і юросіб — оплата за рахунком (рахунок-фактура → акт)."
      />

      {groups.length === 0 ? (
        <p className="text-center text-ink-500">Пакети ще не налаштовані.</p>
      ) : (
        <div className="space-y-14">
          {groups.map((g) => (
            <div key={g.moduleKey}>
              <h2 className="mb-6 text-center text-2xl font-bold text-ink-900">{g.module.name}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {g.packs.map((pack) => (
                  <PlanCard key={pack.id} plan={pack} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-12 text-center text-sm text-ink-500">
        Юридичним особам і банкам доступна оплата за рахунком (рахунок-фактура → акт). Деталі —{' '}
        <Link className="text-brand-600" href="/contacts">
          у контактах
        </Link>
        .
      </p>
    </Section>
  )
}
