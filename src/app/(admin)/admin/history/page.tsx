import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import HistoryScreen from '@/components/admin/history/HistoryScreen'
import { parseEditScope, parseHistoryTab } from '@/components/admin/history/historyQuery'
import { requireConsolePage } from '@/modules/admin'

type Sp = { tab?: string | string[]; scope?: string | string[]; target?: string | string[]; v?: string | string[] }

/**
 * 이력(task-012c D-C8, 승인 데모 v2 — 새 화면): 설정 버전(#108·#108a·#109) · 감사 기록(#137). 메뉴 capability = audit.read(ADMIN 이상).
 * 주소 `?tab=audit` · `?scope=&target=`(대상 고정) · `?v=<버전 id>`(상세 시트가 열린 채로).
 */
export default async function Page({ searchParams }: { searchParams: Promise<Sp> }) {
  const g = await requireConsolePage('audit.read', { path: '/admin/history' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)
  const scope = parseEditScope(one(sp.scope))
  const target = one(sp.target)
  const v = one(sp.v)
  return (
    <HistoryScreen
      initialTab={parseHistoryTab(one(sp.tab))}
      initialScope={scope}
      initialTarget={scope && target && /^[\w.-]{1,120}$/.test(target) ? target : null}
      initialV={v && /^[\w-]{1,64}$/.test(v) ? v : null}
    />
  )
}
