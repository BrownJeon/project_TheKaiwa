import { redirect } from 'next/navigation'
import { draftLevelOf } from '@/components/scenario/logic'
import { TOPIC_NEW_HREF } from '@/components/topic/logic'
import TopicCreateScreen from '@/components/topic/TopicCreateScreen'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 주제 만들기(task-045 S3·S4) — 하단 탭 없음(`FOCUS_ROUTE_PREFIXES` `/settings/scenarios`). 서버는 학습자 수준(초안 기본값)만 넘기고,
 * 초안(#170)·저장(#57)은 화면이 한다. 내부 사용자 id(토큰·세션 문자열 아님)는 이 탭 보관 초안의 주인 확인에만 넘기고 화면에는 쓰지 않는다. 저장 전에는 행이 없다(제안→채택). 정적 경로라 `topics/[id]` 보다 먼저 맞는다.
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(TOPIC_NEW_HREF)}`)
  const profile = await getProfile(session.user.id)
  return <TopicCreateScreen defaultLevel={draftLevelOf(profile.level)} userId={session.user.id} />
}
