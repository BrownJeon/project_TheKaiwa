import { redirect } from 'next/navigation'
import AskRoom from '@/components/ask/AskRoom'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 질문 방(task-064 §25-2). 채팅방 page 와 같은 모양 — 서버는 선생님 이름만 넘기고(설정 #11 `teacherName`, 비우면 "선생님"),
 * 방 소유 확인·데이터는 화면이 #29 로 읽는다(타인·없는 방은 화면의 404 상태). 탭 홈이 아니라 자리표시(loading.tsx)를 두지 않는다.
 */
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/ask/${chatId}`)}`)
  const profile = await getProfile(session.user.id)
  const teacherName = profile.teacherName?.trim() || '선생님'
  return <AskRoom chatId={chatId} teacherName={teacherName} />
}
