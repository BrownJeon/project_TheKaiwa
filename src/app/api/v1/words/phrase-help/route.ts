import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { helpWordPhrase, readPhraseHelpBody } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 분당·하루 상한(프로세스 메모리 고정 창) — 회화 도우미 #180 과 **같은 키·같은 값**이라 두 도우미가 합산된다(task-072 L3). 키를 바꾸면 합산이 깨진다(시험이 두 라우트를 대조). */
const PHRASE_HELP_PER_MINUTE = 10
const PHRASE_HELP_PER_DAY = 300

/**
 * #181 단어 추가 시트의 일본어 도우미(task-072 IMP-0046, 단어 모드 `phraseHelp@v2`) — **저장 없음**. 본문 `{queryKo}`(정리 뒤 1~100자·한글 1자 이상, ≤1KB).
 * 응답 200 `{items:[{ja, ko}]}`(0~3개, 사전형 표제어 + 한국어 뜻 — `labelKo`·`whyKo` 는 없다; 거절·못 찾음도 `items:[]`).
 * 오류: 401 · 400 본문(한도 미소모) · 409 `PHRASE_BUSY`(회화 도우미와 사용자당 동시 1건을 **공유**)·`CANCELLED` · 429 · 502/504(엔진 실패·12초).
 *
 * #180(`/chats/:id/phrase-help`)과의 차이: 채팅방이 없다(대화 소유·종류·종료·역할극 장면 읽기 없음 → 404·`ENDED` 없음) · 수준은 프로필 · 모드는 서버가 `'word'` 로 고정(본문이 정하지 않는다).
 * 한도·잠금·`req.signal` 취소·`Cache-Control` 은 #180 과 같은 모양이다.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const body = readPhraseHelpBody(await readJsonObject(req, 1024))
  // 본문 400 은 DB 를 읽지 않으니 한도를 쓰지 않는다(#180 과 같은 순서). 키는 #180 과 같아 두 도우미가 분당 10·하루 300 을 나눠 쓴다.
  rateLimit(`phrase-help:${s.user.id}`, PHRASE_HELP_PER_MINUTE)
  rateLimit(`phrase-help-day:${s.user.id}`, PHRASE_HELP_PER_DAY, 86_400_000)
  // `req.signal`: 화면이 12초 시간 초과·시트 닫기로 끊으면 엔진 호출(큐 대기 포함)을 멈춘다(#180 과 같다).
  return ok(await helpWordPhrase(s.user.id, body, undefined, req.signal), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
