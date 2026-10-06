import { redirect } from 'next/navigation'
import ChallengeListScreen from '@/components/challenge/ChallengeListScreen'
import { auth } from '@/modules/infra'

/** 챌린지 기록(task-043 S8 목록) — 진행 중 먼저, 끝난 것은 끝난 날 역순(#155). 하단 탭 없음, ← 계획표. */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/plan/challenges')}`)
  return <ChallengeListScreen />
}
