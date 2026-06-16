import Link from 'next/link'

import { ModulesMenu } from '@/components/account/ModulesMenu'
import { logoutAction } from '@/app/(account)/actions'
import type { User } from '@/payload-types'

// Верхняя навигация кабинета (как у конкурента: модули + Налаштування + Вихід).
export function AccountNav({ user }: { user: User | null }) {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={user ? '/account' : '/'} className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-white">R</span>
          Realtify
        </Link>

        {user && (
          <nav className="hidden flex-1 items-center gap-6 md:flex">
            <Link href="/account" className="whitespace-nowrap text-sm font-semibold text-brand-700">
              Кабінет
            </Link>

            {/* Модули — выпадающий список (закрывается при переходе/клике вне) */}
            <ModulesMenu />

            <Link
              href="/account/billing"
              className="whitespace-nowrap text-sm font-medium text-ink-700 hover:text-brand-700"
            >
              Білінг
            </Link>
            <Link
              href="/account/organization"
              className="whitespace-nowrap text-sm font-medium text-ink-700 hover:text-brand-700"
            >
              Організація
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/account/settings"
                className="hidden text-sm text-ink-700 hover:text-brand-700 sm:inline"
              >
                {user.name || user.email}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg bg-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-300/40"
                >
                  Вихід
                </button>
              </form>
            </>
          ) : (
            <Link href="/account/login" className="text-sm font-medium text-brand-700">
              Вхід
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
