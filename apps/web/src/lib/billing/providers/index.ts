import { mockProvider } from './mock'
import { monobankProvider } from './monobank'
import type { PaymentProvider, ProviderName } from './types'

// Фабрика провайдера по PAYMENTS_PROVIDER (default mock — для локального e2e).
export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENTS_PROVIDER || 'mock') as ProviderName
  switch (name) {
    case 'monobank':
      return monobankProvider
    case 'mock':
    default:
      return mockProvider
  }
}

export function getProviderByName(name: ProviderName): PaymentProvider {
  switch (name) {
    case 'monobank':
      return monobankProvider
    default:
      return mockProvider
  }
}

export type { PaymentProvider, ProviderName }
