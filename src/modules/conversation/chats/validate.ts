/**
 * 대화 API 입력 검증(api-contract #27·#28·#30·#32) — 순수 함수. 위반은 `400 VALIDATION`(필드·이유), 아직 열리지 않은 기능은
 * `400 FEATURE_NOT_READY`.
 *
 * 문자열 규칙(task-006 D10·입력 안전): 길이는 코드포인트, 제어문자 제거(본문은 `\n`·`\t` 보존, 제목은 한 줄), 앞뒤 공백 제거 후
 * 비었으면 400. 이모지는 그대로 둔다. **정리된 `text` 가 저장값이고, 이후 모든 바이트 비교(교정 original)의 기준이다.**
 */
import type { ChatKind, InputSource, JlptLevel } from '@prisma/client'
import { ApiError, codePointLength, sanitizeText } from '@/modules/infra'

export const CHAT_KINDS = ['TALK', 'CHAT', 'ASK'] as const
export const INPUT_SOURCES = ['REALTIME_STT', 'SERVER_STT', 'TEXT'] as const
export const CHAT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const TURN_TEXT_MAX = 1_000
export const CHAT_TITLE_MAX = 100

function bad(field: string, reason: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

export function featureNotReady(message: string): ApiError {
  return new ApiError('FEATURE_NOT_READY', message)
}

function optionalId(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || v.length === 0 || v.length > 40) bad(field, 'id', `${field} 형식이 올바르지 않습니다.`)
  return v
}

/** 제목(한 줄) — 비었으면 null(호출자가 기본값), 100 코드포인트 초과는 400. */
export function parseTitle(v: unknown, opts: { required: boolean }): string | null {
  if (v === undefined || v === null) {
    if (opts.required) bad('title', 'required', '제목을 입력해 주세요.')
    return null
  }
  if (typeof v !== 'string') bad('title', 'string', '제목 형식이 올바르지 않습니다.')
  const t = sanitizeText(v)
  if (!t) {
    if (opts.required) bad('title', 'required', '제목을 입력해 주세요.')
    return null
  }
  if (codePointLength(t) > CHAT_TITLE_MAX) bad('title', `length 1~${CHAT_TITLE_MAX}`, `제목은 ${CHAT_TITLE_MAX}자까지 쓸 수 있어요.`)
  return t
}

export function parseKind(v: unknown, field = 'kind'): ChatKind {
  if (typeof v !== 'string' || !(CHAT_KINDS as readonly string[]).includes(v)) bad(field, CHAT_KINDS.join('|'), `${field} 값이 올바르지 않습니다.`)
  return v as ChatKind
}

export interface CreateChatInput {
  kind: 'TALK' | 'CHAT'
  title: string | null
  topicId: string | null
  level: JlptLevel | null
}

/** #28 — ASK·레슨 역할극·시나리오는 아직 열리지 않았다(400 FEATURE_NOT_READY). */
export function parseCreateChat(body: Record<string, unknown>): CreateChatInput {
  const kind = parseKind(body.kind)
  if (kind === 'ASK') throw featureNotReady('무엇이든 물어보기는 아직 준비 중이에요.')
  if (body.lessonId != null) throw featureNotReady('레슨 역할극 대화는 아직 준비 중이에요.')
  if (body.scenarioId != null) throw featureNotReady('상황 대화는 아직 준비 중이에요.')
  let level: JlptLevel | null = null
  if (body.level !== undefined && body.level !== null) {
    if (typeof body.level !== 'string' || !(CHAT_LEVELS as readonly string[]).includes(body.level)) bad('level', CHAT_LEVELS.join('|'), 'level 값이 올바르지 않습니다.')
    level = body.level as JlptLevel
  }
  return { kind, title: parseTitle(body.title, { required: false }), topicId: optionalId(body.topicId, 'topicId'), level }
}

/**
 * #32 `clientTimings`(task-007 designer §9-11 ⑤) — 기준점은 **손 뗌**(글자 턴은 보내기 누름). `sttMs` 만 이번 턴 값이고
 * 나머지는 `prevMessageId` 턴(직전 강사 메시지)의 재생 계측이다. 서버는 0~120000 숫자만 받아 Trace `STT`·`PLAYBACK` 단계에만 쓴다.
 */
