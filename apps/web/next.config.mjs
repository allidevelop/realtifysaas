import path from 'path'
import { fileURLToPath } from 'url'
import { withPayload } from '@payloadcms/next/withPayload'

// Секреты лежат в корневом .env монорепо (ТЗ §17), а Next по умолчанию читает
// .env только из каталога приложения. Подгружаем корневой .env в process.env.
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootEnv = path.resolve(dirname, '../../.env')
try {
  process.loadEnvFile(rootEnv)
} catch {
  // .env может отсутствовать (CI/прод — переменные из окружения) — это норм.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Опции Next.js — здесь (ТЗ §5/§13).
}

export default withPayload(nextConfig)
