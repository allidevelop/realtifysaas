import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin, isSignedIn } from '@/lib/access'
import { applyPaidOrder } from '@/lib/billing/fulfillment'

// Orders — заказы/покупки (ТЗ §8.2, §11). Имена полей по ТЗ.
// Наличие legalEntity ⇒ безнал (B2B). afterChange-хук фулфилмента подключается
// на этапе платежей (M3): при переходе в paid → applyPaidOrder.
export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: { singular: 'Заказ', plural: 'Заказы' },
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Биллинг',
    defaultColumns: ['orderNumber', 'email', 'totalMinor', 'paymentMethod', 'status', 'createdAt'],
  },
  access: {
    read: isOwnerOrAdmin,
    // Создание — авторизованный (через серверный checkout, обычно overrideAccess).
    create: isSignedIn,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && !data.orderNumber) {
          const d = new Date()
          const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
          const rand = Math.floor(1000 + Math.random() * 9000)
          data.orderNumber = `RT-${ymd}-${rand}`
        }
        return data
      },
    ],
    // Фулфилмент: переход в paid → выдать/продлить доступы (идемпотентно).
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation === 'update' && previousDoc?.status !== 'paid' && doc.status === 'paid') {
          await applyPaidOrder(req.payload, doc.id, req)
        }
      },
    ],
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'user', type: 'relationship', relationTo: 'users', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Новый', value: 'new' },
        { label: 'Ожидает счёт (безнал)', value: 'awaiting_invoice' },
        { label: 'Ожидает оплату', value: 'pending' },
        { label: 'Оплачен', value: 'paid' },
        { label: 'Ошибка', value: 'failed' },
        { label: 'Исполнен', value: 'fulfilled' },
        { label: 'Отменён', value: 'canceled' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Покупатель',
      fields: [
        { name: 'customerName', type: 'text' },
        {
          type: 'row',
          fields: [
            { name: 'email', type: 'email', admin: { width: '50%' } },
            { name: 'phone', type: 'text', admin: { width: '50%' } },
          ],
        },
        { name: 'billingAddress', type: 'textarea' },
      ],
    },
    {
      name: 'legalEntity',
      type: 'group',
      admin: { description: 'Реквизиты юрлица для безнала (счёт/акт). Наличие ⇒ B2B.' },
      fields: [
        { name: 'name', type: 'text' },
        {
          type: 'row',
          fields: [
            { name: 'edrpou', type: 'text', admin: { width: '50%', description: 'ЄДРПОУ' } },
            { name: 'ipn', type: 'text', admin: { width: '50%', description: 'ІПН' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'iban', type: 'text', admin: { width: '50%' } },
            { name: 'bankName', type: 'text', admin: { width: '50%' } },
          ],
        },
      ],
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Позиция', plural: 'Позиции' },
      fields: [
        {
          name: 'refType',
          type: 'select',
          required: true,
          defaultValue: 'plan',
          options: [
            { label: 'Пакет/тариф', value: 'plan' },
            { label: 'Исследование', value: 'research' },
            { label: 'Библиотека', value: 'library' },
          ],
        },
        { name: 'plan', type: 'relationship', relationTo: 'service-plans' },
        { name: 'qty', type: 'number', defaultValue: 1, min: 1 },
        { name: 'priceMinorSnapshot', type: 'number', required: true, admin: { description: 'Цена позиции в копейках на момент заказа.' } },
        { name: 'titleSnapshot', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'totalMinor', type: 'number', required: true, admin: { width: '34%', description: 'Итого в копейках.' } },
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: 'UAH',
          options: ['UAH', 'USD', 'EUR'],
          admin: { width: '33%' },
        },
        {
          name: 'paymentMethod',
          type: 'select',
          required: true,
          defaultValue: 'card',
          options: [
            { label: 'Карта', value: 'card' },
            { label: 'Счёт (безнал)', value: 'invoice' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'provider',
          type: 'select',
          defaultValue: 'mock',
          options: [
            { label: 'Mock', value: 'mock' },
            { label: 'Monobank', value: 'monobank' },
            { label: 'LiqPay/ПриватБанк', value: 'liqpay' },
          ],
          admin: { width: '50%' },
        },
        { name: 'paymentRef', type: 'text', index: true, admin: { width: '50%', description: 'invoiceId провайдера.' } },
      ],
    },
    { name: 'invoiceFile', type: 'upload', relationTo: 'media', admin: { description: 'Рахунок-фактура (PDF).' } },
    { name: 'actFile', type: 'upload', relationTo: 'media', admin: { description: 'Акт (PDF).' } },
    {
      type: 'row',
      fields: [
        { name: 'paidAt', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'fulfilledAt', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'downloadTokens',
      type: 'array',
      admin: { description: 'Токены защищённой выдачи файлов (разовые продажи) — резерв.' },
      fields: [
        { name: 'token', type: 'text' },
        { name: 'expiresAt', type: 'date' },
        { name: 'maxDownloads', type: 'number' },
        { name: 'downloadCount', type: 'number', defaultValue: 0 },
      ],
    },
  ],
}
