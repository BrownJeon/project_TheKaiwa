/**
 * 턴 ↔ 발화 연결(task-007 K6, Codex C1-2 판정) — `Utterance` 는 speech 소유 테이블이라 #32 라우트가 conversation 과 조합한다.
 *
 *  ① 수락 전 `checkUtteranceForTurn`: 세션 사용자 소유(아니면·없으면 404) + 아직 어느 메시지에도 연결되지 않음(`chatMessageId IS NULL`,
 *     아니면 409 `UTTERANCE_USED`) + 생성 10분 이내(아니면 409 `UTTERANCE_EXPIRED`) — 오래된 녹음 재사용을 막는다.
 *     수락 전 거절(409 턴 진행 중·429·네트워크)로 아직 연결되지 않은 발화는 같은 id 로 다시 보낼 수 있다(designer §9-11 ⑧).
 *  ② 수락 뒤 `linkUtteranceToMessage`: **조건부** `updateMany WHERE id AND userId AND chatMessageId IS NULL` 로 연결하고,
 *     보낸 text 가 finalText 와 다르면 `finalText=text, finalSource=USER`(학습자가 글자로 고쳐 보냄). count 0(경합)이면 연결 없이
 *     턴은 계속하고 Trace 에 경고만 남긴다(사용자당 턴 락이 이미 동시 턴을 막는 이중 방어).
 *  발화 ↔ 채팅 결속(티켓 chatId 보존)은 스키마(`Utterance.chatId`)가 필요해 후속(domain-model 제안). 자기 발화를 자기 다른 방에
 *  쓰는 것은 타인 노출이 아니라 수용한다.
 * #21b 원음은 소유자만, 보존 기한(30일)이 지났거나 지워졌으면 404.
 */
import { ApiError, prisma, readDataFile } from '@/modules/infra'

export const UTTERANCE_TURN_WINDOW_MS = 10 * 60_000
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const AUDIO_PATH = /^users\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/utterances\/\d{4}-\d{2}\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.wav$/

export interface TurnUtterance {
  id: string
  finalText: string | null
}

const notFound = () => new ApiError('NOT_FOUND', '녹음을 찾을 수 없어요.')

export async function checkUtteranceForTurn(userId: string, utteranceId: string, now = Date.now()): Promise<TurnUtterance> {
  if (!ID_RE.test(utteranceId)) throw notFound()
  const row = await prisma.utterance.findFirst({ where: { id: utteranceId, userId }, select: { id: true, chatMessageId: true, createdAt: true, finalText: true } })
  if (!row) throw notFound()
  if (row.chatMessageId) throw new ApiError('CONFLICT', '이미 보낸 말이에요.', { reason: 'UTTERANCE_USED' })
  if (now - row.createdAt.getTime() > UTTERANCE_TURN_WINDOW_MS) throw new ApiError('CONFLICT', '녹음한 지 오래됐어요. 다시 말해 주세요.', { reason: 'UTTERANCE_EXPIRED' })
  return { id: row.id, finalText: row.finalText }
}

export interface UtteranceLinkResult {
  linked: boolean
  finalSourceUser: boolean
}

export async function linkUtteranceToMessage(input: { userId: string; utterance: TurnUtterance; messageId: string; text: string }): Promise<UtteranceLinkResult> {
  const edited = input.utterance.finalText !== input.text
  const res = await prisma.utterance.updateMany({
    where: { id: input.utterance.id, userId: input.userId, chatMessageId: null },
    data: { chatMessageId: input.messageId, ...(edited ? { finalText: input.text, finalSource: 'USER' as const } : {}) },
  })
  return { linked: res.count === 1, finalSourceUser: res.count === 1 && edited }
}

export interface UtteranceAudio {
  audio: Buffer
  durationMs: number
}

/** #21b — 소유자·보존 기한 안·파일 있음. 그 밖은 null(라우트가 404). */
export async function readUtteranceAudio(userId: string, utteranceId: string, now = new Date()): Promise<UtteranceAudio | null> {
  if (typeof utteranceId !== 'string' || !ID_RE.test(utteranceId)) return null
  const row = await prisma.utterance.findFirst({ where: { id: utteranceId, userId }, select: { audioPath: true, audioExpiresAt: true, audioDeletedAt: true, durationMs: true } })
  if (!row || !row.audioPath || row.audioDeletedAt || (row.audioExpiresAt && row.audioExpiresAt <= now) || !AUDIO_PATH.test(row.audioPath)) return null
  // 경로의 사용자 조각이 세션 사용자와 같아야 한다(행 소유 + 경로 소유 이중 확인).
  if (row.audioPath.split('/')[1] !== userId) return null
  const audio = await readDataFile(row.audioPath.split('/'))
  return audio ? { audio, durationMs: row.durationMs } : null
}

export interface MessageUtterance {
  utteranceId: string
  audioAvailable: boolean
}

/** #29 조합용 — 사용자 메시지 id → 연결된 발화(가장 이른 것)와 원음 재생 가능 여부. 다른 사용자 행은 보지 않는다. */
export async function utterancesForMessages(userId: string, messageIds: string[], now = new Date()): Promise<Map<string, MessageUtterance>> {
  const out = new Map<string, MessageUtterance>()
  if (messageIds.length === 0) return out
  const rows = await prisma.utterance.findMany({
    where: { userId, chatMessageId: { in: messageIds.slice(0, 200) } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, chatMessageId: true, audioPath: true, audioExpiresAt: true, audioDeletedAt: true },
  })
  for (const r of rows) {
    if (!r.chatMessageId || out.has(r.chatMessageId)) continue
    const audioAvailable = !!r.audioPath && !r.audioDeletedAt && (!r.audioExpiresAt || r.audioExpiresAt > now)
    out.set(r.chatMessageId, { utteranceId: r.id, audioAvailable })
  }
  return out
}
