import { redirect } from 'next/navigation'
import ScenarioDraftScreen from '@/components/scenario/ScenarioDraftScreen'
import { draftLevelOf, isScenarioIdParam } from '@/components/scenario/logic'
import { parseDraftFrom } from '@/components/scenario/scenarioCopy'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 내 상황 만들기(task-010d 가이드 §3-H) — 하단 탭 없음(집중 화면 목록 `/study/ai/scenario/`). 서버는 학습자 수준(초안 기본값)만 넘기고,
 * 주제(#56)·초안(S3)·저장(#163)은 화면이 한다. 저장 전에는 행이 없다(제안→채택).
 * task-045 S11: `?from=manage` 면 뒤로·저장 뒤 관리 화면, `?topicId=` 는 장소 미리 고르기(id 모양만 받고, 목록에 없으면 화면이 버린다).
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const from = parseDraftFrom(sp.from)
  const topicId = isScenarioIdParam(sp.topicId) ? sp.topicId : null
  const session = await auth()
  if (!session) {
    // 로그인 뒤에도 들어온 곳·장소를 잇는다 — 검사를 지난 값만 다시 싣는다(같은 경로 안에서만, 다른 주소로 보내지 않는다 — 열린 리다이렉트 금지).
    const back = new URLSearchParams()
    if (from) back.set('from', from)
    if (topicId) back.set('topicId', topicId)
    const qs = back.toString()
    redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/scenario/new${qs ? `?${qs}` : ''}`)}`)
  }
  const profile = await getProfile(session.user.id)
  return <ScenarioDraftScreen mode="new" defaultLevel={draftLevelOf(profile.level)} from={from} presetTopicId={topicId} />
}
