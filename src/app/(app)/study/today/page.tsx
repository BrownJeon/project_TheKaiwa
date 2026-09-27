import { redirect } from 'next/navigation'
import AppBar from '@/components/shell/AppBar'
import TodayHome from '@/components/vocab/TodayHome'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 오늘의 공부 홈(screens.md §5-2 A). 서버는 세트 기본 장수(`Profile.dailyWordCount`, 5~30)만 넘기고,
 * 단어·세트·통계는 화면이 #46·#48·#54 로 읽는다. 레슨·평가 자리는 "곧 열려요"(단계 번호 비노출).
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/today')}`)
  const profile = await getProfile(session.user.id)
  const daily = Number.isInteger(profile.dailyWordCount) ? Math.min(30, Math.max(5, profile.dailyWordCount)) : 10
  return (
    <>
      <AppBar title="오늘의 공부" />
      <TodayHome dailyWordCount={daily} />
    </>
  )
}
