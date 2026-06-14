import Link from 'next/link'

import { registerAction } from '@/app/(account)/actions'

export const dynamic = 'force-dynamic'

type SP = { searchParams: Promise<{ error?: string; next?: string }> }

const ERRORS: Record<string, string> = {
  weak: 'Вкажіть email і пароль від 8 символів.',
  exists: 'Не вдалося створити акаунт (можливо, email вже зайнятий).',
}

export default async function RegisterPage({ searchParams }: SP) {
  const sp = await searchParams
  const next = sp.next ?? '/account'

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-ink-900">Реєстрація</h1>
        <p className="mt-1 text-sm text-ink-500">Створіть акаунт, щоб купувати пакети модулів.</p>

        {sp.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERRORS[sp.error] ?? 'Помилка реєстрації.'}
          </p>
        )}

        <form action={registerAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="block text-sm font-medium text-ink-700">{"Ім'я"}</label>
            <input
              name="name"
              type="text"
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
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
            <label className="block text-sm font-medium text-ink-700">Пароль (від 8 символів)</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Зареєструватися
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          Вже маєте акаунт?{' '}
          <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="text-brand-600">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  )
}
