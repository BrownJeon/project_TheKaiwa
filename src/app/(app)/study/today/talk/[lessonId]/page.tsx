import { redirect } from 'next/navigation'
import LessonScreen from '@/components/lesson/LessonScreen'
import { auth } from '@/modules/infra'
import { getProfile, getVoiceSettingForTts } from '@/modules/preferences'

/**
 * 오늘의 회화 수업(screens §12-2 D~L). 서버는 선생님 이름(`teacherName`, 비우면 "선생님")과 느리게 듣기 배율(`learningSpeed` — 버튼 문구)만 넘기고,
 * 레슨 소유 확인·데이터는 화면이 #60 으로 읽는다(타인·없는 레슨은 404 화면). 다른 레슨으로 옮기면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/today/talk/${lessonId}`)}`)
  const [profile, voice] = await Promise.all([getProfile(session.user.id), getVoiceSettingForTts(session.user.id)])
  const teacherName = profile.teacherName?.trim() || '선생님'
  return <LessonScreen key={lessonId} lessonId={lessonId} teacherName={teacherName} learningSpeed={voice?.learningSpeed ?? null} />
}
