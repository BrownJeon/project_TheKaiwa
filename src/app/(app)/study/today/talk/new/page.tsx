import { redirect } from 'next/navigation'
import LessonTopicsScreen from '@/components/lesson/LessonTopicsScreen'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import type { JlptLevel } from '@/types/lesson'

/**
 * 오늘의 회화 · 주제 고르기(screens §12-2 B). 서버는 학습자 수준(`Profile.level`)만 넘긴다 — 안내 문구의 "내 수준"과 한 단계 위·아래.
 * 목록은 화면이 #56 으로 읽는다.
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/today/talk/new')}`)
  const profile = await getProfile(session.user.id)
  return <LessonTopicsScreen myLevel={profile.level as JlptLevel} />
}
