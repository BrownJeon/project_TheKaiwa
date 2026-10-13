/**
 * 「무엇이든 물어보세요」 화면의 순수 계산(task-064 screens.md §25-3 A logic.ts) — 화면이 고르는 값은 여기서 정하고 시험이 잠근다.
 * 근거 이동 주소는 `askSourceHref` 한 곳에서만 만든다(컴포넌트에서 주소 문자열을 조립하지 않는다).
 */
import type { ChatInfo, ChatMessageView, CreatedChat, ProposalKind, TurnDoneEvent, TurnStage } from '@/types/chat'
import {
  ASK_CONFIDENCES,
  ASK_INTENTS,
  ASK_PROPOSAL_KINDS,
  ASK_SCOPE_KEYS,
  ASK_SOURCE_TYPES,
  type AskConfidence,
  type AskIntent,
  type AskMeta,
  type AskNeedsScope,
  type AskProposalKind,
  type AskRecords,
  type AskScopeKey,
  type AskSource,
  type AskSourceType,
} from '@/types/ask'
import { readStore, writeStore } from '@/components/common/storage'
import { planUrl, monthOf } from '@/components/plan/logic'
import { turnNoticeText, type FailureView } from '@/components/chat/labels'
import type { TurnNoticeState, TurnPhase } from '@/components/chat/useChatTurn'
import { ASK_COPY } from './askCopy'

// ── 저장소 키 ──────────────────────────────────────────────────────────────────

/**
 * 브라우저 저장소 키(읽기·쓰기는 `common/storage` — 예외는 빈 값). 모두 sessionStorage.
 * task-066 에서 `scopeNotice`(보내기 확인 관문)·`draft`(목록 입력 카드)·`pending`(목록 → 방 넘김)은 없앴다 — 남아 있는 값은 아무도 읽지 않는다(§26-2 A).
 */
export const ASK_KEYS = {
  waiting: 'kaiwa.ask.waiting',
  newAnswer: 'kaiwa.ask.newAnswer',
  flash: 'kaiwa.ask.flash',
  /** 질문 탭 입력 모드 `'text'`(기본)·`'voice'` — 회화(`kaiwa.talk.inputMode`)와 따로(§26-7 A). */
  inputMode: 'kaiwa.ask.inputMode',
} as const

export const ASK_ID_SET_MAX = 20

/** 저장된 id 배열(JSON) → 중복 없는 문자열 배열(뒤 20개). 깨진 값은 빈 배열. */
export function parseIdSet(raw: string | null): string[] {
  if (!raw) return []
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(v)) return []
  const out = [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))]
  return out.length > ASK_ID_SET_MAX ? out.slice(out.length - ASK_ID_SET_MAX) : out
}

/** 끝에 더한다(이미 있으면 끝으로 옮김), 20개를 넘으면 앞에서 버린다. */
export function idsAdd(ids: readonly string[], id: string): string[] {
  const out = ids.filter((x) => x !== id)
  out.push(id)
  return out.length > ASK_ID_SET_MAX ? out.slice(out.length - ASK_ID_SET_MAX) : out
}

export function readIds(key: string): string[] {
  return parseIdSet(readStore('session', key))
}

export function addId(key: string, id: string): void {
  writeStore('session', key, JSON.stringify(idsAdd(readIds(key), id)))
}

export function removeId(key: string, id: string): void {
  const ids = readIds(key)
  if (!ids.includes(id)) return
  const next = ids.filter((x) => x !== id)
  writeStore('session', key, next.length ? JSON.stringify(next) : null)
}

// ── 목록 ───────────────────────────────────────────────────────────────────────

/** 질문 방 제목 = 공백·개행을 한 칸으로 접고 앞뒤 공백 제거 → 앞 30 코드포인트(말줄임표 없음 — 서버 규칙과 같은 결과). */
export function askTitleOf(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, 30).join('').trimEnd()
}

