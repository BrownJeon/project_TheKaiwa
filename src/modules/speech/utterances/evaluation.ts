/**
 * 평가 말하기 문항 ↔ 발화 연결(task-011 #67) — `Utterance` 는 speech 소유라 라우트가 learning(평가 잠금·문항 확인)과 한 트랜잭션에서 조합한다.
 *
 * 연결 조건(모두 만족해야): 세션 사용자 소유(아니면 404) · 채팅 메시지에 쓰이지 않음(409 UTTERANCE_USED) · 대화방 녹음 아님(409 UTTERANCE_OTHER_CHAT)
 * · 레슨 녹음 아님(409 UTTERANCE_OTHER_LESSON) · 다른 평가 문항에 붙지 않음(409 UTTERANCE_USED) · 처음 붙일 때는 생성 10분 이내(409 UTTERANCE_EXPIRED).
 * 이미 이 문항에 붙은 발화는 다시 써도 된다(같은 녹음으로 다시 답하기). 연결은 조건부 `updateMany` — 경합에서 지면 409.
 * 채점 재료는 발화의 최종 텍스트(`finalText`, 없으면 실시간 텍스트) — L1: 분석 STT(012b) 전까지 실시간 STT 최종 텍스트.
 */
import { ApiError, prisma, type Tx } from '@/modules/infra'
import { answerCameFrom } from '../analysis/policy'
import { audioKept } from './lesson'
import { UTTERANCE_TURN_WINDOW_MS } from './turn'

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/

export interface EvaluationUtteranceLink {
  id: string
  /** 채점에 쓸 텍스트(최종 → 실시간 순). */
  text: string
  hasAudio: boolean
}

interface Row {
  chatId: string | null
  chatMessageId: string | null
  evaluationItemId: string | null
  lessonId: string | null
  createdAt: Date
}

/** 순수 판정 — 문제가 없으면 null. */
export function evaluationUtteranceProblem(row: Row, evaluationItemId: string, now: number): ApiError | null {
  if (row.chatMessageId) return new ApiError('CONFLICT', '이미 다른 곳에 쓴 녹음이에요.', { reason: 'UTTERANCE_USED' })
  if (row.chatId) return new ApiError('CONFLICT', '대화방에서 녹음한 말이에요.', { reason: 'UTTERANCE_OTHER_CHAT' })
  if (row.lessonId) return new ApiError('CONFLICT', '수업에서 녹음한 말이에요.', { reason: 'UTTERANCE_OTHER_LESSON' })
  if (row.evaluationItemId && row.evaluationItemId !== evaluationItemId) return new ApiError('CONFLICT', '이미 다른 문항에 쓴 녹음이에요.', { reason: 'UTTERANCE_USED' })
  if (!row.evaluationItemId && now - row.createdAt.getTime() > UTTERANCE_TURN_WINDOW_MS) return new ApiError('CONFLICT', '녹음한 지 오래됐어요. 다시 말해 주세요.', { reason: 'UTTERANCE_EXPIRED' })
  return null
}

/** `evaluationItemId` 는 라우트가 (평가 잠금 아래) 소유를 확인한 문항. 호출자 트랜잭션 안에서 부르면 이후 쓰기가 실패할 때 연결도 되돌려진다. */
export async function linkUtteranceToEvaluationItem(userId: string, utteranceId: string, evaluationItemId: string, tx?: Tx, now = Date.now()): Promise<EvaluationUtteranceLink> {
  const db = tx ?? prisma
  const notFound = () => new ApiError('NOT_FOUND', '녹음을 찾을 수 없어요.')
  if (!ID_RE.test(utteranceId)) throw notFound()
  const row = await db.utterance.findFirst({
    where: { id: utteranceId, userId },
    select: { chatId: true, chatMessageId: true, evaluationItemId: true, lessonId: true, createdAt: true, finalText: true, realtimeText: true, audioPath: true, audioExpiresAt: true, audioDeletedAt: true },
  })
  if (!row) throw notFound()
  const problem = evaluationUtteranceProblem(row, evaluationItemId, now)
  if (problem) throw problem
  if (!row.evaluationItemId) {
    const res = await db.utterance.updateMany({
      where: { id: utteranceId, userId, evaluationItemId: null, lessonId: null, chatId: null, chatMessageId: null },
      data: { evaluationItemId },
    })
    if (res.count === 0) throw new ApiError('CONFLICT', '이미 다른 곳에 쓴 녹음이에요.', { reason: 'UTTERANCE_USED' })
  }
  const text = (row.finalText ?? '').trim() || row.realtimeText.trim()
  return { id: utteranceId, text, hasAudio: audioKept(row, now) }
}

const VOICED_MAX_ITEMS = 50

/** 단위 테스트가 바꿔 끼운다. */
export const voicedDb = {
  linked: (userId: string, itemIds: string[]): Promise<{ evaluationItemId: string | null; finalText: string | null; realtimeText: string }[]> =>
    prisma.utterance.findMany({ where: { userId, evaluationItemId: { in: itemIds } }, select: { evaluationItemId: true, finalText: true, realtimeText: true } }),
}

/**
 * #66 `items[].voiced`(task-012b-2 D-2) — 저장된 답이 이 문항에 붙은 녹음에서 왔는가. 채점이 학습자가 직접 고친 글(#21a USER)을 고르면
 * 답은 `inputSource=TEXT` 로 남아 글자로 쓴 답과 구분되지 않는다(D-B7) — 결과 화면이 "말로 답함 · 내가 고친 말로 채점"을 보이려면 이 값이 필요하다.
 * 판정은 채점 텍스트 선택과 같은 규칙(`answerCameFrom` — 답과 발화의 연결 당시 텍스트가 같다). learning 은 speech 를 모르므로 라우트가 조합한다.
 */
export async function voicedEvaluationItems(userId: string, items: readonly { evaluationItemId: string; answerText: string }[]): Promise<Set<string>> {
  const out = new Set<string>()
  const wanted = items.filter((i) => ID_RE.test(i.evaluationItemId) && i.answerText.trim()).slice(0, VOICED_MAX_ITEMS)
  if (wanted.length === 0) return out
  const rows = await voicedDb.linked(userId, [...new Set(wanted.map((i) => i.evaluationItemId))])
  for (const it of wanted) {
    if (rows.some((r) => r.evaluationItemId === it.evaluationItemId && answerCameFrom(it.answerText, r))) out.add(it.evaluationItemId)
  }
  return out
}
