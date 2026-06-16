import { type EntitlementSubject, getUserEntitlements, isAdminSubject } from '@/lib/billing/entitlements'

import { engineGeo, type GeoMeta } from './engine'

// Freemium-доступ к геопорталу (ТЗ §9): бесплатно — только последний период и без
// drill-down; полный доступ (вся ретроспектива + районы) — при наличии любого
// активного платного доступа (купленного пакета любого модуля).
export interface GeoAccess extends GeoMeta {
  allowedPeriods: string[]
  canDrill: boolean
  full: boolean
}

export async function getGeoAccess(user: EntitlementSubject): Promise<GeoAccess> {
  const [meta, entitlements] = await Promise.all([
    engineGeo<GeoMeta>('meta', {}),
    getUserEntitlements(user),
  ])
  const full = isAdminSubject(user) || entitlements.length > 0
  const allowedPeriods = full ? meta.periods : meta.periods.slice(-1)
  return { ...meta, usdRate: meta.usdRate ?? 41, allowedPeriods, canDrill: full, full }
}

export function isPeriodAllowed(access: GeoAccess, period: string): boolean {
  return access.allowedPeriods.includes(period)
}
