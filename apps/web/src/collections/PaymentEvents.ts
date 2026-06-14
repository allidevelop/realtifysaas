import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/lib/access'

// PaymentEvents — журнал вебхуков провайдеров (ТЗ §11: идемпотентность + аудит).
// eventId уникален (`{invoiceId}:{status}`) — страж повторной обработки.
export const PaymentEvents: CollectionConfig = {
  slug: 'payment-events',
  labels: { singular: 'Платёжное событие', plural: 'Платёжные события' },
  admin: {
    useAsTitle: 'eventId',
    group: 'Биллинг',
    defaultColumns: ['eventId', 'provider', 'status', 'result', 'signatureValid', 'processedAt'],
  },
  access: {
    // Только админ/сервер. Создаётся серверным вебхук-обработчиком (overrideAccess).
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'eventId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: '`{invoiceId}:{status}` — ключ идемпотентности.' },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'Mock', value: 'mock' },
        { label: 'Monobank', value: 'monobank' },
        { label: 'LiqPay/ПриватБанк', value: 'liqpay' },
      ],
    },
    { name: 'invoiceId', type: 'text', index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
    { name: 'type', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'signatureValid', type: 'checkbox', defaultValue: false },
    { name: 'rawPayload', type: 'json' },
    {
      name: 'result',
      type: 'select',
      options: [
        { label: 'Применено', value: 'applied' },
        { label: 'Дубль', value: 'duplicate' },
        { label: 'Проигнорировано', value: 'ignored' },
        { label: 'Ошибка', value: 'error' },
      ],
    },
    { name: 'error', type: 'text' },
    { name: 'processedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
