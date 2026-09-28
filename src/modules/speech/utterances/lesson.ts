/**
 * 레슨 말하기 ↔ 발화 연결(task-010 #62b) — `Utterance` 는 speech 소유라 라우트가 learning(레슨 소유 확인)과 조합한다.
 *
 * 연결 조건(모두 만족해야): 세션 사용자 소유(아니면 404) · 채팅 메시지·대화방·평가 문항에 쓰이지 않음(아니면 409 UTTERANCE_USED /
 * UTTERANCE_OTHER_CHAT) · 다른 레슨에 붙지 않음(409 UTTERANCE_OTHER_LESSON) · 처음 붙일 때는 생성 10분 이내(409 UTTERANCE_EXPIRED).
 * 이미 이 레슨에 붙은 발화는 다시 참조해도 된다(같은 녹음으로 다시 확인). 연결은 조건부 `updateMany`(`usage.ts` — 메시지·레슨·평가·대화방 모두 NULL)
 * — 채팅 턴 연결도 같은 조건을 쓰므로 한 발화가 레슨과 메시지에 함께 붙지 않는다. 경합에서 지면 409.
 * 원음 재생은 기존 #21b(`/speech/utterances/:id/audio`) — 여기서는 보존 여부(`hasAudio`)만 알려 준다.
 */
import { ApiError, prisma, type Tx } from '@/modules/infra'
import { UTTERANCE_TURN_WINDOW_MS } from './turn'
import { unclaimedUtteranceWhere } from './usage'

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/

export interface LessonUtteranceLink {
  id: string
  hasAudio: boolean
}

interface Row {
  chatId: string | null
  chatMessageId: string | null
  evaluationItemId: string | null
  lessonId: string | null
  createdAt: Date
  audioPath: string | null
  audioExpiresAt: Date | null
  audioDeletedAt: Date | null
}

/** 순수 판정 — 문제가 없으면 null. */
export function lessonUtteranceProblem(row: Row, lessonId: string, now: number): ApiError | null {
  if (row.chatMessageId || row.evaluationItemId) return new ApiError('CONFLICT', '이미 다른 곳에 쓴 녹음이에요.', { reason: 'UTTERANCE_USED' })
  if (row.chatId) return new ApiError('CONFLICT', '대화방에서 녹음한 말이에요.', { reason: 'UTTERANCE_OTHER_CHAT' })
  if (row.lessonId && row.lessonId !== lessonId) return new ApiError('CONFLICT', '다른 수업에서 녹음한 말이에요.', { reason: 'UTTERANCE_OTHER_LESSON' })
  if (!row.lessonId && now - row.createdAt.getTime() > UTTERANCE_TURN_WINDOW_MS) return new ApiError('CONFLICT', '녹음한 지 오래됐어요. 다시 말해 주세요.', { reason: 'UTTERANCE_EXPIRED' })
  return null
}

export function audioKept(row: Pick<Row, 'audioPath' | 'audioExpiresAt' | 'audioDeletedAt'>, now: number): boolean {
  return !!row.audioPath && !row.audioDeletedAt && (!row.audioExpiresAt || row.audioExpiresAt.getTime() > now)
}

/** `lessonId` 는 라우트가 소유를 확인한 레슨. 호출자 트랜잭션 안에서 부르면 이후 쓰기가 실패할 때 연결도 되돌려진다. */
export async function linkUtteranceToLesson(userId: string, utteranceId: string, lessonId: string, tx?: Tx, now = Date.now()): Promise<LessonUtteranceLink> {
  const db = tx ?? prisma
  const notFound = () => new ApiError('NOT_FOUND', '녹음을 찾을 수 없어요.')
  if (!ID_RE.test(utteranceId)) throw notFound()
  const row = await db.utterance.findFirst({
    where: { id: utteranceId, userId },
    select: { chatId: true, chatMessageId: true, evaluationItemId: true, lessonId: true, createdAt: true, audioPath: true, audioExpiresAt: true, audioDeletedAt: true },
  })
  if (!row) throw notFound()
  const problem = lessonUtteranceProblem(row, lessonId, now)
  if (problem) throw problem
  if (!row.lessonId) {
    const res = await db.utterance.updateMany({ where: unclaimedUtteranceWhere(userId, utteranceId, 'lesson'), data: { lessonId } })
    if (res.count === 0) throw new ApiError('CONFLICT', '이미 다른 곳에 쓴 녹음이에요.', { reason: 'UTTERANCE_USED' })
  }
  return { id: utteranceId, hasAudio: audioKept(row, now) }
}
