/**
 * A11 복습 판단(REVIEW_DECISION) — design-spec §7-4·§8 A11, learning-personalization §2-5, tutor.md §6 REVIEW_DECISION
 * 행·§7 복습 규칙, task-010b Leader's Plan L2. sonnet·60s·잡(batch) — 5초 예산이 아니라 완료 트랜잭션 뒤 비동기로
 * 도는 지점이라 TALK 만큼 짧게 쥐어짤 필요는 없지만, 후보 ≤40건을 ≤4,000자 블록에 담아야 하는 제약은 있다
 * (design-spec §8 A11 입력란). 헤더는 다른 배치 지점(A9·A8·A11)과 같은 ≤600자.
 *
 * 범위 강제(3~7일·FOCUS ≤3일)·id 유효성·누락 항목 폴백은 이 파일이 아니라 `structuredResponse/reviewRepair.ts` 의
 * `normalizeReviewDecision`(LLM 응답을 받은 뒤 호출자가 부르는 결정적 보정)이 한다 — 이 파일의 책임은 프롬프트
 * 구성과, 재시도가 필요한 위반(엔진명 노출)만 잡는 `extraCheck` 연결까지다.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkReviewDecisionResponse } from '../structuredResponse/reviewChecks'
import { REVIEW_DECISION_MAX_ITEMS, REVIEW_DECISION_SCHEMA, type ReviewDecisionResponse, type ReviewPriority } from '../structuredResponse/reviewSchemas'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const REVIEW_DECISION_PROMPT_VERSION = 'reviewDecision@v1'
export const REVIEW_DECISION_HEADER_CAP = 600
/** design-spec §8 A11 "≤40건·≤4,000자" — 후보 블록 전용 상한(헤더·관측 요약과 별개). */
export const REVIEW_DECISION_CANDIDATES_MAX_CHARS = 4_000
export const REVIEW_DECISION_MAX_CANDIDATES = REVIEW_DECISION_MAX_ITEMS

/** 학습자 헤더 뒤에 붙는 축별 성공/실패 요약 한 줄 상한(5개 축 고정, learning-personalization §2-3). */
const OBSERVATION_LINE_MAX_SKILLS = 5
/** `LearnerErrorStat` top5(design-spec §8 A11 입력란). */
const ERROR_STAT_TOP = 5
const RENDER_MAX = { textJa: 40, meaningKo: 40 } as const

export interface ReviewDecisionCandidateInput {
  itemId: string
  itemType: 'EXPRESSION' | 'CHUNK' | 'GRAMMAR' | 'SCENARIO' | 'WORD' | 'LESSON'
  textJa: string
  meaningKo?: string | null
  studiedCount: number
  correctCount: number
  wrongCount: number
  feedbackCount: number
  /** `YYYY-MM-DD` 또는 null(학습한 적 없음 — 신규 등록 직후는 없다). */
  lastStudiedAt?: string | null
  /** 갱신 전 현재 간격(일) — 폴백 근거로 그대로 넘겨 `normalizeReviewDecision` 에 쓴다(이 파일은 그대로 통과만 시킨다). */
  intervalDays: number
  priority: ReviewPriority
}

/** 축별 성공/실패 수(원문 없음, 코드 집계 — learning-personalization §2-3 5축). */
export interface ReviewDecisionObservationSummary {
  skill: 'VOCAB_RECALL' | 'GRAMMAR_PARTICLE' | 'LISTEN_RESPOND' | 'SENTENCE_PRODUCTION' | 'CONVERSATION_MAINTAIN'
  success: number
  fail: number
}

export interface ReviewDecisionErrorStat {
  type: string
  count: number
}

export interface ReviewDecisionInput {
  todayKst: string
  learner: LearnerHeader
  /** due·후보 `RepetitionItem`(발신 전 caller 가 nextDueAt·FOCUS·오답 순으로 정렬해 넘긴다 — 앞에서부터 우선 유지). */
  candidates: ReviewDecisionCandidateInput[]
  observationSummary?: ReviewDecisionObservationSummary[]
  errorStats?: ReviewDecisionErrorStat[]
}

export class ReviewDecisionInputError extends Error {
  readonly userMessage = '복습을 판단할 재료가 없어요.'
  constructor(message: string) {
    super(message)
    this.name = 'ReviewDecisionInputError'
  }
}

