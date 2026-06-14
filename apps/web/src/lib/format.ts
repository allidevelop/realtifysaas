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
