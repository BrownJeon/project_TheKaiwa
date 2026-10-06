import { redirect } from 'next/navigation'
import UtteranceLog from '@/components/speech/UtteranceLog'
import { auth } from '@/modules/infra'

/**
 * 내 발화 기록(task-012b-2, 설정 › 음성 인식 아래 — U3 위치는 Leader 결정). 목록·확정은 화면이 #21c·#21a 로 한다.
 * `?filter=review` 는 서버가 받아 넘긴다(클라이언트 `useSearchParams` 는 Suspense 경계가 필요해진다).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/settings/utterances')}`)
  const { filter } = await searchParams
  return <UtteranceLog initialFilter={filter === 'review' ? 'review' : 'all'} />
}
