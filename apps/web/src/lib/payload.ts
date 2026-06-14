import config from '@payload-config'
import { getPayload } from 'payload'

// Кэшированный локальный клиент Payload для серверных компонентов (ТЗ §8).
// getPayload сам мемоизирует инстанс по конфигу.
export async function getPayloadClient() {
  return getPayload({ config })
}
