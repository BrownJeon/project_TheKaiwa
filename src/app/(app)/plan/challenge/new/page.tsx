import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import ChallengeCreateScreen from '@/components/challenge/ChallengeCreateScreen'
import { auth } from '@/modules/infra'
import { todayKst } from '@/modules/infra/dates'
import { getProfile } from '@/modules/preferences'

/**
 * 챌린지 만들기(task-043 S3) — 하단 탭 없음(집중 화면 목록). 서버는 KST 오늘과 세트 기본 장수(계획표와 같은 계산 — 장수 기본값)만 넘기고,
 * 주제(#56)·진행 중 확인(#158)·만들기(#156)는 화면이 한다. 단계·다시 도전은 주소(`?step=&again=`)를 화면이 읽는다.
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/plan/challenge/new')}`)
  const profile = await getProfile(session.user.id)
  const daily = Number.isInteger(profile.dailyWordCount) ? Math.min(30, Math.max(5, profile.dailyWordCount)) : 10
  return (
    <Suspense fallback={null}>
      <ChallengeCreateScreen today={todayKst()} dailyWordCount={daily} />
    </Suspense>
  )
}
