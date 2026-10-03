import { redirect } from 'next/navigation'
import EvalScreen from '@/components/eval/EvalScreen'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * AI 평가(task-011 데모 v1) — 서버는 선생님 이름(`teacherName`, 비우면 "선생님")만 넘기고, 소유 확인·데이터는 화면이 #66 으로 읽는다
 * (타인·없는 평가는 "찾을 수 없어요"). 다른 평가로 옮기면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params }: { params: Promise<{ evaluationId: string }> }) {
  const { evaluationId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/today/eval/${evaluationId}`)}`)
  const profile = await getProfile(session.user.id)
  const teacherName = profile.teacherName?.trim() || '선생님'
  return <EvalScreen key={evaluationId} evaluationId={evaluationId} teacherName={teacherName} />
}
