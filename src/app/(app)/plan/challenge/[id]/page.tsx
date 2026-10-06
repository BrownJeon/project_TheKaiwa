import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import ChallengeScreen from '@/components/challenge/ChallengeScreen'
import { auth } from '@/modules/infra'

/**
 * 챌린지 상세(task-043 S4 · 끝난 챌린지는 같은 경로가 결과 S8). 소유 확인·데이터는 화면이 #157 로 읽는다(남의 것·없는 것은 404 화면).
 * 시트 날짜·돌아갈 곳(`?day=&from=`)은 화면이 주소에서 읽는다. 다른 챌린지로 옮기면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/plan/challenge/${id}`)}`)
  return (
    <Suspense fallback={null}>
      <ChallengeScreen key={id} id={id} />
    </Suspense>
  )
}
