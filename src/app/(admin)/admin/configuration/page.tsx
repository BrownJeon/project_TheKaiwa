import ConfigScreen from '@/components/admin/configEditor/ConfigScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

type Sp = { scope?: string | string[]; target?: string | string[]; tab?: string | string[] }

/**
 * 설정(task-012c, 승인 데모 v2): Effective · Form · Raw JSON · Diff 탭 + 대상(연결 · 운영 설정). 주소 `?scope=&target=&tab=` — 서버가 읽어 넘긴다
 * (클라이언트 useSearchParams 없이). 기존 `?target=<연결 key>` 링크는 그대로 열린다. 탭·버튼은 화면이 capability 로 거르고, 서버가 매 요청 다시 검사한다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Sp> }) {
  const g = await requireConsolePage('config.effective.read', { path: '/admin/configuration' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)
  const target = one(sp.target)
  const t = target && /^[\w.:-]{1,100}$/.test(target) ? target : null
  const scope = one(sp.scope) === 'APP_SETTING' ? 'APP_SETTING' : null
  const tab = one(sp.tab)
  return <ConfigScreen initialScope={scope} initialTarget={t} initialTab={tab && /^(effective|form|raw|diff)$/.test(tab) ? tab : null} />
}