export function teacherTitle(name: string): string {
  return name === '선생님' ? '선생님' : `${name} 선생님`
}

/**
 * 목록을 다시 읽었을 때 「새 답」 후보(§25-4 D ②③). `prevRunning` 이 null 이면 첫 읽기(토스트 없음).
 * - `fromWaiting`: 방을 떠날 때 답을 기다리던 방(`kaiwa.ask.waiting`) 중 이제 답하는 중이 아닌 방 — 토스트 없음.
 * - `fromPolling`: 목록이 떠 있는 동안 `running: true → false` 를 본 방 — 토스트 한 번.
 * 후보가 정말 성공한 답인지는 호출하는 쪽이 확인한다(실패한 답에는 「새 답」을 붙이지 않는다 — Leader L-8).
 */
export function arrivedTransitions(
  prevRunning: ReadonlySet<string> | null,
  items: ReadonlyArray<{ id: string; running: boolean }>,
  waiting: ReadonlySet<string>,
): { fromWaiting: string[]; fromPolling: string[]; running: string[] } {
  const fromWaiting = items.filter((c) => !c.running && waiting.has(c.id)).map((c) => c.id)
  const fromPolling = prevRunning ? items.filter((c) => !c.running && prevRunning.has(c.id)).map((c) => c.id) : []
  return { fromWaiting, fromPolling, running: items.filter((c) => c.running).map((c) => c.id) }
}

// ── 근거 ───────────────────────────────────────────────────────────────────────

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * 근거 카드 이동 주소(§25-8 A · 계약 §2-18-A 3항). `id` 가 있으면 유형별 상세, `id:null`(집계 항목)이면 유형별 기본 화면만 —
 * 공부 기록 → 계획표, 복습 → 공부 탭(복습 카드), 그 밖은 null. id 형식이 이상하거나 모르는 유형이면 null(누를 수 없는 카드).
 */
export function askSourceHref(s: Pick<AskSource, 'type' | 'id' | 'date'>): string | null {
  if (s.id === null) return s.type === 'STUDY_LOG' ? '/plan' : s.type === 'REVIEW' ? '/study/today' : null
  if (typeof s.id !== 'string' || !SAFE_ID.test(s.id)) return null
  const id = encodeURIComponent(s.id)
  switch (s.type) {
    case 'CORRECTION':
      return `/drawer/corrections?focus=${id}&n=50`
    case 'LESSON':
      return `/study/today/talk/${id}`
    case 'SCENARIO':
      return `/study/ai/talk/${id}`
    case 'REVIEW':
      return '/study/today'
    case 'EVALUATION':
      return `/study/today/eval/${id}`
    case 'STUDY_LOG':
      return typeof s.date === 'string' && DATE_KEY.test(s.date) ? planUrl(monthOf(s.date), s.date, s.id) : null
    default:
      return null
  }
}

/** ← 머리가 있는 집중 화면으로 가는 근거 — 이때만 「질문으로」 돌아오기 기록을 남긴다(§25-8 B 1). */
export function isAskFocusTarget(type: AskSourceType | null): boolean {
  return type === 'LESSON' || type === 'EVALUATION' || type === 'SCENARIO'
}

// ── 주소 · 대화 수명(§26-3) ─────────────────────────────────────────────────────

/** 대화 id 형식(§25-8 A 와 같음) — `?chat=` 값을 믿기 전에 거른다. */
export function isAskId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ID.test(id)
}

/** 탭 화면에서 시작·복원한 지금 대화의 주소(§26-3 A). */
export function askChatHref(id: string): string {
  return `/ask?chat=${encodeURIComponent(id)}`
}

/**
 * 주소만 바꿔 적는다(기록을 늘리지 않음, 서버 요청 없음). **첫 인자는 반드시 `null`** — 호출 모양이 곧 동작이다.
 * Next 가 패치한 `history.replaceState` 는 `data.__NA`/`data._N` 이 있으면(= `window.history.state` 를 그대로 넘기면) 라우터 동기화를 건너뛰어
 * `useSearchParams`·하단 탭 「질문」 재누름·`router.push/replace('/ask')` 의 비교가 옛 주소에 머문다. `null` 이면 Next 가 내부 state 를 복사하고 동기화한다.
 */
