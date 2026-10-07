import { notFound, redirect } from 'next/navigation'
import ScenarioDraftScreen from '@/components/scenario/ScenarioDraftScreen'
import { draftLevelOf, isScenarioIdParam } from '@/components/scenario/logic'
import { parseDraftFrom } from '@/components/scenario/scenarioCopy'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 상황 고치기(task-010d D-6 · task-045 S11) — 소유 확인·데이터는 화면이 #162 로 읽는다(남의 것·없는 것은 "고칠 수 없어요").
 * 내 상황은 #164(바뀐 칸만), 기본 상황은 저장할 때 #175 로 내 버전을 만든다. `?from=manage` 면 뒤로·저장 뒤 관리 화면.
 * id 모양이 아니면 404. 다른 상황으로 옮기면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  if (!isScenarioIdParam(id)) notFound()
  const from = parseDraftFrom((await searchParams).from)
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/scenario/${id}/edit${from ? `?from=${from}` : ''}`)}`)
  const profile = await getProfile(session.user.id)
  return <ScenarioDraftScreen key={id} mode="edit" id={id} defaultLevel={draftLevelOf(profile.level)} from={from} />
}
