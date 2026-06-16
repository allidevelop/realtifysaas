import { DataBadge } from '@/components/account/DataBadge'
import { Geoportal } from '@/components/geo/Geoportal'
import { Icon } from '@/components/Icon'
import { requireUser } from '@/lib/auth'
import { getGeoAccess } from '@/lib/geo/access'

export const dynamic = 'force-dynamic'

export default async function GeoportalPage() {
  const user = await requireUser('/account/geoportal')
  const access = await getGeoAccess(user)

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name="map" className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Геопортал</h1>
          <p className="text-sm text-ink-500">
            Карта цін за територіальними одиницями. Межі — реальні КАТОТТГ (OpenStreetMap).
            Показники наразі демонстраційні; реальні дані накопичуються з DOM.RIA. Клік по
            області — деталізація до районів.
          </p>
          <div className="mt-1.5">
            <DataBadge kind="demo" note="межі реальні (КАТОТТГ/OSM); показники — демо" />
          </div>
        </div>
      </div>

      <Geoportal access={access} />
    </div>
  )
}
