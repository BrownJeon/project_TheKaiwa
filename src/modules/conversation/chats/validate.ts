/**
 * 대화 API 입력 검증(api-contract #27·#28·#30·#32) — 순수 함수. 위반은 `400 VALIDATION`(필드·이유).
 * ASK(무엇이든 물어보세요 3a, task-064 §2-18-A)는 생성 키 `kind`·`title` 만, 턴은 글자(`TEXT`)와 실시간 음성 인식 글자(`REALTIME_STT`, 발화 id 없이 — task-066)만 받고 `scope` 는 ASK 한정이다.
 *
 * 문자열 규칙(task-006 D10·입력 안전): 길이는 코드포인트, 제어문자 제거(본문은 `\n`·`\t` 보존, 제목은 한 줄), 앞뒤 공백 제거 후
 * 비었으면 400. 이모지는 그대로 둔다. **정리된 `text` 가 저장값이고, 이후 모든 바이트 비교(교정 original)의 기준이다.**
 */
import type { ChatKind, InputSource, JlptLevel } from '@prisma/client'
import { ApiError, codePointLength, sanitizeText } from '@/modules/infra'
import { ASK_SCOPE_KEYS, type AskScopeKey } from '@/types/ask'

export const CHAT_KINDS = ['TALK', 'CHAT', 'ASK'] as const
export const INPUT_SOURCES = ['REALTIME_STT', 'SERVER_STT', 'TEXT'] as const
/**
 * 질문 방(ASK)이 받는 입력 방식(task-066) — 글자, 그리고 실시간 음성 인식(앱 온디바이스·gateway)이 만든 **글자**.
 * 서버 받아쓰기(`SERVER_STT`)는 질문에 쓰지 않는다. 음성 원본·발화 행(Utterance)은 질문에 연결하지 않는다(`assertAskInput`).
 */
export const ASK_INPUT_SOURCES = ['TEXT', 'REALTIME_STT'] as const
export const CHAT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const TURN_TEXT_MAX = 1_000
export const CHAT_TITLE_MAX = 100
const ASK_CREATE_KEYS: ReadonlySet<string> = new Set(['kind', 'title'])

function bad(field: string, reason: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
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
  kind: ChatKind
  title: string | null
  topicId: string | null
  level: JlptLevel | null
}

/**
 * #28. TALK·CHAT 의 상황 역할극 칸(`scenarioId`·`lessonId`)은 여기서 보지 않는다 — 라우트가 `parseRolePlayIds`(chats/rolePlay.ts) 결과가
 * 있으면 `createRolePlayChat` 으로 보낸다(task-010d A3b, CHAT 이면 거기서 400).
 * ASK 는 `kind`·`title` 밖의 키가 오면 값이 null 이어도 400 — 주제·상황·수업·수준은 질문 방의 개념이 아니다(§2-18-A 1항).
 */
export function parseCreateChat(body: Record<string, unknown>): CreateChatInput {
  const kind = parseKind(body.kind)
  if (kind === 'ASK') {
    for (const k of Object.keys(body)) if (!ASK_CREATE_KEYS.has(k)) bad(k.slice(0, 40), 'notAllowed', '질문 방에는 이 값을 보낼 수 없어요.')
    return { kind, title: parseTitle(body.title, { required: false }), topicId: null, level: null }
  }
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
      /** task-064 — ASK 기간 되묻기 답(칩). ASK 한정(`assertTurnFitsKind`), 생략이면 칸이 없다. 쓰임은 직전 답이 되물었을 때만(orchestrator). */
      scope?: { key: AskScopeKey }
    }

/** #32 `scope` — `{ key }` 객체만. 생략·null 은 없음. */
function parseScope(v: unknown): AskScopeKey | null {
  if (v === undefined || v === null) return null
  const key = typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>).key : undefined
  if (typeof key !== 'string' || !(ASK_SCOPE_KEYS as readonly string[]).includes(key)) bad('scope', `{key:${ASK_SCOPE_KEYS.join('|')}}`, 'scope 값이 올바르지 않습니다.')
  return key as AskScopeKey
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

export interface ParseTurnOptions {
  /**
   * `REALTIME_STT` 인데 `utteranceId` 가 없는 본문을 여기서 거절하지 않고 `assertTurnFitsKind` 로 미룬다 — 질문 방(ASK)의 음성 질문은
   * 발화 행(Utterance) 없이 인식된 글자만 보낸다(원음 미저장, task-066). 방 종류는 소유 확인 뒤에야 알 수 있어 라우트가 켠다.
   * 켜도 회화·채팅의 규칙은 그대로다(같은 400 이 `assertTurnFitsKind` 에서 난다).
   */
  deferVoiceUtterance?: boolean
}

function voiceNeedsUtterance(): never {
  return bad('utteranceId', 'required', '음성 인식 입력에는 utteranceId 가 필요합니다.')
}

