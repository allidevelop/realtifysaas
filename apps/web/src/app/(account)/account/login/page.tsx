import Link from 'next/link'

import { loginAction } from '@/app/(account)/actions'

export const dynamic = 'force-dynamic'

type SP = { searchParams: Promise<{ error?: string; next?: string }> }

export default async function LoginPage({ searchParams }: SP) {
  const sp = await searchParams
  const next = sp.next ?? '/account'

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-ink-900">Вхід до кабінету</h1>
        <p className="mt-1 text-sm text-ink-500">Доступ до інструментів за вашими пакетами.</p>

        {sp.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Невірний email або пароль.
          </p>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="block text-sm font-medium text-ink-700">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700">Пароль</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Увійти
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          Немає акаунта?{' '}
          <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="text-brand-600">
            Зареєструватися
          </Link>
        </p>
      </div>
    </div>
  )
}
