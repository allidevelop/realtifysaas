import type { User } from '@/payload-types'

import { resolveModuleAccess } from './entitlements'
import { MODULE_KEYS, MODULE_META, type ModuleMeta } from './modules'
import type { ModuleAccess } from './types'

export interface ModuleCard {
  meta: ModuleMeta
  access: ModuleAccess
}

// Состояние всех модулей для дашборда кабинета (ТЗ §8.4).
export async function getModuleDashboard(user: Pick<User, 'id'> | null): Promise<ModuleCard[]> {
  const cards: ModuleCard[] = []
  for (const key of MODULE_KEYS) {
    const access = await resolveModuleAccess(user, key)
    cards.push({ meta: MODULE_META[key], access })
  }
  return cards
}
