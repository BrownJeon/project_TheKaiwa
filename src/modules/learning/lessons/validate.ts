/**
 * 레슨 API 본문 검증(api-contract #59·#61·#62·#62a·#62b·#62c) — 순수 함수. 위반은 전부 400 VALIDATION, 화이트리스트 밖 키도 400.
 */
import { ApiError, codePointLength, sanitizeText } from '@/modules/infra'
import { AUDIO_KINDS, AUDIO_SUB_KINDS, type AudioKind } from './content'
import { cleanMemoWord, MEMO_PER_LESSON_MAX, MEMO_PER_SEGMENT_MAX, MEMO_WORD_MAX } from './progress'

export const LESSON_SOURCE_TEXT_MIN = 50
export const LESSON_SOURCE_TEXT_MAX = 2_000
export const LESSON_SOURCE_JA_RATIO_MIN = 0.3
export const SPEAKING_TEXT_MAX = 1_000
export const LESSON_STAGE_MAX = 5

function bad(field: string, message: string, reason = 'invalid'): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function onlyKeys(body: Record<string, unknown>, keys: readonly string[]): void {
  const extra = Object.keys(body).filter((k) => !keys.includes(k))
  if (extra.length) bad(extra[0], `넣을 수 없는 항목입니다: ${extra.join(', ')}`, 'unknown_key')
}

const ID = /^[A-Za-z0-9_-]{1,40}$/

export function isLessonId(id: unknown): id is string {
  return typeof id === 'string' && ID.test(id)
}

/** 공백을 뺀 문자 중 가나·한자 비율(프롬프트 쪽 판정과 같은 식 — 여기서 먼저 걸러 400 문구를 분명히 한다). */
export function japaneseRatio(text: string): number {
  const chars = [...text].filter((c) => !/\s/.test(c))
  if (!chars.length) return 0
  return chars.filter((c) => /[぀-ヿ一-鿿]/.test(c)).length / chars.length
}

export type CreateLessonInput =
  | { kind: 'topic'; topicId: string }
  | { kind: 'text'; sourceText: string }
  /** 상황 수업(task-010d A2) — `topicId` 는 선택(그 상황과 이어진 주제여야 한다 — 확인은 재료 읽기에서). */
  | { kind: 'scenario'; scenarioId: string; topicId: string | null }

/**
 * #59 — `{topicId}` 또는 `{sourceText}`(50~2,000자, 가나·한자 ≥30%) 중 정확히 하나, 또는 상황 수업 `{scenarioId, topicId?}`.
 * 상황 수업은 붙여 넣은 문장과 함께 만들 수 없다(A4 `[상황]` 블록이 `sourceText` 와 같이 쓰이지 않는다 — 400 `not_with_scenario`).
 */
export function parseCreateLessonBody(body: Record<string, unknown>): CreateLessonInput {
  onlyKeys(body, ['topicId', 'sourceText', 'scenarioId'])
  const hasTopic = body.topicId !== undefined && body.topicId !== null
  const hasText = body.sourceText !== undefined && body.sourceText !== null
  if (body.scenarioId !== undefined && body.scenarioId !== null) {
    if (hasText) bad('sourceText', '상황 수업에는 문장을 붙여 넣을 수 없어요.', 'not_with_scenario')
    if (!isLessonId(body.scenarioId)) bad('scenarioId', '상황 id 형식이 올바르지 않습니다.')
    if (hasTopic && !isLessonId(body.topicId)) bad('topicId', '주제 id 형식이 올바르지 않습니다.')
    return { kind: 'scenario', scenarioId: body.scenarioId, topicId: hasTopic ? (body.topicId as string) : null }
  }
  if (hasTopic === hasText) bad(hasTopic ? 'sourceText' : 'topicId', '주제를 고르거나 문장을 붙여 넣어 주세요(둘 중 하나).', 'one_of')
  if (hasTopic) {
    if (!isLessonId(body.topicId)) bad('topicId', '주제 id 형식이 올바르지 않습니다.')
    return { kind: 'topic', topicId: body.topicId }
  }
  if (typeof body.sourceText !== 'string') bad('sourceText', '붙여 넣을 문장은 문자열이어야 합니다.')
  const text = sanitizeText(body.sourceText as string, { multiline: true }).trim()
  const len = codePointLength(text)
  if (len < LESSON_SOURCE_TEXT_MIN || len > LESSON_SOURCE_TEXT_MAX) bad('sourceText', `문장은 ${LESSON_SOURCE_TEXT_MIN}~${LESSON_SOURCE_TEXT_MAX}자로 붙여 넣어 주세요.`, `length ${LESSON_SOURCE_TEXT_MIN}~${LESSON_SOURCE_TEXT_MAX}`)
  if (japaneseRatio(text) < LESSON_SOURCE_JA_RATIO_MIN) bad('sourceText', '일본어 문장을 붙여 넣어 주세요.', 'NOT_JAPANESE')
  return { kind: 'text', sourceText: text }
}

