import DiagnosticsScreen from '@/components/admin/trace/DiagnosticsScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

/** Health 기록(`engine.read`) · 요청 Trace(`trace.read` — 없으면 탭 자체가 없고 `?tab=traces` 는 무시). */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; connection?: string | string[] }> }) {
  const g = await requireConsolePage('engine.read', { path: '/admin/diagnostics' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  const sp = await searchParams
  const tab = typeof sp.tab === 'string' ? sp.tab : null
  const connection = typeof sp.connection === 'string' && /^[\w.:-]{1,100}$/.test(sp.connection) ? sp.connection : null
  return <DiagnosticsScreen initialTab={tab} initialConnection={connection} />
}
