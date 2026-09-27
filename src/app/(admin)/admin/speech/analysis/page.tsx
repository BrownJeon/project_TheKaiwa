import RoleScreen from '@/components/admin/console/RoleScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

export default async function Page() {
  const g = await requireConsolePage('engine.read', { path: '/admin/speech/analysis' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <RoleScreen role="ANALYSIS_STT" />
}
