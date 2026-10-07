import { redirect } from 'next/navigation'
import { isScenarioIdParam } from '@/components/scenario/logic'
import { parseOriginHint, topicHref } from '@/components/topic/logic'
import TopicDetail from '@/components/topic/TopicDetail'
import { auth } from '@/modules/infra'

/**
 * 주제 보기(task-045 S6) — `&sc=<상황 id>` 면 그 상황 시트를 연다(id 모양이 아니면 무시). 하단 탭 없음(`FOCUS_ROUTE_PREFIXES` `/settings/scenarios`).
 * `?o=m|s|c` 는 도착 전 자리표시 모양(출처 안내 상자 유무)만 고르는 힌트 — 허용 값 외는 무시하고, 출처는 화면이 데이터로 판정한다.
 * 주제 상세 API 가 없어 화면이 목록(#56·#179·#161·#155)에서 id 로 찾는다 — 없거나 남의·지운·숨긴 주제는 화면이 「찾을 수 없어요」(소유자 검사는 각 API).
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sc?: string | string[]; o?: string | string[] }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(topicHref(id))}`)
  const { sc, o } = await searchParams
  return <TopicDetail id={id} initialSheetId={isScenarioIdParam(sc) ? sc : null} originHint={parseOriginHint(o)} />
}
