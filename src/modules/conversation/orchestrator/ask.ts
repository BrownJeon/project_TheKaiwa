/**
 * ASK 턴(무엇이든 물어보세요 3a, task-064 — api-contract §2-18-A). `startTurn` 이 수락 뒤 `Chat.kind=ASK` 면 이 경로로 돈다.
 *
 * 순서: 수락(index.ts — 사용자 행 + PENDING 강사 행) → `status{PROMPT}` → 이 방의 이력·직전 되묻기·학습자 헤더(병렬) → 규칙 분류(`classifyIntent`)
 *   → [분류가 되묻기면 조회·LLM 없이 서버 고정 문장 + 고정 칩으로 곧장 저장·`done` — Leader 결정 2026-10-12]
 *   → 본인 기록 조회(`retrieveAskRecords`, 세션 userId) → 프롬프트(`buildAskPlan`) → `status{LLM}` → LLM → `status{PARSE}` → `parseAskResponse` + 서버 재검증
 *   → 저장(한 트랜잭션) → 락 해제 → `done`. 규칙이 놓친 모호 질문은 모델의 `needsScope`(범위 출처 DEFAULT 일 때만)가 안전망이다.
 *
 * 서버 재검증(계약 9항 ②): `sources[]` 는 LLM 이 만들지 않는다 — 모델 `sourceKeys` 를 learning `resolveSourceKeys` 로만 풀고(제공 키 ∩ 그 의도에서 부른 함수의 type,
 *  GENERAL 은 항상 []), `needsScope.options` 는 서버 고정 칩, 제안은 3a 허용 종류·페이로드 모양만 남긴다. 학습자가 이미 범위를 골랐거나 질문에 기간이 있는데
 *  모델이 되물으면 계약 위반으로 1회 재시도한다(되묻기 반복 방지).
 * 끊김(§2-18-A 3): 클라이언트 연결과 무관하게 끝까지 돈다 — 요청 취소 신호를 받지 않는다. 대신 서버 예산(`ASK_TURN_BUDGET_MS`)을 넘기면 LLM 을 끊는다:
 *  ASK LLM 은 120s 이고 JSON 재시도가 붙으면 그 두 배가 될 수 있어, 다른 인스턴스가 180s 넘은 PENDING 을 죽은 턴으로 정리(locks.ts)하기 전에 끝나게 한다.
 * 기록(계약 7항): 질문·조회 본문·답 본문은 Trace·toolLog·로그에 싣지 않는다 — 의도·건수·단계 시간·모델 티어 정보만. `toolLog.ask.sources[].label` 만 예외(표시용 ≤60자).
 */
