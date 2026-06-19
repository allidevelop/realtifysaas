import { Paywall } from '@/components/account/Paywall'
import { ReportEditor } from '@/components/valuation/ReportEditor'
import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

export default async function ReportEditorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const user = await requireUser(`/account/auto-valuation/editor/${jobId}`)
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-4 py-8">
        <Paywall moduleKey="auto-valuation" reason={access.reason} />
      </div>
    )
  }

  let object = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialDoc: { type: string; content: any[] } | null = null
  let loadError = ''
  try {
    const cookie = await autovalueLogin()
    const objRes = await autovalueFetch(`/api/jobs/${jobId}/objects`, cookie)
    const objs = objRes.ok ? ((await objRes.json()).objects ?? []) : []
    object = objs[0]?.object ?? ''
    if (!object) {
      loadError = 'У цій задачі немає готового звіту для редагування.'
    } else {
      const r = await autovalueFetch(`/api/jobs/${jobId}/report-json?object=${encodeURIComponent(object)}`, cookie)
      const d = await r.json()
      initialDoc = d.document ?? null
      if (!initialDoc) loadError = 'Не вдалося зібрати документ звіту.'
    }
  } catch {
    loadError = 'Сервіс автооцінки недоступний.'
  }

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-xl font-bold text-ink-900">Редактор звіту</h1>
      <p className="mb-4 text-sm text-ink-500">
        Задача {jobId}
        {object ? ` · обʼєкт ${object}` : ''}
      </p>
      {initialDoc ? (
        <ReportEditor jobId={jobId} object={object} initialDoc={initialDoc} />
      ) : (
        <p className="text-sm text-red-600">{loadError || 'Не вдалося завантажити документ.'}</p>
      )}
    </div>
  )
}
