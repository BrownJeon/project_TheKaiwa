import { notFound, redirect } from 'next/navigation'
import ScenarioDraftScreen from '@/components/scenario/ScenarioDraftScreen'
import { draftLevelOf, isScenarioIdParam } from '@/components/scenario/logic'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 내 상황 고치기(task-010d D-6) — 소유 확인·데이터는 화면이 #162 로 읽는다(시드·남의 것·없는 것은 "고칠 수 없어요"). 저장은 #164(바뀐 칸만).
 * id 모양이 아니면 404. 다른 상황으로 옮기면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isScenarioIdParam(id)) notFound()
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/scenario/${id}/edit`)}`)
  const profile = await getProfile(session.user.id)
  return <ScenarioDraftScreen key={id} mode="edit" id={id} defaultLevel={draftLevelOf(profile.level)} />
}
