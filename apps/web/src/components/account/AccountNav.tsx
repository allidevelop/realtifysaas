import Link from 'next/link'

import { ModulesMenu } from '@/components/account/ModulesMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { logoutAction } from '@/app/(account)/actions'
import type { User } from '@/payload-types'

// Верхняя навигация кабинета (как у конкурента: модули + Налаштування + Вихід).
export function AccountNav({ user }: { user: User | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={user ? '/account' : '/'} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[15px] font-bold text-white shadow-sm ring-1 ring-inset ring-white/15">
            R
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-ink-900">Realtify</span>
        </Link>

        {user && (
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <Link
              href="/account"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900"
            >
              Кабінет
            </Link>

            {/* Модули — выпадающий список (закрывается при переходе/клике вне) */}
            <ModulesMenu />

            <Link
              href="/account/billing"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900"
            >
              Білінг
            </Link>
            <Link
              href="/account/organization"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900"
            >
              Організація
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <Link
                href="/account/settings"
                className="hidden text-sm font-medium text-ink-600 hover:text-brand-700 sm:inline"
              >
                {user.name || user.email}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 shadow-xs hover:border-ink-300 hover:bg-ink-100 hover:text-ink-900"
                >
                  Вихід
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/account/login"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Вхід
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
