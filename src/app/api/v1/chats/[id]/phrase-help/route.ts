import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { helpPhrase, readPhraseHelpBody } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 분당·하루 상한(프로세스 메모리 고정 창, #169 와 같은 값) — 실질 방어선은 서비스의 사용자당 동시 1건(`PHRASE_BUSY`). */
const PHRASE_HELP_PER_MINUTE = 10
const PHRASE_HELP_PER_DAY = 300

/**
 * #180 회화방 일본어 도우미(task-056, `phraseHelp@v1`) — **저장 없음**. 본문 `{queryKo}`(정리 뒤 1~100자·한글 1자 이상, ≤1KB).
 * 응답 200 `{items:[{ja, ko, labelKo?, whyKo?}]}`(1~3개, 거절·못 찾음도 `items:[]`).
 * 오류: 401 · 400 본문(한도 미소모) · 남의·없는·회화 아닌 대화 404 · 409 `ENDED`·`PHRASE_BUSY` · 429 · 502/504(엔진 실패·12초).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = readPhraseHelpBody(await readJsonObject(req, 1024))
  // 본문 400 은 DB 를 읽지 않으니 한도를 쓰지 않는다. 404·409 는 DB 를 읽는 거절이라 한도 안에 둔다(#169 REV-142 L-4 와 같은 순서).
  rateLimit(`phrase-help:${s.user.id}`, PHRASE_HELP_PER_MINUTE)
  rateLimit(`phrase-help-day:${s.user.id}`, PHRASE_HELP_PER_DAY, 86_400_000)
  // `req.signal`: 화면이 12초 시간 초과·방 이탈로 끊으면 엔진 호출(큐 대기 포함)을 멈춘다 — 안 그러면 취소된 호출이 단일 CLI 슬롯과 사용자 동시 1건 잠금을 쥐고 있다.
  // 잠금은 실행 중이면 abort 즉시, 큐 대기 중이면 차례가 올 때 풀린다(재시도도 같은 큐 뒤에 서므로 수용).
  return ok(await helpPhrase(s.user.id, id, body, undefined, req.signal), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
