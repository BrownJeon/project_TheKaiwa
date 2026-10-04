import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { annotateReadings, READING_MAX_CHARS, READING_MAX_TEXTS } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #24r 일본어 읽기 분석(task-026 S1) — 문장별 형태소 `{surface, ruby, pron, boundary}`. 화면의 후리가나(한자 위)·한글 줄 데이터.
 * 로그인 필요, 소유권 무관(받은 문장만 분석 — 저장·로그 없음). 요청당 문장 ≤64·각 ≤400자, 사용자당 60/분·동시 2건(넘으면 `available:false`).
 * 분석기를 쓸 수 없으면 오류가 아니라 칸이 null + `available:false`(화면은 숨김). 응답에 엔진 정보 없음.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`text-annotate:${s.user.id}`, 60)
  const body = await readJsonObject(req, 256 * 1024)
  const texts = body.texts
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > READING_MAX_TEXTS || !texts.every((t) => typeof t === 'string')) {
    throw new ApiError('VALIDATION', `문장은 1~${READING_MAX_TEXTS}개 배열이어야 합니다.`)
  }
  if (texts.some((t: string) => t.length > READING_MAX_CHARS)) throw new ApiError('VALIDATION', `문장은 ${READING_MAX_CHARS}자 이하여야 합니다.`)
  const result = await annotateReadings(texts as string[], {}, s.user.id)
  return ok(
    { items: result.items.map((segments) => (segments ? { segments } : null)), available: result.available },
    null,
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
})
