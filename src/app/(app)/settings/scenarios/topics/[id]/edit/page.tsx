import { redirect } from 'next/navigation'
import { topicEditHref } from '@/components/topic/logic'
import TopicEditScreen from '@/components/topic/TopicEditScreen'
import { auth } from '@/modules/infra'

/**
 * 주제 고치기(task-045 S7) — 하단 탭 없음(`FOCUS_ROUTE_PREFIXES` `/settings/scenarios`). 서버는 로그인만 확인한다.
 * 주제 상세 API 가 없어 화면이 #56·#179 에서 id 로 찾는다 — 남의·없는·지운·숨긴 주제는 화면이 「찾을 수 없어요」(소유자 검사는 각 API — #171 `TOPIC_GONE`·#174 `SEED_NOT_FOUND`).
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(topicEditHref(id))}`)
  return <TopicEditScreen id={id} />
}