export function replaceAskUrl(h: Pick<History, 'replaceState'>, url: string): void {
  h.replaceState(null, '', url)
}

export type AskConvTransition = 'none' | 'new' | { open: string }

/**
 * 주소 쿼리 `chat` 이 바뀌었을 때 할 일(§26-3 D) — 값이 아니라 **바뀜**만 본다.
 * 생성 직후 `replaceState` 로 `null → id` 가 되는 순간은 `id === convId` 라 `none`(새 대화로 판정하면 보내던 질문이 사라진다).
 * 형식이 잘못된 값은 없는 것(`null`)으로 본다.
 */
export function askConvTransition(prev: string | null, next: string | null, convId: string | null): AskConvTransition {
  const n = isAskId(next) ? next : null
  const p = isAskId(prev) ? prev : null
  if (n === p) return 'none'
  if (n === null) return convId !== null ? 'new' : 'none'
  return n === convId ? 'none' : { open: n }
}

/** 빈 대화에서 첫 질문으로 만든 방을 `AskRoom` 에 넘기는 값(§26-3 C 4) — `used` 는 첫 전송을 한 번만 하게 하는 표지. */
export interface AskSeed {
  chat: ChatInfo
  text: string
  via: AskVia
  used: boolean
}

export type AskVia = 'text' | 'voice'

/** #28 응답 → `AskRoom` 의 대화 정보(§26-3 C 6). */
export function chatInfoOfCreated(c: Pick<CreatedChat, 'id' | 'kind' | 'title' | 'running' | 'messageCount'>): ChatInfo {
  return { id: c.id, kind: c.kind, title: c.title, running: c.running, messageCount: c.messageCount, reviewedAt: null }
}

/**
 * 첫 전송을 할지(§26-3 C 5) — 처음이면 `used` 를 켜고 true, 이미 썼으면 false(그때는 #29 로 읽어 진행 중 턴을 이어받는다).
 * 개발 모드 이중 마운트·빠른 재마운트에서 같은 질문을 두 번 보내지 않게 하는 유일한 장치.
 */
export function takeSeed(seed: AskSeed | null | undefined): boolean {
  if (!seed || seed.used) return false
  seed.used = true
  return true
}

/** 턴 보내기 옵션(§26-5 B) — 말로 물은 질문은 `REALTIME_STT` 만 싣고 **발화 id 는 절대 싣지 않는다**(목소리 미저장, L1). */
export function askSendOptions(via: AskVia): { inputSource?: 'REALTIME_STT' } {
  return via === 'voice' ? { inputSource: 'REALTIME_STT' } : {}
}

// ── 답 구조값 ───────────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** 근거 한 건 — 라벨이 있으면 남긴다. 모르는 유형은 `type:null`(라벨만), 문자열이 아니거나 빈 id 는 `id:null`(집계 항목과 같이 누를 수 없거나 기본 화면). */
function sourceOf(v: unknown): AskSource | null {
  if (!isObj(v)) return null
  const { type, id, date, label } = v
  if (typeof label !== 'string' || !label.trim()) return null
  const known = typeof type === 'string' && (ASK_SOURCE_TYPES as readonly string[]).includes(type)
  return { type: known ? (type as AskSourceType) : null, id: typeof id === 'string' && id !== '' ? id : null, date: str(date), label }
}

function needsScopeOf(v: unknown): AskNeedsScope | null {
  if (!isObj(v)) return null
  const options = (Array.isArray(v.options) ? v.options : [])
    .filter((o): o is Record<string, unknown> => isObj(o))
    .filter((o) => typeof o.key === 'string' && (ASK_SCOPE_KEYS as readonly string[]).includes(o.key) && typeof o.label === 'string' && o.label.trim() !== '')
    .map((o) => ({ key: o.key as AskScopeKey, label: (o.label as string).trim() }))
  return { prompt: str(v.prompt).trim(), options }
}

