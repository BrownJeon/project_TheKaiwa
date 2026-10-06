import { redirect } from 'next/navigation'
import ScenarioDraftScreen from '@/components/scenario/ScenarioDraftScreen'
import { draftLevelOf } from '@/components/scenario/logic'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 내 상황 만들기(task-010d 가이드 §3-H) — 하단 탭 없음(집중 화면 목록 `/study/ai/scenario/`). 서버는 학습자 수준(초안 기본값)만 넘기고,
 * 주제(#56)·초안(S3)·저장(#163)은 화면이 한다. 저장 전에는 행이 없다(제안→채택).
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/ai/scenario/new')}`)
  const profile = await getProfile(session.user.id)
  return <ScenarioDraftScreen mode="new" defaultLevel={draftLevelOf(profile.level)} />
}
