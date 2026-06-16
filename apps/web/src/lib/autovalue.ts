// Мост к сервису autovalue (отдельный FastAPI на том же сервере, :8765).
// Логин формой → session-cookie; задания: POST /api/jobs → poll /api/jobs/{id} → /files/{name}.
// Вызывается только серверным кодом кабинета (прокси-роуты), не из браузера напрямую.

import http from 'node:http'
import https from 'node:https'

const BASE = () => process.env.AUTOVALUE_URL || 'http://127.0.0.1:8765'
const USER = () => process.env.AUTOVALUE_USER || ''
const PASS = () => process.env.AUTOVALUE_PASS || ''

// Логин отдаёт 303 + Set-Cookie. fetch(redirect:'manual') прячет заголовки —
// поэтому логинимся через node:http и читаем set-cookie напрямую.
export function autovalueLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE()}/login`)
    const data = new URLSearchParams({
      username: USER(),
      password: PASS(),
      next_url: '/',
    }).toString()
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        const sc = res.headers['set-cookie']
        res.resume()
        if (!sc || sc.length === 0) {
          reject(new Error(`autovalue login failed (status ${res.statusCode}, no cookie)`))
          return
        }
        resolve(sc.map((c) => c.split(';')[0]).join('; '))
      },
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// Запрос к autovalue API с авторизационной cookie.
export function autovalueFetch(
  path: string,
  cookie: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${BASE()}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Cookie: cookie },
    cache: 'no-store',
  })
}

export interface AutovalueArtifact {
  name: string
  kind: string
  url: string
  size: number | null
}

export interface AutovalueJob {
  id: string
  status: 'queued' | 'running' | 'cancelling' | 'cancelled' | 'passed' | 'failed'
  error: string | null
  events: string[]
  artifacts: AutovalueArtifact[]
  can_cancel: boolean
}
