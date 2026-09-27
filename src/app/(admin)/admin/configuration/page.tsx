import EffectiveScreen from '@/components/admin/configEditor/EffectiveScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

/** Effective 탭만(Phase 1). 대상은 `?target=<connection key>` 로 시작한다 — 서버가 읽어 넘긴다(클라이언트 useSearchParams 없이). */
export default async function Page({ searchParams }: { searchParams: Promise<{ target?: string | string[] }> }) {
  const g = await requireConsolePage('config.effective.read', { path: '/admin/configuration' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  const { target } = await searchParams
  const t = typeof target === 'string' && /^[\w.:-]{1,100}$/.test(target) ? target : null
  return <EffectiveScreen initialTarget={t} />
}