/** #61 — stageDone(0~5, 선택)·progress(선택), 둘 중 하나는 있어야 한다. progress 세부 검증은 레슨 본문을 안 뒤 `parseProgressPatch`. */
export function parseProgressBody(body: Record<string, unknown>): { stageDone: number | null; progress: unknown } {
  onlyKeys(body, ['stageDone', 'progress'])
  if (body.stageDone === undefined && body.progress === undefined) bad('stageDone', 'stageDone 또는 progress 가 필요합니다.', 'required')
  let stageDone: number | null = null
  if (body.stageDone !== undefined) {
    const s = body.stageDone
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > LESSON_STAGE_MAX) bad('stageDone', `stageDone 은 0~${LESSON_STAGE_MAX} 정수입니다.`)
    stageDone = s as number
  }
  return { stageDone, progress: body.progress }
}

/** #62 — `{score?}`(0~100 정수) 는 받되 **쓰지 않는다**(서버가 다시 채점 — L4). */
export function parseCompleteBody(body: Record<string, unknown>): void {
  onlyKeys(body, ['score'])
  if (body.score !== undefined && body.score !== null) {
    const s = body.score
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 100) bad('score', 'score 는 0~100 정수입니다.')
  }
}

export interface MemoRequestWord {
  segment: number
  /** 정규화한 단어(NFKC·공백 제거). 형식이 틀리면 null(→ 건너뜀 NOT_JAPANESE). */
  ja: string | null
  raw: string
}

/**
 * #62a — `{segments:[{segment, words[1~5]}]}`(구간 번호는 레슨 본문을 안 뒤 확인). 단어 형식 위반은 400 이 아니라 건너뜀(NOT_JAPANESE)이다 —
 * 화면이 이미 걸렀을 것이고, 한 단어 때문에 나머지 제안을 잃지 않게. 요청 전체 단어 수 ≤15.
 */
export function parseMemoBody(body: Record<string, unknown>): MemoRequestWord[] {
  onlyKeys(body, ['segments'])
  const segs = body.segments
  if (!Array.isArray(segs) || segs.length === 0 || segs.length > MEMO_PER_LESSON_MAX) bad('segments', 'segments 는 1개 이상 배열이어야 합니다.')
  const out: MemoRequestWord[] = []
  segs.forEach((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) bad(`segments[${i}]`, '구간 형식이 올바르지 않습니다.')
    const o = s as Record<string, unknown>
    const extra = Object.keys(o).filter((k) => k !== 'segment' && k !== 'words')
    if (extra.length) bad(`segments[${i}].${extra[0]}`, `넣을 수 없는 항목입니다: ${extra.join(', ')}`, 'unknown_key')
    if (typeof o.segment !== 'number' || !Number.isInteger(o.segment) || o.segment < 1 || o.segment > 20) bad(`segments[${i}].segment`, '구간 번호가 올바르지 않습니다.')
    if (!Array.isArray(o.words) || o.words.length === 0 || o.words.length > MEMO_PER_SEGMENT_MAX) bad(`segments[${i}].words`, `단어는 구간마다 1~${MEMO_PER_SEGMENT_MAX}개입니다.`)
    for (const w of o.words) {
      if (typeof w !== 'string' || w.length > MEMO_WORD_MAX * 4) bad(`segments[${i}].words`, '단어는 문자열이어야 합니다.')
      out.push({ segment: o.segment as number, ja: cleanMemoWord(w), raw: (w as string).trim().slice(0, MEMO_WORD_MAX) })
    }
  })
  if (out.length > MEMO_PER_LESSON_MAX) bad('segments', `단어는 한 번에 ${MEMO_PER_LESSON_MAX}개까지 보낼 수 있어요.`, 'LIMIT')
  return out
}

