import { redirect } from 'next/navigation'
import LessonPasteScreen from '@/components/lesson/LessonPasteScreen'
import { SHARE_PASTE_HREF, SHARE_PASTE_PATH } from '@/components/shell/shareTarget'
import { auth } from '@/modules/infra'

/**
 * 오늘의 회화 · 문장으로 수업 만들기(screens §12-2 C). 로그인만 확인한다.
 * `?from=share` = 셸이 공유하기로 받은 글을 들고 왔다는 표시(task-052 §20-4 ①) — 로그인으로 돌릴 때도 표시를 잇는다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { from } = await searchParams
  const fromShare = (Array.isArray(from) ? from[0] : from) === 'share'
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(fromShare ? SHARE_PASTE_HREF : SHARE_PASTE_PATH)}`)
  return <LessonPasteScreen fromShare={fromShare} />
}
