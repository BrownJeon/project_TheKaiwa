import AppBar from '@/components/shell/AppBar'
import StudyAiHome from '@/components/chat/StudyAiHome'

/**
 * AI와 공부하기 홈(screens.md §3-2 A). 탭은 서버가 `searchParams` 로 받아 넘긴다 — 클라이언트에서
 * `useSearchParams` 를 쓰면 Suspense 경계가 필요해진다. 기본은 채팅(음성 회화가 열리면 `talk` 로 바꾼다).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams
  const initialTab = tab === 'talk' ? 'talk' : 'chat'
  return (
    <>
      <AppBar title="AI와 공부하기" />
      <StudyAiHome initialTab={initialTab} />
    </>
  )
}