/** #62b — `{itemId, text(1~1,000), utteranceId?}`. */
export function parseSpeakingBody(body: Record<string, unknown>): { itemId: string; text: string; utteranceId: string | null } {
  onlyKeys(body, ['itemId', 'text', 'utteranceId'])
  if (typeof body.itemId !== 'string' || !/^[A-Za-z0-9_-]{1,10}$/.test(body.itemId)) bad('itemId', '말하기 과제 id 가 올바르지 않습니다.')
  if (typeof body.text !== 'string') bad('text', '말한 내용이 필요합니다.', 'required')
  const text = sanitizeText(body.text as string).trim()
  if (!text) bad('text', '말한 내용이 비었어요.', 'empty')
  if (codePointLength(text) > SPEAKING_TEXT_MAX) bad('text', `${SPEAKING_TEXT_MAX}자 이내로 보내 주세요.`)
  let utteranceId: string | null = null
  if (body.utteranceId !== undefined && body.utteranceId !== null) {
    if (!isLessonId(body.utteranceId)) bad('utteranceId', '녹음 id 형식이 올바르지 않습니다.')
    utteranceId = body.utteranceId as string
  }
  return { itemId: body.itemId as string, text, utteranceId }
}

export const AUDIO_PACES = ['slow', 'normal'] as const
export type AudioPace = (typeof AUDIO_PACES)[number]

/** 조각·구간 번호 상한(포함) — 한 줄 조각 수 최대 24(스키마 `pieces.maxItems`)의 index. */
export const AUDIO_SUB_MAX = 23

/**
 * #62c — `{kind, idx, pace?, sub?}`(pace 기본 normal). idx·sub 범위는 레슨 본문을 안 뒤 확인.
 * `sub`(task-081)는 piece·phrase 에서만 필수(0~23 정수), 다른 kind 에 오면 400 — 클라이언트 글(`text` 등)은 여전히 `unknown_key`.
 */
export function parseAudioBody(body: Record<string, unknown>): { kind: AudioKind; idx: number; pace: AudioPace; sub?: number } {
  onlyKeys(body, ['kind', 'idx', 'pace', 'sub'])
  if (typeof body.kind !== 'string' || !(AUDIO_KINDS as readonly string[]).includes(body.kind)) bad('kind', `kind 는 ${AUDIO_KINDS.join('|')} 입니다.`)
  const kind = body.kind as AudioKind
  if (typeof body.idx !== 'number' || !Number.isInteger(body.idx) || body.idx < 0 || body.idx > 20) bad('idx', 'idx 가 올바르지 않습니다.')
  const pace = body.pace === undefined || body.pace === null ? 'normal' : body.pace
  if (typeof pace !== 'string' || !(AUDIO_PACES as readonly string[]).includes(pace)) bad('pace', 'pace 는 slow|normal 입니다.')
  const base = { kind, idx: body.idx as number, pace: pace as AudioPace }
  if (!AUDIO_SUB_KINDS.includes(kind)) {
    if (body.sub !== undefined) bad('sub', 'sub 는 piece·phrase 에서만 씁니다.', 'not_allowed')
    return base
  }
  if (body.sub === undefined || body.sub === null) bad('sub', `${kind} 에는 sub 가 필요합니다.`, 'required')
  if (typeof body.sub !== 'number' || !Number.isInteger(body.sub) || body.sub < 0 || body.sub > AUDIO_SUB_MAX) bad('sub', `sub 는 0~${AUDIO_SUB_MAX} 정수입니다.`)
  return { ...base, sub: body.sub as number }
}
