import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import LexiconVersionsScreen from '@/components/admin/lexicon/LexiconVersionsScreen'
import { parseVersionParam } from '@/components/admin/lexicon/lexiconParams'
import { requireConsolePage } from '@/modules/admin'

/** 발음 사전 버전 기록(screens.md §10-2 I) — `?v=` 가 있으면 그 버전 상세 시트가 열린 채로 시작한다. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const g = await requireConsolePage('voices.read', { path: '/admin/speech/tts/lexicon/versions' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <LexiconVersionsScreen initialV={parseVersionParam(await searchParams)} />
}
