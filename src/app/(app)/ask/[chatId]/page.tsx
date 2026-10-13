import { redirect } from 'next/navigation'
import { auth } from '@/modules/infra'
import { legacyAskRoomTarget } from '../../_lib/askLegacyRoom'

/**
 * 옛 지난 대화 주소(task-064 §25-2·task-066 §26-3 A `/ask/<id>`) — task-067 D5 로 질문 탭 `/ask?chat=<id>` 에서 연다. 여기서는 그리지 않고 넘기기만 한다.
 * 대화를 읽지 않으므로 없는·남의 id 도 같은 응답(탭이 #29 로 소유를 확인한다). 세션 확인은 proxy 를 우회한 경우의 두 번째 방어선.
 */
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const target = legacyAskRoomTarget(chatId)
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(target)}`)
  redirect(target)
}
