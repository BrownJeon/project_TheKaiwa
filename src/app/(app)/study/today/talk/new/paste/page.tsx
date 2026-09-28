import { redirect } from 'next/navigation'
import LessonPasteScreen from '@/components/lesson/LessonPasteScreen'
import { auth } from '@/modules/infra'

/** 오늘의 회화 · 문장으로 수업 만들기(screens §12-2 C). 로그인만 확인한다. */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/today/talk/new/paste')}`)
  return <LessonPasteScreen />
}
