import { ok, requireSession, withApi } from '@/modules/infra'
import { getChallengeToday } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #158 계획표 카드·오늘 탭·덱 머리용 요약 `{challenge, today, recentlyEnded}` — DB 만(LLM 호출 없음). 날짜는 서버 KST. */
export const GET = withApi(async () => {
  const s = await requireSession()
  return ok(await getChallengeToday(s.user.id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
