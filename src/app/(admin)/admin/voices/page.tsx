import VoicesScreen from '@/components/admin/console/VoicesScreen'
import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import { requireConsolePage } from '@/modules/admin'

/** Voices 목록 = `voices.read`(H4 — api-contract #82·admin-console/01 표). */
export default async function Page() {
  const g = await requireConsolePage('voices.read', { path: '/admin/voices' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <VoicesScreen />
}
