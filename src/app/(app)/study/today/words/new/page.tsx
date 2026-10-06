import { redirect } from 'next/navigation'
import TopicSetStart from '@/components/vocab/TopicSetStart'
import { auth } from '@/modules/infra'

/**
 * 새 단어 대기 화면(task-044 가이드 §3-5·E1). 서버는 로그인만 확인하고, 시작 값(주제·장수·방식)은 화면이 sessionStorage 토큰으로 받는다 —
 * 주소에 값을 싣지 않아 새로 고침·주소 붙여넣기로 생성 요청이 다시 나가지 않는다. 정적 경로라 `/words/[sessionId]` 보다 먼저 잡힌다.
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/today')}`)
  return <TopicSetStart />
}