export interface ReviewDecisionRequest extends LlmJsonRequest<ReviewDecisionResponse> {
  /** 실제로 프롬프트에 실은(트리밍 후) 후보 id — `normalizeReviewDecision` 의 후보 풀을 만들 때 이 순서·집합을 그대로 쓴다. */
  keptItemIds: string[]
  /** `REVIEW_DECISION_MAX_CANDIDATES`·`REVIEW_DECISION_CANDIDATES_MAX_CHARS` 때문에 뺀 후보 수(뒤에서부터, 우선순위가 낮은 쪽). */
  skippedCandidates: number
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

function renderCandidateLine(c: ReviewDecisionCandidateInput): string {
  const text = clip(c.textJa, RENDER_MAX.textJa)
  const meaning = c.meaningKo ? ` — ${clip(c.meaningKo, RENDER_MAX.meaningKo)}` : ''
  const last = c.lastStudiedAt ? `최근 ${c.lastStudiedAt}` : '최근 학습 없음'
  return `- id=${c.itemId} [${c.itemType}] ${text}${meaning} · 학습 ${c.studiedCount}회(정답${c.correctCount}·오답${c.wrongCount}) · 피드백 ${c.feedbackCount}회 · 현재 간격 ${c.intervalDays}일 · ${c.priority} · ${last}`
}

/** 앞(우선순위 높은 쪽)부터 채우고 상한을 넘기면 뒤에서 자른다 — `chatReview.trimToBudget`(오래된 것부터 자름)과 반대 방향. */
function trimCandidates(items: ReviewDecisionCandidateInput[], maxCount: number, maxChars: number): { kept: ReviewDecisionCandidateInput[]; skipped: number } {
  const kept: ReviewDecisionCandidateInput[] = []
  let used = 0
  for (const c of items) {
    if (kept.length >= maxCount) break
    const line = renderCandidateLine(c)
    const cost = line.length + (kept.length > 0 ? 1 : 0)
    if (used + cost > maxChars) break
    used += cost
    kept.push(c)
  }
  return { kept, skipped: items.length - kept.length }
}

function renderObservationSummary(items: ReviewDecisionObservationSummary[]): string | null {
  if (items.length === 0) return null
  const parts = items.slice(0, OBSERVATION_LINE_MAX_SKILLS).map((o) => `${o.skill} 성공${o.success}·실패${o.fail}`)
  return `[최근 관측] ${parts.join(' · ')}`
}

function renderErrorStats(items: ReviewDecisionErrorStat[]): string | null {
  if (items.length === 0) return null
  const parts = items.slice(0, ERROR_STAT_TOP).map((e) => `${e.type}(${e.count})`)
  return `[반복 오류] ${parts.join('·')}`
}

function reviewDecisionInstruction(): string {
  return [
    '[지시] 아래 [복습 후보] 각 항목을 다음에 언제(3~7일 사이) 다시 볼지 정하고, 오늘 볼 항목을 고르세요. 최상위 키는 decisions, sessionPlan, rationale_ko 입니다.',
    '- decisions: [복습 후보]의 itemId 를 그대로 써서 판단한 만큼 배열로 담습니다(전부 판단하지 않아도 됩니다 — 애매하면 빼도 됩니다). nextIntervalDays 는 3~7 사이 정수(많이 틀리거나 피드백이 많을수록 3에 가깝게, 잘할수록 7에 가깝게). priority 는 많이 틀리거나 자주 교정한 항목만 FOCUS(그 밖은 NORMAL). reason_ko 는 "4회 학습·오답 3회라 3일" 처럼 근거 한 줄(80자 이내, 한국어).',
    '- sessionPlan.itemIds: 오늘 학습에 포함하면 좋을 항목 id — 학습 횟수가 적은 것을 우선하고 고르게 섞습니다. mixNote_ko 는 어떻게 섞을지 한 줄(200자 이내, 한국어).',
    '- rationale_ko: 전체 판단 근거 요약(300자 이내, 한국어).',
    '- [복습 후보]에 없는 id 를 지어내지 않습니다. 최근 관측 요약이나 반복 오류 통계가 위에 있으면 판단의 참고 근거로 씁니다(직접 인용하지 않아도 됩니다).',
    INJECTION_GUARD,
  ].join('\n')
}

export function buildReviewDecisionRequest(input: ReviewDecisionInput): ReviewDecisionRequest {
  if (input.candidates.length === 0) throw new ReviewDecisionInputError('복습 후보가 비어 있어 판단할 수 없다')
  const { kept, skipped } = trimCandidates(input.candidates, REVIEW_DECISION_MAX_CANDIDATES, REVIEW_DECISION_CANDIDATES_MAX_CHARS)
  if (kept.length === 0) throw new ReviewDecisionInputError('후보 1건이 상한보다 커서 판단할 수 없다')

  const persona = loadPersona({ sections: [1, 2, 6, 7, 8], mode: 'REVIEW_DECISION' })
  const system = [
    renderToday(input.todayKst),
    '[모드] REVIEW_DECISION',
    renderHeader(input.learner, REVIEW_DECISION_HEADER_CAP),
    renderObservationSummary(input.observationSummary ?? []),
    renderErrorStats(input.errorStats ?? []),
    reviewDecisionInstruction(),
  ]
    .filter((x): x is string => Boolean(x))
    .join('\n')
  const body = ['[복습 후보]', ...kept.map(renderCandidateLine)].join('\n')

  return {
    task: 'reviewDecision',
    persona,
    system,
    messages: [{ role: 'user', content: body }],
    jsonSchema: REVIEW_DECISION_SCHEMA,
    extraCheck: (data) => checkReviewDecisionResponse(data),
    keptItemIds: kept.map((c) => c.itemId),
    skippedCandidates: skipped,
  }
}