/**
 * #32 본문. `resumePending:true` 면 다른 필드는 보지 않는다.
 * `utteranceId`(음성 발화, task-007): `inputSource` 를 생략하면 `REALTIME_STT` 로 본다. `REALTIME_STT` 인데 없으면 400,
 * `TEXT` 와 함께 오면 400(발화에 묶인 턴은 음성 입력이다 — 인식 결과를 글자로 고쳐 보내도 `REALTIME_STT` + 같은 id + 고친 text).
 * 단 질문 방(ASK)은 반대로 `REALTIME_STT` + `utteranceId` 없음이 정상이다(`ParseTurnOptions.deferVoiceUtterance`).
 * 발화 소유자·미연결·10분 검사와 finalText 갱신은 speech 층 일이라 라우트가 조합한다.
 */
export function parseTurnBody(body: Record<string, unknown>, opts: ParseTurnOptions = {}): TurnRequest {
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
  if (inputSource === 'REALTIME_STT' && !utteranceId && !opts.deferVoiceUtterance) voiceNeedsUtterance()
  if (utteranceId && inputSource === 'TEXT') bad('inputSource', 'REALTIME_STT|SERVER_STT', '음성 발화는 inputSource 가 REALTIME_STT 여야 합니다.')
  if (body.coachRevealed !== undefined && body.coachRevealed !== null && typeof body.coachRevealed !== 'boolean') bad('coachRevealed', 'boolean', 'coachRevealed 형식이 올바르지 않습니다.')
  const scope = parseScope(body.scope)
  return { resume: false, text, inputSource, utteranceId, clientTimings: parseClientTimings(body.clientTimings), coachRevealed: body.coachRevealed === true, ...(scope ? { scope: { key: scope } } : {}) }
}

/**
 * ASK 턴의 입력 모양(task-066) — 라우트(`assertTurnFitsKind`)와 수락 트랜잭션(`acceptTurnTx`)이 같은 규칙을 쓴다.
 *  - `utteranceId` 는 어떤 값이든 거절한다: 질문은 음성 원본·발화 행을 서버에 남기지 않는다(인식된 글자만 `text` 로).
 *  - `inputSource` 는 `TEXT`·`REALTIME_STT` 만. 저장되는 사용자 메시지의 `inputSource` 는 받은 값 그대로다.
 * 끊김 복구(`resumePending`)는 저장된 질문을 다시 돌리므로 검사하지 않는다.
 */
export function assertAskInput(req: TurnRequest): void {
  if (req.resume) return
  if (req.utteranceId) bad('utteranceId', 'notAllowed', '질문에는 음성 발화를 연결할 수 없어요. 인식된 글자만 보내 주세요.')
  if (!(ASK_INPUT_SOURCES as readonly string[]).includes(req.inputSource)) bad('inputSource', ASK_INPUT_SOURCES.join('|'), '질문은 글자나 실시간 음성 인식 결과로만 보낼 수 있어요.')
}

/**
 * #32 종류별 검사(종류는 라우트가 소유 확인과 함께 읽는다 — 본문 검사 뒤, ASK 한도 전).
 * ASK: 글자(`TEXT`)와 실시간 음성 인식 글자(`REALTIME_STT`, `utteranceId` 없이)만 — `assertAskInput`. `scope` 는 ASK 에만.
 * TALK·CHAT: `REALTIME_STT` 는 `utteranceId` 필수 — 본문 검사가 미뤘을 때(`deferVoiceUtterance`) 여기서 같은 400 을 낸다.
 * 끊김 복구(`resumePending`)는 저장된 질문을 다시 돌리므로 검사하지 않는다.
 */
export function assertTurnFitsKind(kind: ChatKind, req: TurnRequest): void {
  if (req.resume) return
  if (kind !== 'ASK') {
    if (req.scope) bad('scope', 'ASK', 'scope 는 질문 방에서만 보낼 수 있어요.')
    if (req.inputSource === 'REALTIME_STT' && !req.utteranceId) voiceNeedsUtterance()
    return
  }
  assertAskInput(req)
}

/**
 * 질문 방(`Chat.kind=ASK`)에서는 쓸 수 없는 호출 — 표현 점검·일본어 도우미·대답 연습·상황 마치기·내 말 번역(계약 §2-18-A 3-A항).
 * AI 비용이 드는 호출을 "화면에 메뉴가 없다"는 이유만으로 열어 두지 않는다. 이미 회화/채팅만 받는 서비스(점검 `CHAT`, 도우미·연습·마치기 `TALK`)는
 * 자기 검사로 거절하고, 종류 검사가 없던 호출(내 말 번역)이 이 가드를 쓴다 — 소유 확인 **뒤**에 불러 남의 방은 그대로 404 로 숨긴다.
 */
export function assertNotAskRoom(kind: ChatKind | null | undefined): void {
  if (kind === 'ASK') bad('chatId', 'kind', '질문 방에서는 쓸 수 없는 기능이에요.')
}
