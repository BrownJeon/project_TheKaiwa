/**
 * #32 턴 라우트 본문(라우트 본문을 시험할 수 있게 꺼낸 것 — chatDetail.ts 와 같은 방식). 순서:
 *   본문 검사(400) → 소유·종류(404) → 종류별 검사(400 — ASK 는 글자만·`scope` 는 ASK 한정) → **ASK 한도**(429, 수락 전) → startTurn → SSE.
 *
 * ASK(task-064 §2-18-A 3항):
 *  - 한도(분당 3·하루 60·전역 진행 1+대기 2 `ASK_BUSY`)는 수락 **전**이라 거절이면 행 0·SSE 0. 수락 전 실패(409·404 등)는 몫을 되돌린다.
 *  - 슬롯은 파이프라인이 끝날 때(`handle.done` — 정상·오류·끊김 모두) 푼다. SSE 연결의 수명과 무관하다.
 *  - 클라이언트가 끊어도 서버는 끝까지 실행·저장한다 — 요청의 취소 신호를 턴에 잇지 않는다(task-058 의 취소는 #169·#178 한정).
 *  - 음성(speaker)·발화 연결·교정 관측 훅이 없다(ASK 는 audio·TTS·교정 없음).
 * TALK·CHAT 은 기존 그대로(라우트가 speech·learning 훅을 조합) — ASK 한도와 무관.
 */
import type { ChatKind } from '@prisma/client'
import { sseResponse } from '@/modules/infra'
import { assertTurnFitsKind, parseTurnBody, type AskAdmission, type TurnHandle, type TurnHooks, type TurnRequest } from '@/modules/conversation'

export interface TurnRouteDeps {
  /** 소유한 대화의 종류 — 남의 대화·없음은 404 를 던진다. */
  chatKind(userId: string, chatId: string): Promise<ChatKind>
  startTurn(input: { userId: string; chatId: string; request: TurnRequest; hooks?: TurnHooks }): Promise<TurnHandle>
  /** ASK 수락 전 한도 — 거절은 429 를 던진다. */
  admitAsk(userId: string): AskAdmission
  /** TALK·CHAT 훅(발화·문장 음성·관측) — 라우트가 speech·learning 으로 조합한다. ASK 에는 부르지 않는다. */
  talkChatHooks(userId: string, chatId: string, request: TurnRequest): TurnHooks
}

function stream(turn: TurnHandle): Response {
  return sseResponse((ch) => turn.subscribe((e) => ch.send(e.event, e.data)))
}

export async function handleTurnRequest(userId: string, chatId: string, body: Record<string, unknown>, deps: TurnRouteDeps): Promise<Response> {
  const request = parseTurnBody(body)
  const kind = await deps.chatKind(userId, chatId)
  assertTurnFitsKind(kind, request)
  if (kind !== 'ASK') return stream(await deps.startTurn({ userId, chatId, request, hooks: deps.talkChatHooks(userId, chatId, request) }))

  const admission = deps.admitAsk(userId)
  let turn: TurnHandle
  try {
    turn = await deps.startTurn({ userId, chatId, request })
  } catch (e) {
    admission.refund()
    throw e
  }
  void turn.done.then(admission.release, admission.release)
  return stream(turn)
}
