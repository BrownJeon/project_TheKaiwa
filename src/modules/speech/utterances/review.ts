/**
 * #22 발화 조회 · #21a 재확인 발화의 텍스트 확정(api-contract §2-4 task-012b 확정 계약, domain-model §5-9 D-B5·D-B6).
 *
 *  - #22: 소유자만(타인·없음 404). **엔진 정보(realtimeEngine·analysisEngine·engineVersions)는 싣지 않는다.** 분석 전이면
 *    `analysisText`·`transcriptConfidence` 는 null, `SpeechAnalysis` 가 없으면 `analysis:null`(Phase 2 는 점수 칸 전부 null).
 *  - #21a `{choice:'REALTIME'|'ANALYSIS'|'USER', text?}`: **한 번의 조건부 갱신** `WHERE id AND userId AND status='ANALYZED' AND requiresReview=true`
 *    (+ 고른 안이 비어 있지 않음) → `finalText` = 실시간/분석/직접 입력, `finalSource = choice`, `requiresReview=false`. 0행이면 없음·타인 404,
 *    고른 안이 빈 문자열 400 EMPTY_CHOICE, 그 밖(분석 전·재확인 대상 아님·이미 확정) 409 NOT_REVIEWABLE. 동시 두 요청은 한쪽만 성공한다.
 *    바꾸는 것은 `Utterance` 뿐 — `ChatMessage.content`·`Correction.original`·평가 답·레슨 기록은 건드리지 않는다(원문 무수정).
 */
import type { FinalSource, UtteranceStatus } from '@prisma/client'
import { ApiError, codePointLength, prisma, sanitizeText } from '@/modules/infra'

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/
export const RESOLVE_TEXT_MAX = 1_000
const CHOICES = ['REALTIME', 'ANALYSIS', 'USER'] as const
export type ResolveChoice = (typeof CHOICES)[number]

export interface UtteranceView {
  id: string
  chatMessageId: string | null
  durationMs: number
  status: UtteranceStatus
  realtimeText: string
  analysisText: string | null
  transcriptConfidence: number | null
  requiresReview: boolean
  finalText: string | null
  finalSource: FinalSource
  analysis: {
    grammarScore: number | null
    pronunciationScore: number | null
    fluencyScore: number | null
    wordScores: unknown
    feedbackKo: string | null
    createdAt: string
  } | null
  /** 원음(#21b) — 보존 기한이 지났거나 지워졌으면 null. */
  audioUrl: string | null
}

const VIEW_SELECT = {
  id: true,
  chatMessageId: true,
  durationMs: true,
  status: true,
  realtimeText: true,
  analysisText: true,
  transcriptConfidence: true,
  requiresReview: true,
  finalText: true,
  finalSource: true,
  audioPath: true,
  audioExpiresAt: true,
  audioDeletedAt: true,
  analysis: { select: { grammarScore: true, pronunciationScore: true, fluencyScore: true, wordScores: true, feedbackKo: true, analyzedAt: true } },
} as const

type ViewRow = {
  id: string
  chatMessageId: string | null
  durationMs: number
  status: UtteranceStatus
  realtimeText: string
  analysisText: string | null
  transcriptConfidence: number | null
  requiresReview: boolean
  finalText: string | null
  finalSource: FinalSource
  audioPath: string | null
  audioExpiresAt: Date | null
  audioDeletedAt: Date | null
  analysis: { grammarScore: number | null; pronunciationScore: number | null; fluencyScore: number | null; wordScores: unknown; feedbackKo: string | null; analyzedAt: Date } | null
}

/** 행 → #22 DTO(순수). 엔진 칸은 select 에도 없다. */
export function toUtteranceView(r: ViewRow, now = new Date()): UtteranceView {
  const analyzed = r.status === 'ANALYZED'
  const audio = !!r.audioPath && !r.audioDeletedAt && (!r.audioExpiresAt || r.audioExpiresAt > now)
  return {
    id: r.id,
    chatMessageId: r.chatMessageId,
    durationMs: r.durationMs,
    status: r.status,
    realtimeText: r.realtimeText,
    analysisText: analyzed ? r.analysisText : null,
    transcriptConfidence: analyzed ? r.transcriptConfidence : null,
    requiresReview: r.requiresReview,
    finalText: r.finalText,
    finalSource: r.finalSource,
    analysis: r.analysis
      ? {
          grammarScore: r.analysis.grammarScore,
          pronunciationScore: r.analysis.pronunciationScore,
          fluencyScore: r.analysis.fluencyScore,
          wordScores: r.analysis.wordScores ?? null,
          feedbackKo: r.analysis.feedbackKo,
          createdAt: r.analysis.analyzedAt.toISOString(),
        }
      : null,
    audioUrl: audio ? `/api/v1/speech/utterances/${r.id}/audio` : null,
  }
}

