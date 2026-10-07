import { notFound, redirect } from 'next/navigation'
import VariantDraftScreen from '@/components/scenario/VariantDraftScreen'
import { isScenarioIdParam } from '@/components/scenario/logic'
import { parseDraftFrom } from '@/components/scenario/scenarioCopy'
import { auth } from '@/modules/infra'

/**
 * 변형 상황 만들기(task-045 변형 A) — 기준 상황은 화면이 #162 로 읽고(남의 것·없는 것·숨긴 것은 "원본을 찾을 수 없어요"), 초안은 #177, 저장은 #163.
 * `?from=manage` 면 뒤로·저장 뒤 관리 화면 상황 탭. id 모양이 아니면 404. 다른 상황으로 옮기면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  if (!isScenarioIdParam(id)) notFound()
  const from = parseDraftFrom((await searchParams).from)
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/scenario/${id}/variant${from ? `?from=${from}` : ''}`)}`)
  return <VariantDraftScreen key={id} id={id} from={from} />
}
