import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import PlanScreen from '@/components/plan/PlanScreen'
import AppBar from '@/components/shell/AppBar'
import { auth } from '@/modules/infra'
import { todayKst } from '@/modules/infra/dates'
import { getProfile } from '@/modules/preferences'

/**
 * 계획표 탭(task-012, 승인 데모 `docs/demo/task-012-calendar-v1.html`) — 월 달력·하루 상세 시트·기록 지우기 + 분석·성장 기록 "곧 열려요".
 * 서버는 KST 오늘과 세트 기본 장수(빈 달 안내 문구)만 넘기고, 달력·하루 데이터는 화면이 #70·#71 로 읽는다(자기 기록만).
 * 달·날짜(`?month=&day=`)는 화면이 주소에서 직접 읽는다 — 원본 화면에서 뒤로 올 때 지금 주소를 따라야 한다.
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/plan')}`)
  const profile = await getProfile(session.user.id)
  const daily = Number.isInteger(profile.dailyWordCount) ? Math.min(30, Math.max(5, profile.dailyWordCount)) : 10
  return (
    <>
      <AppBar title="계획표" />
      <Suspense fallback={null}>
        <PlanScreen today={todayKst()} dailyWordCount={daily} />
      </Suspense>
    </>
  )
}
