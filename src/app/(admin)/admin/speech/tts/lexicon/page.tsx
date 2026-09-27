import { ConsoleForbidden } from '@/components/admin/console/ConsoleStates'
import LexiconScreen from '@/components/admin/lexicon/LexiconScreen'
import { parseLexiconParams } from '@/components/admin/lexicon/lexiconParams'
import { requireConsolePage } from '@/modules/admin'

/** 발음 사전 목록(screens.md §10) — 필터·쪽은 URL 쿼리를 여기서 검증해 넘긴다(틀린 값은 버린다). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const g = await requireConsolePage('voices.read', { path: '/admin/speech/tts/lexicon' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <LexiconScreen initialParams={parseLexiconParams(await searchParams)} />
}
