import { redirect } from 'next/navigation'
import AskChatTab from '@/components/ask/AskChatTab'
import { isAskId } from '@/components/ask/logic'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 질문 탭 `/ask`(task-066 §26-3 A) — 열면 곧바로 챗봇창. 쿼리 없음 = 새 빈 대화, `?chat=<id>` = 이 탭에서 시작·복원한 지금 대화.
 * 서버는 선생님 이름(설정 #11 `teacherName`, 비우면 "선생님")과 형식을 거른 `chat` 만 넘긴다 — 대화 소유 확인·데이터는 화면이 #29 로 읽는다.
 * 라우트 그룹 `(tab)` 에 둔 이유: 같은 그룹의 `loading.tsx`(탭 자리표시)가 지난 대화(`/ask/[chatId]`)로 들어갈 때는 뜨지 않게(§17-1 ②).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ chat?: string | string[] }> }) {
  const sp = await searchParams
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/ask')}`)
  const profile = await getProfile(session.user.id)
  const teacherName = profile.teacherName?.trim() || '선생님'
  const chat = typeof sp.chat === 'string' ? sp.chat : null
  return <AskChatTab teacherName={teacherName} initialChatId={isAskId(chat) ? chat : null} />
}
