import PluginsScreen from '@/components/admin/console/PluginsScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

export default async function Page() {
  const g = await requireConsolePage('plugins.read', { path: '/admin/plugins' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <PluginsScreen />
}
