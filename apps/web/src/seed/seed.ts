/**
 * Логика наполнения CMS демо-контентом (ТЗ §8, этап 1). Идемпотентна.
 * Вызывается из src/seed/index.ts (`payload run`) и из route /seed (рантайм Next).
 */
import type { Payload } from 'payload'

import { MODULE_KEYS, MODULE_META, type ModuleKey } from '@/lib/billing/modules'
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

  // ── modules + packs (пакеты квот по модулям, как у конкурента) ──
  {
    // Инкрементально: добавляем недостающие модули (новый модуль появится и на живой БД).
    const moduleId = {} as Record<ModuleKey, number>
    const existingModules = await payload.find({ collection: 'modules', limit: 100 })
    for (const m of existingModules.docs) moduleId[m.key as ModuleKey] = m.id
    let createdModules = 0
    for (const key of MODULE_KEYS) {
      if (moduleId[key]) continue
      const m = MODULE_META[key]
      const created = await payload.create({
        collection: 'modules',
        data: {
          name: m.title,
          key: m.key,
          slug: m.key,
          summary: m.summary,
          icon: m.icon,
          accessType: m.accessType,
          order: m.order,
          isActive: true,
        },
      })
      moduleId[key] = created.id
      createdModules++
    }
    if (createdModules) log(`создано модулей: ${createdModules}`)

    const existingPacks = await payload.find({ collection: 'service-plans', limit: 1 })
    if (existingPacks.totalDocs === 0) {
      const level = ['min', 'mid', 'max'] as const
      let order = 0
      let count = 0

      // Калькулятор оцінювача + АРМ Аналітика (бандл): 10/1200, 20/2000, 50/4000
      const bundle: Array<[number, number]> = [[10, 1200], [20, 2000], [50, 4000]]
      for (let i = 0; i < bundle.length; i++) {
        const [q, g] = bundle[i]
        await payload.create({
          collection: 'service-plans',
          data: {
            name: `Калькулятор + Аналітика — ${q}`,
            module: moduleId['appraiser-calculator'],
            grantsModules: [moduleId['arm-analytics']],
            accessType: 'quota',
            packLevel: level[i],
            quota: q,
            price: g,
            priceMinor: g * 100,
            currency: 'UAH',
            billingPeriod: 'one-time',
            highlighted: i === 1,
            tagline: `${q} запросов`,
            order: ++order,
            isActive: true,
            features: [{ label: `${q} расчётов` }, { label: 'Калькулятор + АРМ Аналітика' }, { label: 'Экспорт в Excel' }],
          },
        })
        count++
      }

      // Експрес оцінка: 20/2000, 50/4000, 100/7000
      const express: Array<[number, number]> = [[20, 2000], [50, 4000], [100, 7000]]
      for (let i = 0; i < express.length; i++) {
        const [q, g] = express[i]
        await payload.create({
          collection: 'service-plans',
          data: {
            name: `Експрес оцінка — ${q}`,
            module: moduleId['express-valuation'],
            accessType: 'quota',
            packLevel: level[i],
            quota: q,
            price: g,
            priceMinor: g * 100,
            currency: 'UAH',
            billingPeriod: 'one-time',
            highlighted: i === 1,
            tagline: `${q} оценок`,
            order: ++order,
            isActive: true,
            features: [{ label: `${q} экспресс-оценок` }, { label: 'Ретроспектива с 2018' }, { label: '1 аккаунт' }],
          },
        })
        count++
      }

      // Генератор звітів: 5/1100, 10/2000, 20/3600
      const reports: Array<[number, number]> = [[5, 1100], [10, 2000], [20, 3600]]
      for (let i = 0; i < reports.length; i++) {
        const [q, g] = reports[i]
        await payload.create({
          collection: 'service-plans',
          data: {
            name: `Генератор звітів — ${q}`,
            module: moduleId['report-generator'],
            accessType: 'quota',
            packLevel: level[i],
            quota: q,
            price: g,
            priceMinor: g * 100,
            currency: 'UAH',
            billingPeriod: 'one-time',
            highlighted: i === 1,
            tagline: `${q} отчётов`,
            order: ++order,
            isActive: true,
            features: [{ label: `${q} PDF-отчётов` }, { label: 'Средние цены по сегментам' }],
          },
        })
        count++
      }

      // Інтерактивний звіт: period 180 дней / 12000
      await payload.create({
        collection: 'service-plans',
        data: {
          name: 'Інтерактивний звіт — 6 міс',
          module: moduleId['interactive-report'],
          accessType: 'period',
          periodDays: 180,
          price: 12000,
          priceMinor: 12000 * 100,
          currency: 'UAH',
          billingPeriod: 'one-time',
          tagline: '6 месяцев, 1 аккаунт',
          order: ++order,
          isActive: true,
          features: [{ label: 'Сквозная аналитика рынка' }, { label: 'Коэффициенты торга, капитализации' }, { label: '6 месяцев доступа' }],
        },
      })
      count++

      log(`создано пакетов: ${count}`)
    } else {
      log('пакеты уже есть — пропускаю')
    }

    // Инкрементально: пакеты «Портфельна оцінка» (на референсе свой тариф не опубликован).
    if (moduleId['portfolio-valuation']) {
      const have = await payload.find({
        collection: 'service-plans',
        where: { module: { equals: moduleId['portfolio-valuation'] } },
        limit: 1,
      })
      if (have.totalDocs === 0) {
        const lvl = ['min', 'mid', 'max'] as const
        const portfolio: Array<[number, number]> = [[10, 1500], [25, 3000], [50, 5000]]
        for (let i = 0; i < portfolio.length; i++) {
          const [q, g] = portfolio[i]
          await payload.create({
            collection: 'service-plans',
            data: {
              name: `Портфельна оцінка — ${q}`,
              module: moduleId['portfolio-valuation'],
              accessType: 'quota',
              packLevel: lvl[i],
              quota: q,
              price: g,
              priceMinor: g * 100,
              currency: 'UAH',
              billingPeriod: 'one-time',
              highlighted: i === 1,
              tagline: `${q} портфелів`,
              order: 100 + i,
              isActive: true,
              features: [
                { label: `${q} пакетних оцінок` },
                { label: 'Масив об’єктів однією вибіркою' },
                { label: 'Ретроспектива з 2018' },
              ],
            },
          })
        }
        log('создано пакетов портфельной оценки: 3')
      }
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
