import { redirect } from 'next/navigation'
import TalkRoom from '@/components/talk/TalkRoom'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 회화방(screens §9-2 C). 서버는 선생님 이름만 넘기고(설정 #11 `teacherName`, 비우면 "선생님"),
 * 회화 소유 확인·데이터는 화면이 #29 로 읽는다(타인·없는 회화는 404 화면, CHAT 이면 채팅방으로).
 */
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/talk/${chatId}`)}`)
  const profile = await getProfile(session.user.id)
  const teacherName = profile.teacherName?.trim() || '선생님'
  return <TalkRoom chatId={chatId} teacherName={teacherName} />
}
