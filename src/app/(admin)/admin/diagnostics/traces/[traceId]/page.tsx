import TraceDetailScreen from '@/components/admin/trace/TraceDetailScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

/** Trace 상세(H6 추가 경로). `trace.read` 가 없으면(ADMIN) 콘솔 403 카드. 없는 id 는 화면이 API 404 로 "찾을 수 없어요". */
export default async function Page({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params
  const g = await requireConsolePage('trace.read', { path: '/admin/diagnostics' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <TraceDetailScreen key={traceId} traceId={traceId} />
}