import { Prisma, type InputSource, type JlptLevel } from '@prisma/client'
import { ApiError, classifyError, dates, lockUserRow, prisma, toPreview, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { llm, recordTrace, type LlmJsonRequest, type LlmJsonResult, type TraceStep } from '@/modules/engine'
import { isAskScopeKey, resolveSourceKeys, type AskScopeKey, type RecordSourceType, type RetrievalResult } from '@/modules/learning'
import { classifiedQuestion, classifyIntent, retrieveAskRecords, type AskClassification } from '../askRouter'
import { AskInputError, askParseTrace, buildAskPlan, parseAskResponse, sanitizeAskAnswerMd, type AskConfidence, type AskInputKind, type AskIntent, type AskResponse, type AskScope, type AskScopeSource } from '../prompts/ask'
import { JLPT_LEVELS } from '../structuredResponse/schemas'
import { buildLearnerHeader } from '../turnContext'
import type { WindowMessage } from '../window'
import { proposalExpiresAt } from '../proposals'
import { releaseTurnLock, type TurnLock } from './locks'
import { isRetryableTurnError, turnErrorMessage } from './shape'
import type { TurnStream } from './stream'

/** #28 생성 기본 제목 — 이 값이면 첫 답 저장 트랜잭션에서 첫 질문 앞 30자로 바꾼다(계약 1항). */
export const ASK_DEFAULT_TITLE = '새 질문'
export const ASK_TITLE_MAX = 30
export const ASK_PREVIEW_MAX = 60
export const ASK_SOURCE_LABEL_MAX = 60
/** 서버 쪽 전체 예산 — `STALE_PENDING_MS`(180s)보다 짧다. */
export const ASK_TURN_BUDGET_MS = 170_000
export const ASK_ANSWER_MAX = 4_000

export const ASK_SCOPE_OPTIONS: readonly { key: AskScopeKey; label: string }[] = [
  { key: 'THIS_WEEK', label: '이번 주' },
  { key: 'LAST_30D', label: '지난 30일' },
  { key: 'ALL', label: '전체 기간' },
]
/** 분류가 되묻기로 판정했을 때 서버가 쓰는 문장(LLM 없이) — `answerMd` 와 `needsScope.prompt` 가 같은 문장(Leader 결정 2026-10-12). */
export const ASK_SCOPE_SENTENCES = {
  PROGRESS: '어느 기간의 공부 기록을 볼까요? 고르신 기간으로 찾아볼게요.',
  EXPRESSION: '어느 기간의 교정을 볼까요? 고르신 기간에 채택한 교정에서 찾아볼게요.',
} as const
const EXPRESSION_CUE = /교정|고쳐|고친|틀린|틀렸|틀리|틀려|실수|표현|배운|배웠|외운|외웠/

/** 의도별 되묻기 문장. PROGRESS·EXPRESSION 이 아니면(MIXED) 질문 글에 교정·표현 쪽 말이 있으면 교정 문장, 아니면 공부 기록 문장. */
export function askScopeSentence(intent: AskIntent, questionText: string): string {
  if (intent === 'PROGRESS' || intent === 'EXPRESSION') return ASK_SCOPE_SENTENCES[intent]
  return EXPRESSION_CUE.test(questionText.replace(/\s/g, '')) ? ASK_SCOPE_SENTENCES.EXPRESSION : ASK_SCOPE_SENTENCES.PROGRESS
}

const ASK_PROPOSAL_KINDS = ['ADD_WORD', 'ADD_STUDY_LOG', 'SET_LEVEL'] as const
type AskProposalKind = (typeof ASK_PROPOSAL_KINDS)[number]

export interface AskSourceDto {
  type: RecordSourceType
  id: string | null
  date: string
  label: string
}
export interface AskNeedsScopeDto {
  prompt: string
  options: { key: AskScopeKey; label: string }[]
}
export interface AskRecordsDto {
  intent: AskIntent
  count: number
}
/** `toolLog.ask` = #29 ASK 강사 메시지의 `ask` 객체 = `done.conversation` 의 구조화 칸. */
export interface AskMetaDto {
  sources: AskSourceDto[]
  confidence: AskConfidence
  needsScope: AskNeedsScopeDto | null
  records: AskRecordsDto
}

export interface AskProposalOut {
  kind: AskProposalKind
  payload: Record<string, string>
}

/** 저장·`done` 재료(서버 재검증을 마친 값). */
export interface AskTurnOutput {
  answerMd: string
  meta: AskMetaDto
  proposals: AskProposalOut[]
}

/** index.ts `AcceptedTurn` 의 ASK 가 쓰는 부분(구조적 — 순환 import 를 피한다). */
export interface AskAcceptedTurn {
  chatId: string
  level: JlptLevel | null
  /** `inputSource` 는 저장된 사용자 행의 값 — 끊김 복구(resume)도 처음 질문의 입력 방식을 그대로 따른다(없으면 글자로 본다). */
  userMessage: { id: string; content: string; createdAt: Date; inputSource?: InputSource | null }
  assistantMessageId: string
  pendingSince: Date
  traceId: string
  resumed: boolean
}

/** ASK `ChatMessage.toolLog` — 측정 숫자·짧은 식별자 + `ask`. 질문·조회 본문·답 본문은 없다. */
export interface AskToolLog {
  traceId: string
  /** LLM 없이 서버가 되물었으면 null. */
  model: string | null
  connection: string | null
  llmMs: number | null
  promptChars: number
  attempt: number
  totalMs: number
  /** 조회를 하지 않았으면(규칙 되묻기) null. */
  scopeKey: AskScopeKey | null
  scopeSource: AskScopeSource | null
  /** 규칙 분류가 되묻기라 조회·LLM 없이 서버가 답했으면 `NEEDS_SCOPE`. */
  shortCircuit: 'NEEDS_SCOPE' | null
  ask: AskMetaDto
}

// ── 순수 도구 ─────────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const SOURCE_TYPES: readonly string[] = ['LESSON', 'CORRECTION', 'SCENARIO', 'REVIEW', 'STUDY_LOG', 'EVALUATION']
const INTENTS: readonly string[] = ['PROGRESS', 'EXPRESSION', 'GENERAL', 'MIXED']
const CONFIDENCES: readonly string[] = ['HIGH', 'MEDIUM', 'LOW']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 저장된 `toolLog` → `ask` 객체(모양이 어긋나면 null). #29 DTO·직전 되묻기 판정이 같은 함수를 쓴다. */
export function askMetaFromToolLog(toolLog: unknown): AskMetaDto | null {
  if (!isObj(toolLog) || !isObj(toolLog.ask)) return null
  const a = toolLog.ask
  if (typeof a.confidence !== 'string' || !CONFIDENCES.includes(a.confidence)) return null
  if (!Array.isArray(a.sources) || !isObj(a.records)) return null
  const r = a.records
  if (typeof r.intent !== 'string' || !INTENTS.includes(r.intent) || typeof r.count !== 'number' || !Number.isInteger(r.count) || r.count < 0) return null
  const sources: AskSourceDto[] = []
  for (const s of a.sources) {
    if (!isObj(s) || typeof s.type !== 'string' || !SOURCE_TYPES.includes(s.type)) continue
    if (!(s.id === null || typeof s.id === 'string') || typeof s.date !== 'string' || !DATE_RE.test(s.date) || typeof s.label !== 'string') continue
    sources.push({ type: s.type as RecordSourceType, id: s.id, date: s.date, label: truncateCodePoints(s.label, ASK_SOURCE_LABEL_MAX) })
  }
  let needsScope: AskNeedsScopeDto | null = null
  if (isObj(a.needsScope) && typeof a.needsScope.prompt === 'string') {
    needsScope = { prompt: a.needsScope.prompt, options: ASK_SCOPE_OPTIONS.map((o) => ({ ...o })) }
  }
  return { sources, confidence: a.confidence as AskConfidence, needsScope, records: { intent: r.intent as AskIntent, count: r.count } }
}

export interface AskPrevRow {
  role: 'USER' | 'ASSISTANT'
  status: string
  content: string
  toolLog: unknown
}
export interface AskPrevContext {
  /** 직전 강사 답이 되물었는가(그때만 요청 `scope` 를 쓴다). */
  needsScope: boolean
  /** 그 되묻기 앞의 학습자 질문 — 되묻기가 없으면 null. */
  prevUserText: string | null
}

/** 이번 사용자 메시지 **바로 앞 두 행**(최근 → 과거)으로 직전 되묻기를 판정한다. */
export function askPrevFrom(rows: readonly AskPrevRow[]): AskPrevContext {
  const [asst, user] = rows
  if (!asst || asst.role !== 'ASSISTANT' || asst.status !== 'DONE' || !askMetaFromToolLog(asst.toolLog)?.needsScope) return { needsScope: false, prevUserText: null }
  return { needsScope: true, prevUserText: user && user.role === 'USER' && user.content.trim() ? user.content : null }
}

/** 요청 `scope.key` 는 직전 답이 되물었을 때만 쓴다(계약 3항). 그 밖·형식 밖 값은 무시. */
export function askScopeKeyFor(prev: AskPrevContext, requested: unknown): AskScopeKey | undefined {
  return prev.needsScope && isAskScopeKey(requested) ? requested : undefined
}

/** 범위의 KST 날짜 — learning `resolveRange` 와 같은 규칙(이번 주 = 일~토 `dates.weekStartOf`, 지난 30일 = 오늘 포함 30일, 전체 = 없음). */
export function askScopeDates(key: AskScopeKey, todayKst: string): { fromKst: string | null; toKst: string | null } {
  if (key === 'THIS_WEEK') {
    const from = dates.weekStartOf(todayKst)
    return { fromKst: from, toKst: dates.addDays(from, 6) }
  }
  if (key === 'LAST_30D') return { fromKst: dates.addDays(todayKst, -29), toKst: todayKst }
  return { fromKst: null, toKst: null }
}

/** 프롬프트 `[기록 조회]` 범위 — 실제 조회 범위 + 출처(칩·질문의 기간·기본). DEFAULT 일 때만 모델이 되물을 수 있다. */
export function askPromptScope(c: AskClassification, chipKey: AskScopeKey | undefined, r: Pick<RetrievalResult, 'meta'>, todayKst: string): AskScope {
  const source: AskScopeSource = c.scope ? (chipKey && c.scope.key === chipKey ? 'CHIP' : 'QUESTION') : 'DEFAULT'
  return { key: r.meta.scopeKey, ...askScopeDates(r.meta.scopeKey, todayKst), source }
}

const MD_LINE_HEAD = /^\s*(?:>\s*|[-*+]\s+|\d{1,2}[.)]\s+|#{1,6}\s+)+/

/** 마크다운 한 줄 → 평문(목록·인용·제목 머리, 굵게·기울임·코드 표지 제거). */
function plainMdLine(line: string): string {
  return line
    .replace(MD_LINE_HEAD, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|[^\p{L}\p{N}])[*_]([^*_\s][^*_]*?)[*_](?=$|[^\p{L}\p{N}])/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 목록 미리보기(계약 2항) — 답 첫 줄 평문 ≤60자. 평문이 남지 않으면 `fallback`(질문). */
export function askAnswerPreview(answerMd: string, fallback: string): string {
  for (const raw of answerMd.split('\n')) {
    const line = plainMdLine(raw)
    if (line) return toPreview(line, ASK_PREVIEW_MAX)
  }
  return askQuestionPreview(fallback)
}

export function askQuestionPreview(text: string): string {
  return toPreview(text, ASK_PREVIEW_MAX)
}

/** 첫 질문 → 방 제목(앞 30자, 공백·개행 정리). */
export function askTitleFrom(text: string): string {
  return toPreview(text, ASK_TITLE_MAX)
}

const WORD_LIMITS = { surface: 80, reading: 120, meaning: 200 } as const
const STUDY_LOG_SUMMARY_MAX = 120
const shortStr = (v: unknown, max: number, required: boolean): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (required && !t) return null
  return Array.from(t).length <= max ? t : null
}

/**
 * 제안 서버 재검증(계약 9항 ②) — 3a 허용 종류(`ADD_WORD`·`ADD_STUDY_LOG`·`SET_LEVEL`)와 기존 채택 경로(`proposals.acceptProposal`)가 읽는 페이로드 모양만 남긴다.
 * `ADD_TOPIC`·`SCHEDULE_REVIEW`·모양이 어긋난 항목은 버린다. 최대 3개.
 */
export function askAllowedProposals(list: readonly unknown[]): AskProposalOut[] {
  const out: AskProposalOut[] = []
  for (const item of list) {
    if (out.length >= 3) break
    if (!isObj(item) || !isObj(item.payload) || typeof item.kind !== 'string' || !(ASK_PROPOSAL_KINDS as readonly string[]).includes(item.kind)) continue
    const p = item.payload
    if (item.kind === 'ADD_WORD') {
      const surface = shortStr(p.surface, WORD_LIMITS.surface, true)
      const reading = shortStr(p.reading ?? '', WORD_LIMITS.reading, false)
      const meaning = shortStr(p.meaning, WORD_LIMITS.meaning, true)
      if (surface !== null && reading !== null && meaning !== null) out.push({ kind: 'ADD_WORD', payload: { surface, reading, meaning } })
    } else if (item.kind === 'ADD_STUDY_LOG') {
      const summaryKo = shortStr(p.summaryKo, STUDY_LOG_SUMMARY_MAX, true)
      if (summaryKo !== null) out.push({ kind: 'ADD_STUDY_LOG', payload: { summaryKo } })
    } else if (item.kind === 'SET_LEVEL' && typeof p.level === 'string' && (JLPT_LEVELS as readonly string[]).includes(p.level)) {
      out.push({ kind: 'SET_LEVEL', payload: { level: p.level } })
    }
  }
  return out
}

/** 학습자가 범위를 이미 정한 턴(칩·질문의 기간)에서 모델이 되물으면 계약 위반 — 1회 재시도. */
const SCOPE_ALREADY_SET_VIOLATION = 'needsScope 는 null 이어야 한다 — 학습자가 이미 기간을 정했다([기록 조회]의 범위로 바로 답한다)'
export function withScopeGuard(req: LlmJsonRequest<AskResponse>, scope: AskScope): LlmJsonRequest<AskResponse> {
  if ((scope.source ?? 'DEFAULT') === 'DEFAULT') return req
  const base = req.extraCheck
  return {
    ...req,
    extraCheck: (data, info) => {
      const v = base ? base(data, info) : []
      const ns = isObj(data) ? data.needsScope : null
      return ns !== null && ns !== undefined ? [...v, SCOPE_ALREADY_SET_VIOLATION] : v
    },
  }
}

// ── DB ────────────────────────────────────────────────────────────────────────

type AskReadDb = Pick<Tx, 'chatMessage'>
const beforeWhere = (b: { id: string; createdAt: Date }) => ({ OR: [{ createdAt: { lt: b.createdAt } }, { createdAt: b.createdAt, id: { lt: b.id } }] })

/** 이 방의 앞선 질문·답(DONE)만 — 다른 회화·채팅 내용은 읽지 않는다(외부 전송 범위 D2 ①). 빌더가 12개·8,000자로 줄인다. */
export async function loadAskHistory(userId: string, chatId: string, before: { id: string; createdAt: Date }, db: AskReadDb = prisma): Promise<WindowMessage[]> {
  const rows = await db.chatMessage.findMany({
    where: { chatId, userId, status: 'DONE', ...beforeWhere(before) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30,
    select: { role: true, content: true },
  })
  return rows
    .reverse()
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content }))
}