function recordsOf(v: unknown): AskRecords | null {
  if (!isObj(v)) return null
  if (typeof v.intent !== 'string' || !(ASK_INTENTS as readonly string[]).includes(v.intent)) return null
  if (typeof v.count !== 'number' || !Number.isInteger(v.count) || v.count < 0) return null
  return { intent: v.intent as AskIntent, count: v.count }
}

/** #29 `ask` 객체·#32 `done.conversation` → 검사한 구조값. 객체가 아니면 null(옛 행·모양 이상 — 본문만 그린다). */
export function askMetaOf(v: unknown): AskMeta | null {
  if (!isObj(v)) return null
  const sources = (Array.isArray(v.sources) ? v.sources : []).map(sourceOf).filter((s): s is AskSource => s !== null)
  const confidence: AskConfidence = typeof v.confidence === 'string' && (ASK_CONFIDENCES as readonly string[]).includes(v.confidence) ? (v.confidence as AskConfidence) : 'MEDIUM'
  return { sources, confidence, needsScope: needsScopeOf(v.needsScope), records: recordsOf(v.records) }
}

/** 메시지에 붙은 `ask` 런타임 칸(#29·`askReplyFromDone` 이 넣는다)을 검사해 읽는다. */
export function askOf(m: object): AskMeta | null {
  return askMetaOf((m as { ask?: unknown }).ask)
}

/** ASK 턴 `done` → 강사 말풍선 값: 본문 = `answerMd`, 번역 없음, 구조값은 `ask` 칸(§25-5 A — `useChatTurn` `toReply`). */
export function askReplyFromDone(dn: TurnDoneEvent): Partial<ChatMessageView> & { ask: AskMeta | null } {
  const conv: unknown = dn.conversation
  return {
    content: isObj(conv) ? str(conv.answerMd) : '',
    translation: null,
    status: 'DONE',
    ask: askMetaOf(conv),
  }
}

export interface AskAnswerView {
  lowLine: 'withSources' | 'noSources' | null
  noneLine: boolean
  showSources: boolean
  chips: boolean
  promptExtra: boolean
}

/**
 * 답 묶음에 무엇을 그릴지(§25-5 B). 근거가 비면 근거 영역을 그리지 않고, 칩은 가장 최근 답 · 턴이 쉬는 중에만.
 * 「관련 기록을 못 찾았어요」 줄은 **기록을 실제로 찾아 본 답**에만 — 서버가 규칙으로 즉시 되묻는 답(`needsScope` 가 있고 `records.count:0`)은 아직 조회 전이다.
 */
export function askAnswerView(m: Pick<ChatMessageView, 'content'> & object, opts: { isLast: boolean; idle: boolean }): AskAnswerView {
  const a = askOf(m)
  if (!a) return { lowLine: null, noneLine: false, showSources: false, chips: false, promptExtra: false }
  const ns = a.needsScope
  return {
    lowLine: a.confidence === 'LOW' ? (a.sources.length ? 'withSources' : 'noSources') : null,
    noneLine: !ns && !!a.records && a.records.intent !== 'GENERAL' && a.records.count === 0,
    showSources: a.sources.length > 0,
    chips: !!ns && opts.isLast && opts.idle,
    promptExtra: !!ns && ns.prompt !== '' && !m.content.includes(ns.prompt),
  }
}

export function isAskProposalKind(kind: ProposalKind | string): kind is AskProposalKind {
  return (ASK_PROPOSAL_KINDS as readonly string[]).includes(kind)
}

// ── 대기 ───────────────────────────────────────────────────────────────────────

const STEP_OF: Partial<Record<TurnStage, 0 | 1 | 2>> = { PROMPT: 0, LLM: 1, PARSE: 2 }

