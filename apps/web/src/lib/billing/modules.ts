// Каталог платных модулей (ТЗ §8.4, модель «пакеты квот по модулям»).
// Единый источник ключей модулей — используется коллекциями Payload, движком
// квот и кабинетом. Совпадает с union ModuleKey в packages/shared-types.

export const MODULE_KEYS = [
  'geoportal',
  'arm-analytics',
  'express-valuation',
  'report-generator',
  'interactive-report',
  'appraiser-calculator',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export type AccessType = 'quota' | 'period' | 'free'

export interface ModuleMeta {
  key: ModuleKey
  title: string
  /** Иконка из components/Icon (map/calc/report/api/bot/spark). */
  icon: 'map' | 'calc' | 'report' | 'api' | 'bot' | 'spark'
  accessType: AccessType
  summary: string
  order: number
}

// Метаданные по умолчанию (дублируются в коллекции Modules при seed; здесь —
// для рендера кабинета без обращения к CMS и как источник для seed).
export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  geoportal: {
    key: 'geoportal',
    title: 'Геопортал',
    icon: 'map',
    accessType: 'free',
    summary: 'Интерактивная карта цен по территориальным единицам — базовый вход к модулям.',
    order: 1,
  },
  'arm-analytics': {
    key: 'arm-analytics',
    title: 'АРМ Аналітика',
    icon: 'report',
    accessType: 'quota',
    summary: 'Поиск объявлений о продаже/аренде на текущую и ретроспективную даты, экспорт в Excel.',
    order: 2,
  },
  'express-valuation': {
    key: 'express-valuation',
    title: 'Експрес оцінка',
    icon: 'calc',
    accessType: 'quota',
    summary: 'Мгновенный расчёт стоимости или арендной ставки объекта по аналогам.',
    order: 3,
  },
  'report-generator': {
    key: 'report-generator',
    title: 'Генератор звітів',
    icon: 'report',
    accessType: 'quota',
    summary: 'Статистические отчёты по средним ценам в разрезе сегментов и операций (PDF).',
    order: 4,
  },
  'interactive-report': {
    key: 'interactive-report',
    title: 'Інтерактивний звіт',
    icon: 'report',
    accessType: 'period',
    summary: 'Сквозная аналитика: цены, коэффициенты торга, ставки капитализации, сроки экспозиции.',
    order: 5,
  },
  'appraiser-calculator': {
    key: 'appraiser-calculator',
    title: 'Калькулятор оцінювача',
    icon: 'calc',
    accessType: 'quota',
    summary: 'Автоматизированная оценка по нацстандартам, текущая и ретроспективная.',
    order: 6,
  },
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && (MODULE_KEYS as readonly string[]).includes(value)
}
