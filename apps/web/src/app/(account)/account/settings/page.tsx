import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser('/account/settings')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Налаштування</h1>
      <div className="mt-6 space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <Row label="Ім'я" value={user?.name || '—'} />
        <Row label="Email" value={user?.email || '—'} />
        <Row label="Роль" value={(user?.roles ?? []).join(', ') || 'customer'} />
      </div>
      <p className="mt-4 text-sm text-ink-500">
        Зміна пароля та реквізитів — на наступному кроці.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-medium text-ink-900">{value}</span>
    </div>
  )
}