const notFound = () => new ApiError('NOT_FOUND', '녹음을 찾을 수 없어요.')

/** #22 — 소유자만. */
export async function getUtteranceView(userId: string, id: string, now = new Date()): Promise<UtteranceView> {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw notFound()
  const row = await prisma.utterance.findFirst({ where: { id, userId }, select: VIEW_SELECT })
  if (!row) throw notFound()
  return toUtteranceView(row, now)
}

export interface ResolveInput {
  choice: ResolveChoice
  text: string | null
}

function bad(field: string, reason: string, message = '요청 본문이 올바르지 않습니다.'): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

/** #21a 본문 — `USER` 일 때만 `text`(앞뒤 공백 제거 1~1,000자) 필수, 나머지는 `text` 를 받지 않는다. */
export function parseResolveBody(body: Record<string, unknown>): ResolveInput {
  const extra = Object.keys(body).filter((k) => k !== 'choice' && k !== 'text')
  if (extra.length) bad(extra[0], 'unknown_key')
  if (typeof body.choice !== 'string' || !(CHOICES as readonly string[]).includes(body.choice)) bad('choice', 'enum')
  const choice = body.choice as ResolveChoice
  if (choice !== 'USER') {
    if (body.text !== undefined && body.text !== null) bad('text', 'only_for_user')
    return { choice, text: null }
  }
  if (typeof body.text !== 'string') bad('text', 'required', '직접 고친 문장을 적어 주세요.')
  const text = sanitizeText(body.text).trim()
  if (!text) bad('text', 'required', '직접 고친 문장을 적어 주세요.')
  if (codePointLength(text) > RESOLVE_TEXT_MAX) bad('text', `max ${RESOLVE_TEXT_MAX}`, `${RESOLVE_TEXT_MAX}자까지 적을 수 있어요.`)
  return { choice, text }
}

/** 조건부 갱신 1회 — 바뀐 행 수. 고른 안(실시간·분석)은 DB 값을 그대로 옮긴다(앱이 읽고 쓰는 사이 끼어들 틈이 없게). */
export const resolveDb = {
  update: async (userId: string, id: string, input: ResolveInput): Promise<number> => {
    if (input.choice === 'REALTIME') {
      return prisma.$executeRaw`UPDATE Utterance SET finalText = realtimeText, finalSource = 'REALTIME', requiresReview = 0
        WHERE id = ${id} AND userId = ${userId} AND status = 'ANALYZED' AND requiresReview = 1 AND TRIM(realtimeText) <> ''`
    }
    if (input.choice === 'ANALYSIS') {
      return prisma.$executeRaw`UPDATE Utterance SET finalText = analysisText, finalSource = 'ANALYSIS', requiresReview = 0
        WHERE id = ${id} AND userId = ${userId} AND status = 'ANALYZED' AND requiresReview = 1 AND analysisText IS NOT NULL AND TRIM(analysisText) <> ''`
    }
    return prisma.$executeRaw`UPDATE Utterance SET finalText = ${input.text ?? ''}, finalSource = 'USER', requiresReview = 0
      WHERE id = ${id} AND userId = ${userId} AND status = 'ANALYZED' AND requiresReview = 1`
  },
  state: (userId: string, id: string) =>
    prisma.utterance.findFirst({ where: { id, userId }, select: { status: true, requiresReview: true, realtimeText: true, analysisText: true } }),
}

/** #21a — 성공하면 #22 형태. */
export async function resolveFinalText(userId: string, id: string, input: ResolveInput, now = new Date()): Promise<UtteranceView> {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw notFound()
  const n = await resolveDb.update(userId, id, input)
  if (n === 0) {
    const s = await resolveDb.state(userId, id)
    if (!s) throw notFound()
    const chosen = input.choice === 'REALTIME' ? s.realtimeText : input.choice === 'ANALYSIS' ? (s.analysisText ?? '') : 'x'
    if (s.status === 'ANALYZED' && s.requiresReview && !chosen.trim()) bad('choice', 'EMPTY_CHOICE', '고른 문장이 비어 있어요. 다른 안을 골라 주세요.')
    throw new ApiError('CONFLICT', '확인할 수 있는 녹음이 아니에요.', { reason: 'NOT_REVIEWABLE' })
  }
  return getUtteranceView(userId, id, now)
}
