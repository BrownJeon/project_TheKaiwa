import PluginDetailScreen from '@/components/admin/console/PluginDetailScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

/** 없는 id 는 `notFound()` 가 아니라 화면이 API 404 를 받아 콘솔 안 "찾을 수 없어요" 카드를 그린다(§6-2 B). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await requireConsolePage('plugins.read', { path: '/admin/plugins' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <PluginDetailScreen key={id} id={id} />
}
