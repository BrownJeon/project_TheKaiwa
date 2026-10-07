import { redirect } from 'next/navigation'
import { isScenarioIdParam } from '@/components/scenario/logic'
import ManageScreen from '@/components/topic/ManageScreen'
import { parseManageTab } from '@/components/topic/logic'
import { auth } from '@/modules/infra'

/**
 * 내 상황·주제(task-045 S2) — `?tab=topics|scenarios`, `&sc=<상황 id>` 면 상황 탭에서 그 시트를 연다(id 모양이 아니면 무시), `&saved=1` 이면 저장 토스트 한 번.
 * 하단 탭 없음(`FOCUS_ROUTE_PREFIXES`), ← 설정. 탭은 서버가 `searchParams` 로 받아 넘긴다(클라이언트 `useSearchParams` 는 Suspense 경계가 필요).
 * 목록은 화면이 읽는다(#56·#179·#161·#155 — 소유자 검사는 각 API).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; sc?: string | string[]; saved?: string | string[] }> }) {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/settings/scenarios')}`)
  const { tab, sc, saved } = await searchParams
  const sheetId = isScenarioIdParam(sc) ? sc : null
  return <ManageScreen initialTab={sheetId ? 'scenarios' : parseManageTab(tab)} initialSheetId={sheetId} initialSaved={!!sheetId && saved === '1'} />
}
