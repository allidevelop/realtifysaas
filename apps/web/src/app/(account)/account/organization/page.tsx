import Link from 'next/link'

import {
  addMemberAction,
  createOrgAction,
  removeMemberAction,
} from '@/app/(account)/organization-actions'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Organization, User } from '@/payload-types'

export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  name: 'Вкажіть назву організації.',
  noorg: 'Організацію не знайдено.',
  email: 'Вкажіть email учасника.',
  seats: 'Досягнуто ліміту місць. Підвищіть тариф або заберіть учасника.',
  notfound: 'Користувача з таким email не знайдено. Спочатку він має зареєструватися.',
  dup: 'Цей користувач уже в організації.',
  otherorg: 'Користувач уже належить іншій організації.',
  owner: 'Власника не можна видалити.',
}
const OKS: Record<string, string> = {
  created: 'Організацію створено.',
  added: 'Учасника додано.',
  removed: 'Учасника видалено.',
}

function idOf(ref: number | string | { id: number | string } | null | undefined): number | null {
  if (ref == null) return null
  if (typeof ref === 'number') return ref
  if (typeof ref === 'string') return Number(ref)
  return typeof ref.id === 'number' ? ref.id : Number(ref.id)
}

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>
}) {
  const user = await requireUser('/account/organization')
  const sp = await searchParams
  const payload = await getPayloadClient()

  // Организация, которой пользователь владеет (depth 1 — участники populated).
  const ownedRes = await payload.find({
    collection: 'organizations',
    where: { owner: { equals: user.id } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const owned = (ownedRes.docs[0] as Organization | undefined) ?? null

  // Организация, в которой пользователь — участник (не владелец).
  const memberOrgId = idOf(user.organization)
  const memberOrg =
    !owned && memberOrgId
      ? ((await payload
          .findByID({ collection: 'organizations', id: memberOrgId, depth: 0, overrideAccess: true })
          .catch(() => null)) as Organization | null)
      : null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">Організація</h1>
        <Link href="/account/billing" className="text-sm text-brand-700 hover:underline">
          ← Білінг
        </Link>
      </div>

      {sp.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {ERRORS[sp.error] ?? 'Сталася помилка.'}
        </p>
      )}
      {sp.ok && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {OKS[sp.ok] ?? 'Готово.'}
        </p>
      )}

      {owned ? (
        <OwnerView org={owned} />
      ) : memberOrg ? (
        <MemberView org={memberOrg} />
      ) : (
        <CreateView />
      )}
    </div>
  )
}

// Владелец: реквизиты, места, список участников, добавление/удаление.
function OwnerView({ org }: { org: Organization }) {
  const members = (org.members ?? []).filter((m): m is User => typeof m === 'object')
  const seats = org.seatsLimit ?? 0
  const used = members.length
  const ownerId = idOf(org.owner)
  const full = used >= seats

  return (
    <>
      <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink-900">{org.name}</h2>
          <span className="text-sm text-ink-500">
            Місця: <strong className="text-ink-900">{used}</strong> / {seats}
          </span>
        </div>
        {org.edrpou && <p className="mt-1 text-sm text-ink-500">ЄДРПОУ: {org.edrpou}</p>}
        <p className="mt-3 text-sm text-ink-500">
          Куплені на організацію пакети спільні для всіх учасників. Купуйте на сторінці{' '}
          <Link href="/account/billing" className="text-brand-700 hover:underline">
            Білінг
          </Link>{' '}
          з позначкою «для організації».
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-ink-900">Учасники</h3>
        <ul className="mt-3 divide-y divide-ink-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <span className="text-sm font-medium text-ink-900">{m.name || m.email}</span>
                {m.id === ownerId && (
                  <span className="ml-2 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    власник
                  </span>
                )}
                <span className="block text-xs text-ink-500">{m.email}</span>
              </div>
              {m.id !== ownerId && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="memberId" value={m.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100/40"
                  >
                    Видалити
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form action={addMemberAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="block text-xs text-ink-500">Email учасника</span>
            <input
              type="email"
              name="email"
              required
              disabled={full}
              placeholder="colleague@company.ua"
              className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm disabled:bg-ink-100/40"
            />
          </label>
          <button
            type="submit"
            disabled={full}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Додати
          </button>
        </form>
        {full && (
          <p className="mt-2 text-xs text-amber-600">
            Місця вичерпано — підвищіть ліміт у тарифі, щоб додати ще.
          </p>
        )}
      </section>
    </>
  )
}

// Участник (не владелец): только сведения.
function MemberView({ org }: { org: Organization }) {
  return (
    <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink-900">{org.name}</h2>
      <p className="mt-2 text-sm text-ink-500">
        Ви — учасник цієї організації. Спільні доступи організації застосовуються автоматично.
        Керування місцями — у власника організації.
      </p>
    </section>
  )
}

// Нет организации: форма создания.
function CreateView() {
  return (
    <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink-900">Створити організацію</h2>
      <p className="mt-1 text-sm text-ink-500">
        Корпоративний акаунт дозволяє ділити куплені пакети між колегами (місця/seats).
      </p>
      <form action={createOrgAction} className="mt-4 space-y-3">
        <label className="block">
          <span className="block text-xs text-ink-500">Назва організації</span>
          <input
            type="text"
            name="name"
            required
            placeholder="ТОВ «Компанія»"
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-500">ЄДРПОУ (за бажанням)</span>
          <input
            type="text"
            name="edrpou"
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Створити
        </button>
      </form>
    </section>
  )
}
