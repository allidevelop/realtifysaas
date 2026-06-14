import Redis from 'ioredis'

// Ленивый singleton ioredis (кэш квот/агрегатов, ТЗ §13). Кэшируем на globalThis,
// чтобы HMR в dev не плодил соединения.
const globalForRedis = globalThis as unknown as { __redis?: Redis }

export function getRedis(): Redis {
  if (!globalForRedis.__redis) {
    globalForRedis.__redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    })
  }
  return globalForRedis.__redis
}

export const quotaKey = (entitlementId: number | string) => `ent:quota:${entitlementId}`
