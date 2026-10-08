import AppBar from '@/components/shell/AppBar'
import StudyAiHome from '@/components/chat/StudyAiHome'
import { isScenarioIdParam } from '@/components/scenario/logic'

/**
 * AI와 공부하기 홈(screens.md §3-2 A·§9-2 A). 탭은 서버가 `searchParams` 로 받아 넘긴다 — 클라이언트에서
 * `useSearchParams` 를 쓰면 Suspense 경계가 필요해진다. 기본은 회화(`talk`, task-007) — `?tab=chat` 채팅 · `?tab=scenario` 시나리오(task-010d,
 * `&sc=<상황 id>` 면 그 상황 시트를 열고 `&saved=1` 이면 저장 안내 한 줄 — 상황 id 모양이 아니면 무시).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; sc?: string | string[]; saved?: string | string[] }> }) {
  const { tab, sc, saved } = await searchParams
  const initialTab = tab === 'chat' ? 'chat' : tab === 'scenario' ? 'scenario' : 'talk'
  const sheetId = initialTab === 'scenario' && isScenarioIdParam(sc) ? sc : null
  return (
    <>
      <AppBar title="AI와 공부하기" />
      <StudyAiHome initialTab={initialTab} initialSheetId={sheetId} saved={!!sheetId && saved === '1'} />
    </>
  )
}
