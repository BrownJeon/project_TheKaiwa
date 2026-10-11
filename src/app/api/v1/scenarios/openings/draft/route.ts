import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { readOpeningDraftBody, runOpeningDraft } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 엔진 상한 25s(1차+JSON 재시도) + AI 호출 슬롯 큐 대기.
export const maxDuration = 60

/** LLM 호출 한도(계약 §0 #8, Leader 기본값) — 편집 화면에서 [다시 만들기]를 여러 번 누를 수 있어 상황 초안보다 넉넉하다. */
const OPENING_PER_MINUTE = 10
const OPENING_PER_DAY = 60

/**
 * #178 첫마디 일본어 제안(task-045 T4, D5=A, `openingDraft@v2`) — **행을 만들지 않는다**(일본어는 상황 저장 때 `opening{ja, ko}` 로, `reading` 은 확인용이라 저장 안 함).
 * 정적 세그먼트 `openings` 는 동적 `[id]` 보다 먼저 맞는다(Next App Router) — `/scenarios/openings/draft` 는 이 파일로만 온다.
 * 본문 `{ko(1~80자, 한글 1자 이상), scenario:{title?, titleJa?, goal?, placeTitle?, level?(없으면 학습자 수준), roles:{learner, tutor}}}`(그 밖 키 400) ·
 * 응답 200 `{ja, reading|null, warnings[]}`.
 * 오류: 401 · 400 칸(한도 미소모) · 422 `NOT_AN_UTTERANCE`(첫마디가 아닌 글·부적절한 글, 같은 문구) · 422 `TOO_LONG` · 409 `DRAFT_BUSY` · 429(분당 10·하루 60) ·
 * 502(쓸 수 없는 제안·엔진 오류·시간 초과, 같은 문구) · 409 `CANCELLED`(손님이 끊음 — 읽을 쪽이 없다).
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const body = await readOpeningDraftBody(s.user.id, await readJsonObject(req, 4 * 1024))
  // 칸 오류(400)는 한도를 쓰지 않는다 — 한도는 LLM 을 부를 요청에만.
  rateLimit(`opening-draft:${s.user.id}`, OPENING_PER_MINUTE)
  rateLimit(`opening-draft-day:${s.user.id}`, OPENING_PER_DAY, 86_400_000)
  // `req.signal`: 화면이 시간 초과·화면 이탈로 끊으면 엔진 호출(큐 대기 포함, 상한 25초)을 멈춘다 — 안 그러면 취소된 호출이 단일 CLI 슬롯과 사용자 동시 1건 잠금을 쥐고 있다.
  // 잠금은 실행 중이면 abort 즉시, 큐 대기 중이면 차례가 올 때 풀린다(재시도도 같은 큐 뒤에 서므로 수용).
  return ok(await runOpeningDraft(s.user.id, body, undefined, req.signal), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
