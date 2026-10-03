import { redirect } from 'next/navigation'
import EvalStartScreen from '@/components/eval/EvalStartScreen'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import type { JlptLevel } from '@/types/lesson'

/**
 * AI 평가 시작(task-011 데모 v1 `#start-*`) — 서버는 학습자 레벨(`Profile.level`, 레벨 기본값·"내 레벨" 표시)과 처음 고를 종류(`?kind=`)만 넘긴다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/today/eval/new')}`)
  const profile = await getProfile(session.user.id)
  return <EvalStartScreen myLevel={profile.level as JlptLevel} initialKind={kind === 'TALK' ? 'TALK' : 'WORDS'} />
}
