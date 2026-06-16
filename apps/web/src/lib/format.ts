// Форматирование цен и дат (ТЗ §8). UA-локаль по умолчанию.

const CURRENCY_SYMBOL: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
}

export function formatPrice(value: number, currency = 'UAH'): string {
  const formatted = new Intl.NumberFormat('uk-UA').format(value)
  const symbol = CURRENCY_SYMBOL[currency] ?? currency
  return `${formatted} ${symbol}`
}

// Цена в формате «X тис.грн» (как у конкурента — крупное число + единица текстом,
// чтобы цена воспринималась мягче). 12000 → {value:'12', unit:'тис.грн'};
// 1100 → {value:'1,1'}; 0 → {value:'0'}. Только для гривны.
// Остаток квоты: ∞ для безлимита (админ), иначе число.
export function quotaLabel(value: number | null | undefined): string {
  return value === Number.POSITIVE_INFINITY ? '∞' : String(value ?? 0)
}

export function formatThousands(uah: number): { value: string; unit: string } {
  const k = uah / 1000
  const value = Number.isInteger(k) ? String(k) : k.toFixed(1).replace('.', ',')
  return { value, unit: 'тис.грн' }
}

export function billingPeriodLabel(period: string): string {
  switch (period) {
    case 'month':
      return '/мес'
    case 'year':
      return '/год'
    default:
      return ''
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}
