/**
 * AI 평가 API 본문·쿼리 검증(api-contract #65·#67·#69) — 순수 함수. 위반은 전부 400 VALIDATION, 화이트리스트 밖 키도 400.
 * 문항 종류별 답 모양(보기 안의 값인가·조각 순서가 순열인가)은 문항을 읽은 뒤 `scoring.ts` 의 `normalizeAnswer` 가 본다.
 */
import type { EvalKind, InputSource, JlptLevel } from '@prisma/client'
import { ApiError, decodeCursor, isTimeIdCursor, parseLimit, sanitizeText } from '@/modules/infra'

export const EVAL_ANSWER_TEXT_MAX = 2_000
export const EVAL_PIECES_MAX = 7
export const EVAL_LIST_LIMIT_MAX = 50

const JLPT: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const KINDS: readonly EvalKind[] = ['WORDS', 'TALK']
const SOURCES: readonly InputSource[] = ['REALTIME_STT', 'SERVER_STT', 'TEXT']
const ID = /^[A-Za-z0-9_-]{1,40}$/

function bad(field: string, message: string, reason = 'invalid'): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function onlyKeys(body: Record<string, unknown>, keys: readonly string[]): void {
  const extra = Object.keys(body).filter((k) => !keys.includes(k))
  if (extra.length) bad(extra[0], `넣을 수 없는 항목입니다: ${extra.join(', ')}`, 'unknown_key')
}

export function isEvaluationId(id: unknown): id is string {
  return typeof id === 'string' && ID.test(id)
}

export interface CreateEvaluationInput {
  kind: EvalKind
  topicId: string | null
  /** 없으면 Profile.level. */
  level: JlptLevel | null
}

/** #65 — `{kind, topicId?, level?}`. */
export function parseCreateEvaluationBody(body: Record<string, unknown>): CreateEvaluationInput {
  onlyKeys(body, ['kind', 'topicId', 'level'])
  if (!KINDS.includes(body.kind as EvalKind)) bad('kind', '평가 종류는 WORDS 또는 TALK 예요.', 'enum')
  let topicId: string | null = null
  if (body.topicId !== undefined && body.topicId !== null) {
    if (!isEvaluationId(body.topicId)) bad('topicId', '주제 id 형식이 올바르지 않습니다.')
    topicId = body.topicId
  }
  let level: JlptLevel | null = null
  if (body.level !== undefined && body.level !== null) {
    if (!JLPT.includes(body.level as JlptLevel)) bad('level', '레벨은 N5~N1 중 하나예요.', 'enum')
    level = body.level as JlptLevel
  }
  return { kind: body.kind as EvalKind, topicId, level }
}

export interface AnswerInput {
  /** 정리한 답 글자(없으면 null — 조립은 `pieceOrder`, 말하기는 `utteranceId` 로 대신할 수 있다). */
  answerText: string | null
  inputSource: InputSource
  utteranceId: string | null
  /** ASSEMBLE 전용 — `prompt.pieces` 의 번호를 고른 순서대로(순열). */
  pieceOrder: number[] | null
}

/**
 * #67 — `{answerText?, inputSource?, utteranceId?, pieceOrder?}`.
 * inputSource 기본값: utteranceId 가 있으면 REALTIME_STT, 없으면 TEXT. 음성 입력인데 발화 id 가 없거나(#32 와 같은 규칙),
 * 키보드 입력인데 발화 id 가 있으면 400.
 */
export function parseAnswerBody(body: Record<string, unknown>): AnswerInput {
  onlyKeys(body, ['answerText', 'inputSource', 'utteranceId', 'pieceOrder'])
  let answerText: string | null = null
  if (body.answerText !== undefined && body.answerText !== null) {
    if (typeof body.answerText !== 'string') bad('answerText', '답은 문자열이어야 합니다.')
    const t = sanitizeText(body.answerText, { multiline: true }).trim()
    if ([...t].length > EVAL_ANSWER_TEXT_MAX) bad('answerText', `답은 ${EVAL_ANSWER_TEXT_MAX}자까지 쓸 수 있어요.`, `max ${EVAL_ANSWER_TEXT_MAX}`)
    answerText = t || null
  }
  let utteranceId: string | null = null
  if (body.utteranceId !== undefined && body.utteranceId !== null) {
    if (!isEvaluationId(body.utteranceId)) bad('utteranceId', '녹음 id 형식이 올바르지 않습니다.')
    utteranceId = body.utteranceId
  }
  let inputSource: InputSource = utteranceId ? 'REALTIME_STT' : 'TEXT'
  if (body.inputSource !== undefined && body.inputSource !== null) {
    if (!SOURCES.includes(body.inputSource as InputSource)) bad('inputSource', '입력 방식 값이 올바르지 않습니다.', 'enum')
    inputSource = body.inputSource as InputSource
  }
  if (inputSource !== 'TEXT' && !utteranceId) bad('utteranceId', '음성 답에는 녹음 id 가 필요해요.', 'required')
  if (inputSource === 'TEXT' && utteranceId) bad('inputSource', '녹음으로 답했다면 입력 방식은 음성이어야 해요.', 'mismatch')
  let pieceOrder: number[] | null = null
  if (body.pieceOrder !== undefined && body.pieceOrder !== null) {
    const p = body.pieceOrder
    if (!Array.isArray(p) || p.length < 1 || p.length > EVAL_PIECES_MAX || !p.every((x) => Number.isInteger(x) && x >= 0 && x < EVAL_PIECES_MAX)) {
      bad('pieceOrder', `조각 순서는 0~${EVAL_PIECES_MAX - 1} 번호 배열이어야 합니다.`)
    }
    pieceOrder = p as number[]
  }
  return { answerText, inputSource, utteranceId, pieceOrder }
}

export interface EvaluationListQuery {
  limit: number
  cursor: { t: string; id: string } | null
  kind: EvalKind | null
}

/** #69 — `?limit=1~50(기본 20)&cursor=&kind=WORDS|TALK`. */
export function parseEvaluationListQuery(q: URLSearchParams): EvaluationListQuery {
  const kind = q.get('kind')
  if (kind && !KINDS.includes(kind as EvalKind)) bad('kind', '평가 종류는 WORDS 또는 TALK 예요.', 'enum')
  return {
    limit: parseLimit(q.get('limit'), 20, EVAL_LIST_LIMIT_MAX),
    cursor: decodeCursor(q.get('cursor'), isTimeIdCursor),
    kind: (kind as EvalKind | null) || null,
  }
}
