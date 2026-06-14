import { NextResponse, type NextRequest } from 'next/server'

// Грубый edge-гейт на /account/* (ТЗ §13): оптимистичная проверка НАЛИЧИЯ куки
// payload-token (без верификации подписи — server-only PAYLOAD_SECRET не доступен
// в edge-рантайме). Авторитетная верификация — в server-components страниц
// (getCurrentUser → payload.auth). login/register — публичные.

const PUBLIC_PATHS = ['/account/login', '/account/register']

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const hasToken = Boolean(req.cookies.get('payload-token')?.value)
  if (!hasToken) {
    const url = req.nextUrl.clone()
    url.pathname = '/account/login'
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/account/:path*'],
}
