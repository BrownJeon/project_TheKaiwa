import DashboardScreen from '@/components/admin/console/DashboardScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

export default async function Page() {
  const g = await requireConsolePage('engine.read', { path: '/admin/dashboard' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <DashboardScreen />
}