export interface TurnClientTimings {
  prevMessageId: string | null
  sttMs: number | null
  releaseToFirstAudioEventMs: number | null
  firstAudioAtMs: number | null
  playbackStartDelayMs: number | null
}

export const CLIENT_TIMING_MAX_MS = 120_000
const TIMING_FIELDS = ['sttMs', 'releaseToFirstAudioEventMs', 'firstAudioAtMs', 'playbackStartDelayMs'] as const

export type TurnRequest =
  | { resume: true }
  | {
      resume: false
      text: string
      inputSource: InputSource
      utteranceId: string | null
      clientTimings: TurnClientTimings | null
      /** task-010c — 직전 코치 힌트 카드의 정답을 열고 말했는가(TALK 자기수정 판정 SELF/REPEAT 구분). 생략 = false. */
      coachRevealed?: boolean
    }

function parseClientTimings(v: unknown): TurnClientTimings | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'object' || Array.isArray(v)) bad('clientTimings', 'object', 'clientTimings 형식이 올바르지 않습니다.')
  const o = v as Record<string, unknown>
  const out: TurnClientTimings = { prevMessageId: optionalId(o.prevMessageId, 'clientTimings.prevMessageId'), sttMs: null, releaseToFirstAudioEventMs: null, firstAudioAtMs: null, playbackStartDelayMs: null }
  for (const f of TIMING_FIELDS) {
    const x = o[f]
    if (x === undefined || x === null) continue
    if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > CLIENT_TIMING_MAX_MS) bad(`clientTimings.${f}`, `0~${CLIENT_TIMING_MAX_MS}`, 'clientTimings 값이 올바르지 않습니다.')
    out[f] = Math.round(x)
  }
  return out
}

/**
 * #32 본문. `resumePending:true` 면 다른 필드는 보지 않는다.
 * `utteranceId`(음성 발화, task-007): `inputSource` 를 생략하면 `REALTIME_STT` 로 본다. `REALTIME_STT` 인데 없으면 400,
 * `TEXT` 와 함께 오면 400(발화에 묶인 턴은 음성 입력이다 — 인식 결과를 글자로 고쳐 보내도 `REALTIME_STT` + 같은 id + 고친 text).
 * 발화 소유자·미연결·10분 검사와 finalText 갱신은 speech 층 일이라 라우트가 조합한다.
 */
export function parseTurnBody(body: Record<string, unknown>): TurnRequest {
  if (body.resumePending === true) return { resume: true }
  if (body.resumePending !== undefined && body.resumePending !== false) bad('resumePending', 'boolean', 'resumePending 형식이 올바르지 않습니다.')
  if (typeof body.text !== 'string') bad('text', 'required', '보낼 내용을 입력해 주세요.')
  const text = sanitizeText(body.text, { multiline: true })
  if (!text) bad('text', 'blank', '보낼 내용을 입력해 주세요.')
  if (codePointLength(text) > TURN_TEXT_MAX) bad('text', `length 1~${TURN_TEXT_MAX}`, `메시지는 ${TURN_TEXT_MAX}자까지 보낼 수 있어요.`)
  const utteranceId = optionalId(body.utteranceId, 'utteranceId')
  let inputSource: InputSource = utteranceId ? 'REALTIME_STT' : 'TEXT'
  if (body.inputSource !== undefined && body.inputSource !== null) {
    if (typeof body.inputSource !== 'string' || !(INPUT_SOURCES as readonly string[]).includes(body.inputSource)) bad('inputSource', INPUT_SOURCES.join('|'), 'inputSource 값이 올바르지 않습니다.')
    inputSource = body.inputSource as InputSource
  }
  if (inputSource === 'REALTIME_STT' && !utteranceId) bad('utteranceId', 'required', '음성 인식 입력에는 utteranceId 가 필요합니다.')
  if (utteranceId && inputSource === 'TEXT') bad('inputSource', 'REALTIME_STT|SERVER_STT', '음성 발화는 inputSource 가 REALTIME_STT 여야 합니다.')
  if (body.coachRevealed !== undefined && body.coachRevealed !== null && typeof body.coachRevealed !== 'boolean') bad('coachRevealed', 'boolean', 'coachRevealed 형식이 올바르지 않습니다.')
  return { resume: false, text, inputSource, utteranceId, clientTimings: parseClientTimings(body.clientTimings), coachRevealed: body.coachRevealed === true }
}
