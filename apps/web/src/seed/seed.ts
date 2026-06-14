/**
 * Логика наполнения CMS демо-контентом (ТЗ §8, этап 1). Идемпотентна.
 * Вызывается из src/seed/index.ts (`payload run`) и из route /seed (рантайм Next).
 */
import type { Payload } from 'payload'

import { richTextFromParagraphs } from '@/lib/lexical'

export async function runSeed(payload: Payload): Promise<{ ok: true }> {
  const log = (msg: string) => payload.logger.info(`[seed] ${msg}`)

  // ── admin ──────────────────────────────────────────────────────
  {
    const existing = await payload.find({ collection: 'users', limit: 1 })
    if (existing.totalDocs === 0) {
      const email = process.env.SEED_ADMIN_EMAIL || 'admin@realtify.local'
      const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345'
      await payload.create({
        collection: 'users',
        data: { email, password, name: 'Администратор', roles: ['admin'] },
      })
      log(`admin создан: ${email} / ${password}`)
    } else {
      log('пользователи уже есть — admin не создаю')
    }
  }

  // ── service plans ──────────────────────────────────────────────
  {
    const existing = await payload.find({ collection: 'service-plans', limit: 1 })
    if (existing.totalDocs === 0) {
      const plans = [
        {
          name: 'Тест', tier: 'test' as const, tagline: 'Познакомиться с платформой',
          price: 0, currency: 'UAH' as const, billingPeriod: 'month' as const,
          requestLimit: 5, historyDepthMonths: 1, exportEnabled: false, apiAccess: false, seats: 1,
          order: 1, isActive: true,
          features: [{ label: 'Публичная карта цен' }, { label: '5 экспресс-оценок/мес' }, { label: 'Telegram-бот' }],
        },
        {
          name: 'Базовый', tier: 'basic' as const, tagline: 'Для риелторов и аналитиков',
          price: 490, currency: 'UAH' as const, billingPeriod: 'month' as const,
          requestLimit: 100, historyDepthMonths: 12, exportEnabled: false, apiAccess: false, seats: 1,
          order: 2, isActive: true,
          features: [{ label: '100 оценок/мес' }, { label: 'Ретроспектива 12 мес' }, { label: 'Карта без ограничений' }],
        },
        {
          name: 'Профи', tier: 'pro' as const, tagline: 'Для оценщиков и экспертов',
          price: 1490, currency: 'UAH' as const, billingPeriod: 'month' as const,
          requestLimit: 1000, historyDepthMonths: 60, exportEnabled: true, apiAccess: false, seats: 1,
          highlighted: true, order: 3, isActive: true,
          features: [{ label: '1000 оценок/мес' }, { label: 'Ретроспектива 5 лет' }, { label: 'Экспорт в Word/PDF' }, { label: 'Детальные отчёты' }],
        },
        {
          name: 'Корпоративный', tier: 'corporate' as const, tagline: 'Для банков и застройщиков',
          price: 9900, currency: 'UAH' as const, billingPeriod: 'month' as const,
          requestLimit: 0, historyDepthMonths: 120, exportEnabled: true, apiAccess: true, seats: 10,
          order: 4, isActive: true, ctaLabel: 'Запросить счёт',
          features: [{ label: 'Безлимит оценок' }, { label: 'Доступ к API' }, { label: '10 мест (seats)' }, { label: 'Безнал: счёт/акт' }, { label: 'Приоритетная поддержка' }],
        },
      ]
      for (const data of plans) await payload.create({ collection: 'service-plans', data })
      log(`создано тарифов: ${plans.length}`)
    } else {
      log('тарифы уже есть — пропускаю')
    }
  }

  // ── tools ──────────────────────────────────────────────────────
  {
    const existing = await payload.find({ collection: 'tools', limit: 1 })
    if (existing.totalDocs === 0) {
      const tools = [
        { title: 'Карта цен', slug: 'price-map', icon: 'map' as const, order: 1, summary: 'Интерактивная choropleth-карта цен по областям, районам и громадам с фильтрами и drill-down.' },
        { title: 'Экспресс-оценка', slug: 'express-valuation', icon: 'calc' as const, order: 2, summary: 'Быстрая сравнительная оценка объекта по аналогам с метрикой доверия.' },
        { title: 'Детальные отчёты', slug: 'reports', icon: 'report' as const, order: 3, summary: 'Обоснованные отчёты оценки с аналогами и корректировками — экспорт в Word/PDF.' },
        { title: 'Публичный API', slug: 'api', icon: 'api' as const, order: 4, summary: 'Программный доступ к экспресс-оценке и агрегатам для застройщиков и банков.' },
        { title: 'Telegram-бот', slug: 'bot', icon: 'bot' as const, order: 5, summary: 'Бесплатная быстрая оценка прямо в Telegram: адрес → площадь → цена.' },
      ]
      for (const t of tools) {
        await payload.create({
          collection: 'tools',
          data: {
            ...t,
            isActive: true,
            content: richTextFromParagraphs([
              `${t.title} — один из инструментов платформы Realtify.`,
              'Полное описание и возможности будут дополнены по мере развития продукта.',
            ]),
          },
        })
      }
      log(`создано инструментов: ${tools.length}`)
    } else {
      log('инструменты уже есть — пропускаю')
    }
  }

  // ── news ───────────────────────────────────────────────────────
  {
    const existing = await payload.find({ collection: 'news', limit: 1 })
    if (existing.totalDocs === 0) {
      const items = [
        {
          title: 'Запуск платформы Realtify', slug: 'launch',
          excerpt: 'Мы начали накопление собственного временного ряда цен на недвижимость.',
          paras: ['Realtify запускается как геоаналитическая платформа рынка недвижимости.', 'С первого дня мы накапливаем собственный временной ряд данных — это актив, ценность которого растёт каждый месяц.'],
        },
        {
          title: 'Методология оценки для банков', slug: 'valuation-methodology',
          excerpt: 'Прозрачные корректировки и метрика доверия вместо «чёрного ящика».',
          paras: ['Оценка строится на сравнительном подходе: подбор аналогов, корректировки на ценообразующие факторы, средневзвешенное по схожести.', 'Для банков важна обоснованность — мы показываем аналоги, их веса и метрику доверия.'],
        },
      ]
      for (const it of items) {
        await payload.create({
          collection: 'news',
          data: {
            title: it.title, slug: it.slug, excerpt: it.excerpt,
            publishedAt: new Date().toISOString(),
            content: richTextFromParagraphs(it.paras),
            _status: 'published',
          },
        })
      }
      log(`создано новостей: ${items.length}`)
    } else {
      log('новости уже есть — пропускаю')
    }
  }

  // ── team & partners ────────────────────────────────────────────
  {
    const team = await payload.find({ collection: 'team-members', limit: 1 })
    if (team.totalDocs === 0) {
      const members = [
        { name: 'Олег Власенко', role: 'Основатель, продукт', order: 1, bio: 'Архитектура продукта и стратегия данных.' },
        { name: 'Ірина Коваль', role: 'Аналитика рынка', order: 2, bio: 'Методология оценки и качество данных.' },
      ]
      for (const m of members) await payload.create({ collection: 'team-members', data: m })
      log(`создано членов команды: ${members.length}`)
    }

    const partners = await payload.find({ collection: 'partners', limit: 1 })
    if (partners.totalDocs === 0) {
      const list = [
        { name: 'Відкриті дані (data.gov.ua)', url: 'https://data.gov.ua', order: 1 },
        { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org', order: 2 },
      ]
      for (const p of list) await payload.create({ collection: 'partners', data: p })
      log(`создано партнёров: ${list.length}`)
    }
  }

  // ── site settings ──────────────────────────────────────────────
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName: 'Realtify',
      tagline: 'Геоаналитика рынка недвижимости',
      headerNav: [
        { label: 'Инструменты', href: '/tools' },
        { label: 'Тарифы', href: '/pricing' },
        { label: 'Новости', href: '/news' },
        { label: 'О нас', href: '/about' },
        { label: 'Контакты', href: '/contacts' },
      ],
      footerNav: [
        { label: 'О системе', href: '/about' },
        { label: 'Тарифы', href: '/pricing' },
        { label: 'Новости', href: '/news' },
        { label: 'Контакты', href: '/contacts' },
        { label: 'Публичная оферта', href: '/legal/oferta' },
        { label: 'Политика приватности', href: '/legal/privacy' },
      ],
      email: 'hello@realtify.local',
      phone: '+380 (00) 000-00-00',
      telegram: 'https://t.me/realtify_bot',
    },
  })
  log('SiteSettings обновлены')

  // ── pages ──────────────────────────────────────────────────────
  await upsertPage(payload, log, 'home', {
    title: 'Главная', slug: 'home', section: 'general', _status: 'published',
    layout: [
      {
        blockType: 'hero',
        heading: 'Геоаналитика рынка недвижимости',
        subheading: 'Карта цен, экспресс-оценка по аналогам, отчёты и API — на легитимных данных и с прозрачной методологией.',
        ctaLabel: 'Смотреть тарифы', ctaHref: '/pricing',
        secondaryLabel: 'Об инструментах', secondaryHref: '/tools',
      },
      {
        blockType: 'stats', heading: 'Платформа в цифрах',
        items: [
          { value: '24', label: 'области Украины' },
          { value: 'PostGIS', label: 'гео-движок' },
          { value: 'API', label: 'для банков и застройщиков' },
          { value: '0₴', label: 'старт бесплатно' },
        ],
      },
      {
        blockType: 'featureGrid', heading: 'Почему Realtify',
        intro: 'Не лобовая копия рынка, а прозрачность данных и методологии.',
        features: [
          { title: 'Свой временной ряд', description: 'Накапливаем собственные данные с момента запуска.', icon: 'spark' },
          { title: 'Прозрачная оценка', description: 'Показываем аналоги, веса и метрику доверия — не «чёрный ящик».', icon: 'calc' },
          { title: 'Легитимные источники', description: 'Открытые госреестры и официальные API, а не скрейпинг.', icon: 'map' },
          { title: 'API-first', description: 'Программный доступ к оценке и агрегатам.', icon: 'api' },
          { title: 'Отчёты для банков', description: 'Обоснованные отчёты с экспортом в Word/PDF.', icon: 'report' },
          { title: 'Верх воронки — бот', description: 'Бесплатная оценка в Telegram с апселлом в подписку.', icon: 'bot' },
        ],
      },
      { blockType: 'toolsShowcase', heading: 'Инструменты', intro: 'Всё, что нужно для анализа рынка и оценки.' },
      { blockType: 'pricing', heading: 'Тарифы', intro: 'Под задачи риелтора, оценщика, банка.', note: 'Юрлицам и банкам — оплата по безналу (счёт/акт).' },
      {
        blockType: 'cta', heading: 'Начните бесплатно',
        text: 'Откройте карту цен и сделайте первую оценку уже сегодня.',
        buttonLabel: 'Выбрать тариф', buttonHref: '/pricing',
      },
    ],
  })

  await upsertPage(payload, log, 'about', {
    title: 'О платформе', slug: 'about', section: 'general', _status: 'published',
    layout: [
      {
        blockType: 'richText', width: 'normal',
        content: richTextFromParagraphs([
          'Realtify — коммерческая геоаналитическая платформа рынка недвижимости Украины.',
          'Ценность продукта — в данных и прозрачной методологии оценки. Мы накапливаем собственный временной ряд и строим инструменты для оценщиков, банков, риелторов и застройщиков.',
          'Данные берём из легитимных источников: открытые госреестры и официальные API площадок.',
        ]),
      },
      { blockType: 'team', heading: 'Команда' },
      { blockType: 'partners', heading: 'Источники данных и партнёры' },
    ],
  })

  await upsertPage(payload, log, 'contacts', {
    title: 'Контакты', slug: 'contacts', section: 'general', _status: 'published',
    layout: [
      {
        blockType: 'richText', width: 'narrow',
        content: richTextFromParagraphs([
          'Свяжитесь с нами: hello@realtify.local',
          'Для юридических лиц и банков доступна оплата по безналу — выставляем рахунок-фактуру и акт. Реквизиты предоставляются по запросу.',
        ]),
      },
    ],
  })

  await upsertPage(payload, log, 'oferta', {
    title: 'Публичная оферта', slug: 'oferta', section: 'legal', _status: 'published',
    layout: [
      {
        blockType: 'richText', width: 'normal',
        content: richTextFromParagraphs([
          'Это шаблон публичной оферты (договора присоединения). Юридически выверенный текст готовится отдельно (ТЗ §4).',
          'Использование платформы означает согласие с условиями оферты и политикой конфиденциальности.',
        ]),
      },
    ],
  })

  await upsertPage(payload, log, 'privacy', {
    title: 'Политика конфиденциальности', slug: 'privacy', section: 'legal', _status: 'published',
    layout: [
      {
        blockType: 'richText', width: 'normal',
        content: richTextFromParagraphs([
          'Это шаблон политики конфиденциальности. Финальная версия готовится с учётом GDPR и ЗУ «Про захист персональних даних» (ТЗ §4).',
          'Мы минимизируем обработку персональных данных и храним происхождение/лицензию каждого набора данных.',
        ]),
      },
    ],
  })

  log('готово ✅')
  return { ok: true }
}

async function upsertPage(
  payload: Payload,
  log: (m: string) => void,
  slug: string,
  data: Record<string, unknown>,
) {
  const found = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (found.totalDocs > 0) {
    log(`страница "${slug}" уже есть — пропускаю`)
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await payload.create({ collection: 'pages', data: data as any })
  log(`создана страница: ${slug}`)
}
