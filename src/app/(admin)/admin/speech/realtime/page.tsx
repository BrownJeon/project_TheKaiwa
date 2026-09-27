import RoleScreen from '@/components/admin/console/RoleScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

export default async function Page() {
  const g = await requireConsolePage('engine.read', { path: '/admin/speech/realtime' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <RoleScreen role="REALTIME_STT" />
}