export async function loadAskPrev(userId: string, chatId: string, before: { id: string; createdAt: Date }, db: AskReadDb = prisma): Promise<AskPrevContext> {
  const rows = await db.chatMessage.findMany({
    where: { chatId, userId, ...beforeWhere(before) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 2,
    select: { role: true, status: true, content: true, toolLog: true },
  })
  return askPrevFrom(rows as AskPrevRow[])
}

export interface SavedAskProposal {
  id: string
  kind: AskProposalKind
  payload: Record<string, string>
  status: 'PROPOSED'
  messageId: string
}

/** 저장 트랜잭션 본문 — 잠금 순서(사용자 → 행)·조건부 DONE·제안 PROPOSED·미리보기·기본 제목. 단위 시험이 가짜 tx 로 쓰기를 확인한다. */
export async function saveAskTurnTx(tx: Tx, userId: string, a: AskAcceptedTurn, out: AskTurnOutput, toolLog: AskToolLog): Promise<{ proposals: SavedAskProposal[] }> {
  await lockUserRow(tx, userId)
  const res = await tx.chatMessage.updateMany({
    where: { id: a.assistantMessageId, status: 'PENDING', createdAt: a.pendingSince },
    data: { status: 'DONE', content: out.answerMd, reading: null, translation: null, toolLog: toolLog as unknown as Prisma.InputJsonValue, traceId: a.traceId },
  })
  if (res.count === 0) throw new ApiError('CONFLICT', '대화가 바뀌어 답을 저장하지 못했어요.')
  const expiresAt = proposalExpiresAt()
  const proposals: SavedAskProposal[] = []
  for (const p of out.proposals) {
    const row = await tx.tutorProposal.create({
      data: { userId, chatId: a.chatId, messageId: a.assistantMessageId, kind: p.kind, payload: p.payload, expiresAt },
      select: { id: true },
    })
    proposals.push({ id: row.id, kind: p.kind, payload: p.payload, status: 'PROPOSED', messageId: a.assistantMessageId })
  }
  const chat = await tx.chat.findFirst({ where: { id: a.chatId, userId }, select: { title: true } })
  await tx.chat.updateMany({ where: { id: a.chatId, userId }, data: { lastMessageAt: new Date(), preview: askAnswerPreview(out.answerMd, a.userMessage.content) } })
  if (chat?.title === ASK_DEFAULT_TITLE) {
    const first = await tx.chatMessage.findFirst({ where: { chatId: a.chatId, userId, role: 'USER' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { content: true } })
    const title = askTitleFrom(first?.content ?? a.userMessage.content)
    // 조건부 — 읽은 뒤 사용자가 이름을 바꿨으면(#30) 덮지 않는다.
    if (title) await tx.chat.updateMany({ where: { id: a.chatId, userId, title: ASK_DEFAULT_TITLE }, data: { title } })
  }
  return { proposals }
}

async function markAskFailed(a: AskAcceptedTurn, errorCode: string): Promise<void> {
  try {
    await prisma.chatMessage.updateMany({ where: { id: a.assistantMessageId, status: 'PENDING', createdAt: a.pendingSince }, data: { status: 'FAILED', toolLog: { traceId: a.traceId, errorCode } } })
  } catch (e) {
    console.error('[ask] FAILED 기록 실패:', e instanceof Error ? e.name : 'unknown')
  }
}

/** ASK 경로의 DB·LLM 의존 — 단위 시험은 `mock.method(askTurnDeps, …)` 로 바꿔 공유 DB·실제 LLM 없이 돈다. */
export const askTurnDeps = {
  buildLearnerHeader,
  loadAskHistory: (userId: string, chatId: string, before: { id: string; createdAt: Date }) => loadAskHistory(userId, chatId, before),
  loadAskPrev: (userId: string, chatId: string, before: { id: string; createdAt: Date }) => loadAskPrev(userId, chatId, before),
  retrieveAskRecords: (userId: string, c: AskClassification, questionText: string): Promise<RetrievalResult> => retrieveAskRecords(userId, c, questionText),
  completeJson: <T>(req: LlmJsonRequest<T>): Promise<LlmJsonResult<T>> => llm.completeJson<T>(req),
  saveAskTurn: (userId: string, a: AskAcceptedTurn, out: AskTurnOutput, toolLog: AskToolLog) => withTransaction((tx) => saveAskTurnTx(tx, userId, a, out, toolLog)),
  markFailed: markAskFailed,
  recordTrace,
  todayKst: (): string => dates.todayKst(),
  budgetMs: (): number => ASK_TURN_BUDGET_MS,
}

// ── 턴 처리 ───────────────────────────────────────────────────────────────────

export interface AskProcessInput {
  userId: string
  a: AskAcceptedTurn
  lock: TurnLock
  stream: TurnStream
  elapsed: () => number
  acceptMs: number
  /** #32 `scope.key`(끊김 복구는 없음) — 직전 되묻기가 있을 때만 쓴다. */
  scopeKey: unknown
}

/** 예산 안에서 LLM 을 부른다. 예산을 넘기면 LLM 을 끊고 `ENGINE_TIMEOUT`. 요청 연결의 취소 신호는 받지 않는다. */
async function completeWithinBudget(req: LlmJsonRequest<AskResponse>): Promise<LlmJsonResult<AskResponse>> {
  const ac = new AbortController()
  let overBudget = false
  const timer = setTimeout(() => {
    overBudget = true
    ac.abort()
  }, askTurnDeps.budgetMs())
  try {
    return await askTurnDeps.completeJson<AskResponse>({ ...req, signal: ac.signal })
  } catch (e) {
    if (overBudget) throw new ApiError('ENGINE_TIMEOUT', '답이 늦어져 멈췄어요.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** 규칙 되묻기(LLM·조회 없음) 출력 — 고정 문장·고정 칩, MEDIUM, 근거·제안 없음, `records.count` 0. */
export function routerScopeOutput(intent: AskIntent, questionText: string): AskTurnOutput {
  const sentence = askScopeSentence(intent, questionText)
  return {
    answerMd: sentence,
    meta: { sources: [], confidence: 'MEDIUM', needsScope: { prompt: sentence, options: ASK_SCOPE_OPTIONS.map((o) => ({ ...o })) }, records: { intent, count: 0 } },
    proposals: [],
  }
}

/** 저장 직전 살균 한 번 더(멱등) + 상한 확인(계약 8항 — PE 정리와 별개의 서버 방어선). */
export function finalizeAnswerMd(md: string): string {
  const text = sanitizeAskAnswerMd(md).text
  if (!text || Array.from(text).length > ASK_ANSWER_MAX) throw new ApiError('ENGINE_ERROR', '답을 만들지 못했어요.')
  return text
}

/**
 * 저장된 사용자 행의 입력 방식 → 프롬프트의 입력 종류. 실시간 음성 인식이 만든 글(`REALTIME_STT`)만 `VOICE`(인식 글이라 문장부호 없음·오인식 가능 표지),
 * 그 밖은 `TEXT`. 질문 본문은 어느 쪽이든 같은 파이프라인(분류·조회·한도·살균·저장)을 탄다.
 */
export function askInputKindOf(inputSource: InputSource | null | undefined): AskInputKind {
  return inputSource === 'REALTIME_STT' ? 'VOICE' : 'TEXT'
}

export async function processAskTurn(p: AskProcessInput): Promise<void> {
  const { userId, a, stream, elapsed } = p
  const steps: TraceStep[] = [{ name: 'ACCEPT', ms: p.acceptMs, kind: 'ASK' }]
  let released = false
  const release = () => {
    if (released) return
    released = true
    releaseTurnLock(p.lock)
  }
  let trace: { status: 'OK' | 'ERROR'; errorCode: string | null } = { status: 'OK', errorCode: null }
  try {
    stream.emit({ event: 'status', data: { stage: 'PROMPT', elapsedMs: elapsed() } })
    let t = Date.now()
    const text = a.userMessage.content
    const inputKind = askInputKindOf(a.userMessage.inputSource)
    const [header, history, prev] = await Promise.all([
      askTurnDeps.buildLearnerHeader(userId, a.level),
      askTurnDeps.loadAskHistory(userId, a.chatId, a.userMessage),
      askTurnDeps.loadAskPrev(userId, a.chatId, a.userMessage),
    ])
    const chipKey = askScopeKeyFor(prev, p.scopeKey)
    const prevUserText = prev.prevUserText ?? undefined
    const c = classifyIntent(text, { prevUserText, scopeKey: chipKey })
    const question = classifiedQuestion(c, text, prevUserText)

    let out: AskTurnOutput
    let llmInfo: { model: string; connection: string; llmMs: number; promptChars: number; attempt: number } | null = null
    let scope: AskScope | null = null
    if (c.needsScope) {
      // 규칙 분류가 「범위에 민감한 기록 질문인데 기간 없음」으로 판정 — 조회·LLM 없이 서버가 곧장 되묻는다(PROMPT 뒤 바로 done).
      steps.push({ name: 'PROMPT', ms: Date.now() - t, intent: c.intent, shortCircuit: 'NEEDS_SCOPE', prevNeedsScope: prev.needsScope, inputKind })
      out = routerScopeOutput(c.intent, question)
    } else {
      const tr = Date.now()
      const r = await askTurnDeps.retrieveAskRecords(userId, c, question)
      steps.push({ name: 'RETRIEVE', ms: Date.now() - tr, intent: c.intent, count: r.meta.count, functions: r.meta.functionsCalled.length, truncated: r.meta.truncated, scopeKey: r.meta.scopeKey })
      const todayKst = askTurnDeps.todayKst()
      scope = askPromptScope(c, chipKey, r, todayKst)
      // GENERAL 은 조회하지 않는 의도다 — 조회 결과가 무엇이든 건수 0(근거도 resolveSourceKeys 가 [] 로 막는다).
      const records: AskRecordsDto = { intent: c.intent, count: c.intent === 'GENERAL' ? 0 : r.meta.count }
      let plan
      try {
        plan = buildAskPlan({ todayKst, header, userText: text, window: history, records: r.items, intent: c.intent, scope, inputKind })
      } catch (e) {
        if (e instanceof AskInputError) throw new ApiError('VALIDATION', '질문을 확인해 주세요.')
        throw e
      }
      steps.push({
        name: 'PROMPT',
        ms: Date.now() - t,
        scopeSource: scope.source ?? 'DEFAULT',
        prevNeedsScope: prev.needsScope,
        inputKind: plan.inputKind,
        shownKeys: plan.shownKeys.length,
        recordChars: plan.recordsFit.chars,
        windowMessages: history.length,
      })
      const startAt = elapsed()
      stream.emit({ event: 'status', data: { stage: 'LLM', elapsedMs: startAt } })
      const res = await completeWithinBudget({ ...withScopeGuard(plan.request, scope), traceId: a.traceId })
      const llmMs = elapsed() - startAt
      llmInfo = { model: res.model, connection: res.connectionKey, llmMs, promptChars: res.promptChars, attempt: res.attempts ?? 1 }
      steps.push({ name: 'LLM', ms: llmMs, startMs: startAt, connection: res.connectionKey, model: res.model, attempts: res.attempts ?? 1, promptChars: res.promptChars, warm: res.warm ?? null })
      stream.emit({ event: 'status', data: { stage: 'PARSE', elapsedMs: elapsed() } })
      t = Date.now()
      const parsed = parseAskResponse(res.data, { shownKeys: plan.shownKeys, userText: text })
      if (!parsed.ok) throw new ApiError('ENGINE_ERROR', '답을 만들지 못했어요.')
      const v = parsed.value
      const sources = resolveSourceKeys(r, v.sourceKeys).map((s) => ({ ...s, label: truncateCodePoints(s.label, ASK_SOURCE_LABEL_MAX) }))
      const needsScope = v.needsScope ? { prompt: v.needsScope.prompt, options: ASK_SCOPE_OPTIONS.map((o) => ({ ...o })) } : null
      out = { answerMd: finalizeAnswerMd(v.answerMd), meta: { sources, confidence: v.confidence, needsScope, records }, proposals: needsScope ? [] : askAllowedProposals(v.proposals) }
      steps.push({ name: 'PARSE', ms: Date.now() - t, ...askParseTrace(v), sources: sources.length, proposalsKept: out.proposals.length })
    }

    t = Date.now()
    const toolLog: AskToolLog = {
      traceId: a.traceId,
      model: llmInfo?.model ?? null,
      connection: llmInfo?.connection ?? null,
      llmMs: llmInfo?.llmMs ?? null,
      promptChars: llmInfo?.promptChars ?? 0,
      attempt: llmInfo?.attempt ?? 0,
      totalMs: elapsed(),
      scopeKey: scope?.key ?? null,
      scopeSource: scope ? (scope.source ?? 'DEFAULT') : null,
      shortCircuit: c.needsScope ? 'NEEDS_SCOPE' : null,
      ask: out.meta,
    }
    const saved = await askTurnDeps.saveAskTurn(userId, a, out, toolLog)
    steps.push({ name: 'SAVE', ms: Date.now() - t })
    release()
    stream.emit({
      event: 'done',
      data: {
        userMessageId: a.userMessage.id,
        assistantMessageId: a.assistantMessageId,
        conversation: { answerMd: out.answerMd, replyKo: null, ...out.meta },
        correction: null,
        proposals: saved.proposals,
        audioCount: 0,
        traceId: a.traceId,
      },
    })
  } catch (e) {
    const c = classifyError(e)
    // 원문(질문·답·조회 본문)이 섞일 수 있는 오류 메시지는 남기지 않는다 — 이름과 코드만.
    if (c.code === 'INTERNAL') console.error('[ask] 처리 실패:', e instanceof Error ? e.name : 'unknown')
    trace = { status: 'ERROR', errorCode: c.code }
    await askTurnDeps.markFailed(a, c.code)
    release()
    stream.emit({ event: 'error', data: { code: c.code, message: turnErrorMessage(c.code), traceId: a.traceId, retryable: isRetryableTurnError(c.code) } })
  } finally {
    release()
    stream.finish()
  }
  await askTurnDeps
    .recordTrace({ traceId: a.traceId, kind: 'TURN', userId, status: trace.status, steps, totalMs: elapsed(), errorCode: trace.errorCode, refType: 'chatMessage', refId: a.assistantMessageId })
    .catch(() => undefined)
}
