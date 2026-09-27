import { redirect } from 'next/navigation'
import VocabSessionScreen from '@/components/vocab/VocabSessionScreen'
import { auth } from '@/modules/infra'

/**
 * 오늘의 단어 덱·결과(screens.md §5-2 B·E). 서버는 로그인만 확인하고, 세트 소유 확인·데이터는 화면이 #49 로 한다
 * (없는 세트·타인 세트는 404 화면). 다시 풀기로 다른 세트로 옮겨 가면 `key` 로 화면을 새로 만든다.
 */
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/today/words/${sessionId}`)}`)
  return <VocabSessionScreen key={sessionId} sessionId={sessionId} />
}
