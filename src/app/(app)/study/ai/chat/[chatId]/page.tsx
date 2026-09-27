import { redirect } from 'next/navigation'
import ChatRoom from '@/components/chat/ChatRoom'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 채팅방(screens.md §3-2 C). 서버는 선생님 이름만 넘기고(설정 #11 `teacherName`, 비우면 "선생님"),
 * 채팅 소유 확인·데이터는 화면이 #29 로 읽는다(타인·없는 채팅은 404 화면).
 */
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/chat/${chatId}`)}`)
  const profile = await getProfile(session.user.id)
  const teacherName = profile.teacherName?.trim() || '선생님'
  return <ChatRoom chatId={chatId} teacherName={teacherName} />
}
