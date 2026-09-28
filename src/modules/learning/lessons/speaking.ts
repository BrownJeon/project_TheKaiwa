/**
 * 말하기 확인(#62b, L1 — LLM 없음)·레슨 오디오 문장 고르기(#62c). 발화 연결·음성 합성은 speech 소유라 라우트가 조합한다.
 */
import { ApiError, prisma, truncateCodePoints, type Tx } from '@/modules/infra'
import { audioText, checkSpeaking, readStoredContent, type AudioKind, type SpeakingCheck } from './content'
import { SPEAKING_TEXT_STORE_MAX, withSpeaking } from './progress'
import { lessonNotFound, writeProgress, type LessonWriteHandle } from './rows'
import { isLessonId } from './validate'

/** 과제 id 가 이 레슨에 없으면 400. 판정만(쓰기 없음). */
export function checkLessonSpeaking(h: LessonWriteHandle, itemId: string, text: string): SpeakingCheck {
  const r = checkSpeaking(h.content, itemId, text)
  if (!r) throw new ApiError('VALIDATION', '이 수업에 없는 말하기 과제예요.', { field: 'itemId', reason: 'unknown_item' })
  return r
}

/** 결과를 `progress.speaking[]` 에 남긴다(같은 과제는 마지막 시도로 교체). 말한 내용은 앞 200자만. */
export async function saveSpeakingAttempt(tx: Tx, h: LessonWriteHandle, entry: { check: SpeakingCheck; text: string; utteranceId: string | null }): Promise<void> {
  const next = withSpeaking(h.progress, {
    itemId: entry.check.itemId,
    text: truncateCodePoints(entry.text, SPEAKING_TEXT_STORE_MAX),
    matchedIds: entry.check.matchedIds,
    missedIds: entry.check.missedIds,
    utteranceId: entry.utteranceId,
    at: new Date().toISOString(),
  })
  await writeProgress(tx, h, next)
}

/** 모범 답(화면이 비교해 보여 줄 것). */
export function speakingModel(h: LessonWriteHandle, itemId: string): { ja: string; reading: string; ko: string } | null {
  const s = h.content.speaking.find((x) => x.id === itemId)
  return s ? { ja: s.modelAnswerJa, reading: s.modelReading, ko: s.modelKo } : null
}

/** #62c 재생할 문장 — 소유자만(404), 본문이 있는 레슨(READY·IN_PROGRESS·DONE, 아니면 409), 범위 밖 idx 400. */
export async function getLessonAudioSource(userId: string, id: string, q: { kind: AudioKind; idx: number }): Promise<{ text: string; topicId: string | null }> {
  if (!isLessonId(id)) throw lessonNotFound()
  const row = await prisma.lesson.findFirst({ where: { id, userId }, select: { status: true, topicId: true, content: true } })
  if (!row) throw lessonNotFound()
  const content = readStoredContent(row.content)
  if (!content || (row.status !== 'READY' && row.status !== 'IN_PROGRESS' && row.status !== 'DONE')) {
    throw new ApiError('CONFLICT', '아직 수업을 열 수 없어요.', { reason: 'NOT_READY', status: row.status })
  }
  const text = audioText(content, q.kind, q.idx)
  if (!text) throw new ApiError('VALIDATION', '없는 문장이에요.', { field: 'idx', reason: 'out_of_range' })
  return { text, topicId: row.topicId }
}
