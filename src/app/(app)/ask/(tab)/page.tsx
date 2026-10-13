import { redirect } from 'next/navigation'
import AskChatTab from '@/components/ask/AskChatTab'
import { askChatHref, isAskId } from '@/components/ask/logic'
import { auth } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'

/**
 * 질문 탭 `/ask`(task-066 §26-3 A → task-067 §27) — 열면 곧바로 챗봇창. 쿼리 없음 = 새 빈 대화, `?chat=<id>` = 지금 대화(이 탭에서 시작·복원했거나 「지난 질문」에서 고른 것).
 * 서버는 선생님 이름(설정 #11 `teacherName`, 비우면 "선생님")만 넘긴다 — 지금 대화는 화면이 주소(`useSearchParams`)에서 읽고(휴대폰 뒤로가기가 낡은 서버 값을 되살리지 않게, §27-1 D),
 * 대화 소유 확인·데이터는 #29 로 읽는다. 서버가 `chat` 을 읽는 건 로그인이 풀렸을 때 돌아올 주소에 대화를 남기기 위해서다(옛 `/ask/<id>` 리다이렉트로 온 경우 포함, §27-7 A).
 * 라우트 그룹 `(tab)` 에 둔 이유: 같은 그룹의 `loading.tsx`(탭 자리표시)가 옛 `/ask/[chatId]`(이제 리다이렉트만)로 들어갈 때는 뜨지 않게(§17-1 ②).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ chat?: string | string[] }> }) {
  const sp = await searchParams
  const chat = typeof sp.chat === 'string' ? sp.chat : null
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(isAskId(chat) ? askChatHref(chat) : '/ask')}`)
  const profile = await getProfile(session.user.id)
  const teacherName = profile.teacherName?.trim() || '선생님'
  return <AskChatTab teacherName={teacherName} />
}
