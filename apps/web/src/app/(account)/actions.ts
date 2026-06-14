'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload'

const COOKIE = 'payload-token'

async function setAuthCookie(token: string, exp?: number): Promise<void> {
  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: exp ? new Date(exp * 1000) : undefined,
  })
}

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === 'string' ? next : ''
  // Только внутренние пути кабинета.
  return n.startsWith('/account') ? n : '/account'
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(formData.get('next'))

  let ok = false
  try {
    const payload = await getPayloadClient()
    const res = await payload.login({ collection: 'users', data: { email, password } })
    if (res.token) {
      await setAuthCookie(res.token, res.exp)
      ok = true
    }
  } catch {
    ok = false
  }
  if (!ok) redirect(`/account/login?error=invalid&next=${encodeURIComponent(next)}`)
  redirect(next)
}

export async function registerAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const next = safeNext(formData.get('next'))

  if (!email || password.length < 8) {
    redirect(`/account/register?error=weak&next=${encodeURIComponent(next)}`)
  }

  let created = false
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email, password, name: name || undefined, roles: ['customer'] },
    })
    const res = await payload.login({ collection: 'users', data: { email, password } })
    if (res.token) {
      await setAuthCookie(res.token, res.exp)
      created = true
    }
  } catch {
    created = false
  }
  if (!created) redirect(`/account/register?error=exists&next=${encodeURIComponent(next)}`)
  redirect(next)
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
  redirect('/account/login')
}
