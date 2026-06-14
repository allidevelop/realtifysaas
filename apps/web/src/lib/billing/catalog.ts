import type { Module, ServicePlan } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import { getModuleByKey } from './entitlements'
import { MODULE_KEYS, type ModuleKey } from './modules'

// Пакеты, дающие доступ к модулю (прямой module ИЛИ бандл grantsModules).
export async function getPacksForModule(moduleKey: ModuleKey): Promise<ServicePlan[]> {
  const mod = await getModuleByKey(moduleKey)
  if (!mod) return []
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'service-plans',
    where: {
      isActive: { equals: true },
      or: [{ module: { equals: mod.id } }, { grantsModules: { in: [mod.id] } }],
    },
    sort: 'order',
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })
  return res.docs
}

export interface ModulePacks {
  module: Module
  moduleKey: ModuleKey
  packs: ServicePlan[]
}

// Все пакеты, сгруппированные по модулю (для /pricing, M5).
export async function getPacksGroupedByModule(): Promise<ModulePacks[]> {
  const groups: ModulePacks[] = []
  for (const key of MODULE_KEYS) {
    const mod = await getModuleByKey(key)
    if (!mod || mod.accessType === 'free') continue
    const packs = await getPacksForModule(key)
    if (packs.length > 0) groups.push({ module: mod, moduleKey: key, packs })
  }
  return groups
}