/** 대기 카드 상태(§25-5 F). 이어받은 대기(`detached`)는 단계 이벤트가 없어 5초 미만 「질문 살펴보기」, 이후 「답 쓰기」. */
export function askPendingView(stage: TurnStage | null, phase: TurnPhase, sec: number): { step: 0 | 1 | 2; hint: 'h30' | 'h90' | null; showSec: boolean } {
  const mapped = stage ? STEP_OF[stage] : undefined
  const step = mapped ?? (phase === 'detached' && sec >= 5 ? 1 : 0)
  return { step, hint: sec >= 90 ? 'h90' : sec >= 30 ? 'h30' : null, showSec: sec >= 5 }
}

/** 경과 초 기준(ms): 이 화면에서 보낸 턴은 시작 시각, 이어받은 대기는 마지막 내 질문 시각(질문을 보낸 때부터 — 데모 D·list). */
export function askPendingSince(phase: TurnPhase, startedAt: number | null, messages: ReadonlyArray<Pick<ChatMessageView, 'role' | 'createdAt'>>): number | null {
  if (phase === 'detached') {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== 'USER') continue
      const t = Date.parse(messages[i].createdAt)
      if (Number.isFinite(t)) return t
      break
    }
  }
  return startedAt
}

/** 경과 초 — 시계를 아직 모르거나(0) 기준이 없으면 0, 기기 시계가 앞서 음수면 0. */
export function askElapsedSec(now: number, since: number | null): number {
  if (!now || !since) return 0
  return Math.max(0, Math.floor((now - since) / 1000))
}

// ── 안내 줄·실패 ────────────────────────────────────────────────────────────────

/**
 * 입력 바 위 안내 줄 문구(§25-5 G) — `TurnNotice textOf`. 429 는 남은 시간만 말하고 남은 횟수·한도 숫자는 말하지 않는다.
 * 429 갈래는 서버가 준 `reason` 이 우선이다(계약 §2-18-A 3항): 분당 `ASK_RATE`·하루 `ASK_DAILY`·몰림 `ASK_BUSY`.
 * `reason` 이 없거나 모르는 값이면(옛 응답) 처음 받은 `retryAfterSec` 이 3600 을 넘는지로 하루 한도를 추정한다(L-11).
 */
export function askNoticeText(notice: Pick<TurnNoticeState, 'kind' | 'text' | 'retryAfterSec' | 'reason' | 'status'>, remaining: number | null): string {
  if (notice.kind === 'rate') {
    const n = remaining ?? notice.retryAfterSec ?? null
    if (notice.reason === 'ASK_BUSY') return n && n > 0 ? ASK_COPY.askBusy(n) : ASK_COPY.askBusyNoSec
    if (notice.reason === 'ASK_DAILY') return ASK_COPY.rateDay
    if (notice.reason !== 'ASK_RATE' && ((notice.retryAfterSec ?? 0) > 3600 || (n ?? 0) > 3600)) return ASK_COPY.rateDay
    const sec = Math.max(1, n ?? 1)
    return sec > 90 ? ASK_COPY.rateMin(Math.ceil(sec / 60)) : ASK_COPY.rate(sec)
  }
  if (notice.kind === 'notFound') return ASK_COPY.notFoundTitle
  if (notice.status === 0) return ASK_COPY.net
  if (notice.status === 409) return turnNoticeText({ status: 409 })
  return notice.text
}

/** 실패 카드 문구(§25-5 G) — 시간 초과만 따로, 그 밖 코드·이어받은 실패는 「답 불가」. [다시 받기]는 늘 보인다. */
export function askFailureCopy(failure: FailureView | null): { title: string; body: string } {
  return failure?.code === 'ENGINE_TIMEOUT'
    ? { title: ASK_COPY.failTimeout, body: ASK_COPY.failTimeoutBody }
    : { title: ASK_COPY.failUnavail, body: ASK_COPY.failUnavailBody }
}
