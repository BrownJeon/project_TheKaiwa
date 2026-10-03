/**
 * 반복 학습 순수 규칙(task-010b, design-spec §7-4·learning-personalization §2-5) — DB 없음.
 *
 *  - 세션 크기: `Profile.dailyMinutes` 의 절반(15분 → 8), **항상 4 이상**(A5 `chunks` 최소 4 — PE 실측: 4 미만이면 1차 시도가 스키마
 *    위반으로 재시도된다) · 상한 12.
 *  - 균등 랜덤 추출: due 항목 `weight = 1/(1+studiedCount) × (FOCUS ? 2 : 1)`, 최근 3세션에 나온 항목 ×0.5, 시드 PRNG 가중 비복원 샘플링
 *    (오늘의 단어와 같은 `createRng`·`sampleWeighted` — 같은 시드·같은 후보 → 같은 결과, `ReviewSchedule.seed` 로 재현).
 *    due 가 4 미만이면 가장 가까운 예정 항목으로 4까지 채운다(전체 항목이 4 미만이면 있는 만큼).
 *  - A11 후보 순서: 오늘+1 까지 예정 → 마지막 학습 뒤 아직 강사 판단을 받지 않은 항목 → FOCUS → 오답 많은 순 → 예정일 → id.
 *  - 최소 기록 가드: 공부한 날 2일·반복 항목 2개 미만이면 복습을 열지 않는다(A11 도 부르지 않는다).
 */
import type { DecidedBy, RepetitionPriority } from '@prisma/client'
import { dates } from '@/modules/infra'
import { createRng, sampleWeighted } from '../vocab/setGenerator'

export const REVIEW_SESSION_MIN = 4
export const REVIEW_SESSION_MAX = 12
export const REVIEW_RECENT_SESSIONS = 3
export const REVIEW_RECENT_DECAY = 0.5
export const REVIEW_FOCUS_WEIGHT = 2
export const REVIEW_GUARD_STUDY_DAYS = 2
export const REVIEW_GUARD_ITEMS = 2
/** A11 후보 상한(design-spec §8 A11 "≤40건" — 프롬프트 쪽이 글자 수로 한 번 더 자른다). */
export const REVIEW_CANDIDATES_MAX = 40
/** #58 카드 미리보기 상한(Leader 결정 ②). */
export const REVIEW_PREVIEW_MAX = 7
/** 폴백 근거 문구(L5) — 화면에 그대로 보인다. */
export const REVIEW_FALLBACK_RATIONALE_KO = '지난 학습에서 틀리거나 오래된 항목을 골랐어요'

export function reviewSessionSize(dailyMinutes: number | null | undefined): number {
  const m = typeof dailyMinutes === 'number' && Number.isFinite(dailyMinutes) && dailyMinutes > 0 ? dailyMinutes : 15
  return Math.min(REVIEW_SESSION_MAX, Math.max(REVIEW_SESSION_MIN, Math.round(m / 2)))
}

export interface SampleItem {
  id: string
  studiedCount: number
  priority: RepetitionPriority
  /** `YYYY-MM-DD` 또는 null. */
  nextDueAt: string | null
}

export function reviewWeight(it: Pick<SampleItem, 'studiedCount' | 'priority'>, recent: boolean): number {
  const studied = Math.max(0, Math.floor(it.studiedCount || 0))
  return (1 / (1 + studied)) * (it.priority === 'FOCUS' ? REVIEW_FOCUS_WEIGHT : 1) * (recent ? REVIEW_RECENT_DECAY : 1)
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * 오늘의 복습 항목 id — `due`(예정일 ≤ 오늘)에서 가중 추출 `min(size, due 수)`, 4 미만이면 `upcoming`(예정일 > 오늘)을 가까운 순으로 채운다.
 * 입력 순서와 무관(id 정렬 후 난수 소비) — 같은 (후보 집합, 시드, 최근 노출) → 같은 결과.
 */
export function pickReviewSession(input: { due: readonly SampleItem[]; upcoming: readonly SampleItem[]; size: number; seed: string; recentIds: ReadonlySet<string> }): string[] {
  const size = Math.max(0, Math.floor(input.size))
  const due = [...input.due].sort(byId)
  const rng = createRng(input.seed)
  const picked = sampleWeighted(
    due,
    due.map((d) => reviewWeight(d, input.recentIds.has(d.id))),
    Math.min(size, due.length),
    rng,
  ).map((d) => d.id)
  if (picked.length >= REVIEW_SESSION_MIN || picked.length >= size) return picked
  const taken = new Set(picked)
  const rest = input.upcoming
    .filter((u) => !taken.has(u.id))
    .sort((a, b) => (a.nextDueAt ?? '9999-12-31').localeCompare(b.nextDueAt ?? '9999-12-31') || byId(a, b))
  for (const u of rest) {
    if (picked.length >= Math.min(REVIEW_SESSION_MIN, size)) break
    picked.push(u.id)
  }
  return picked
}

// ── 최소 기록 가드 ──────────────────────────────────────────────────────────

/**
 * #58 `guard`. 이 서버가 내는 값은 `insufficient` 하나다. 계약의 `cycle`(옛 "R일 주기 중 복습일 아님")·`stale`(옛 "오래 쉬어 기록이 낡음")은
 * R-1(항목별 3~7일) 뒤 예약값으로만 남았다 — 복습할 항목이 없는 날은 `review:null`+`nextReview` 로, 오래 쉰 경우는 밀린 항목이 바로 due 가 되고
 * 7일 지난 세션은 EXPIRED 로 닫혀 다음 세션이 항목을 이어받는 것으로 표현한다(Leader ⑥, 화면은 모르는 값이면 숨김).
 */
export interface ReviewGuard {
  reason: 'insufficient'
  /** 남은 조건 중 큰 쪽(공부한 날·항목 수 부족분). */
  needed: number
  studyDays: { have: number; need: number }
  items: { have: number; need: number }
}

export function reviewGuardOf(c: { studyDays: number; items: number }): ReviewGuard | null {
  if (c.studyDays >= REVIEW_GUARD_STUDY_DAYS && c.items >= REVIEW_GUARD_ITEMS) return null
  return {
    reason: 'insufficient',
    needed: Math.max(0, REVIEW_GUARD_STUDY_DAYS - c.studyDays, REVIEW_GUARD_ITEMS - c.items),
    studyDays: { have: Math.min(c.studyDays, REVIEW_GUARD_STUDY_DAYS), need: REVIEW_GUARD_STUDY_DAYS },
    items: { have: Math.min(c.items, REVIEW_GUARD_ITEMS), need: REVIEW_GUARD_ITEMS },
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** DAILY 스냅샷 하루가 "공부한 날"인가 — 출석만 한 날은 아니다(레슨·복습·단어 세트·평가·교정 채택·대화 기록 중 하나라도). */
export function isStudyDay(data: unknown): boolean {
  const d = obj(data)
  return (
    num(d.lessons) + num(d.reviews) + num(obj(d.words).sessions) + num(d.evals) + num(obj(d.corrections).accepted) + num(d.talkTurns) + num(d.chatTurns) > 0
  )
}

// ── A11 후보 ───────────────────────────────────────────────────────────────

export interface CandidateRow {
  id: string
  studiedCount: number
  wrongCount: number
  priority: RepetitionPriority
  /** `YYYY-MM-DD` 또는 null. */
  nextDueAt: string | null
  lastStudiedAt: Date | null
  decidedAt: Date | null
}

/** 마지막 학습 뒤 아직 판단(강사·폴백)을 받지 않았는가. */
export function isUndecided(r: Pick<CandidateRow, 'lastStudiedAt' | 'decidedAt'>): boolean {
  return !r.decidedAt || (!!r.lastStudiedAt && r.lastStudiedAt.getTime() > r.decidedAt.getTime())
}

export function isDueBy(r: Pick<CandidateRow, 'nextDueAt'>, date: string): boolean {
  return !!r.nextDueAt && r.nextDueAt <= date
}

/** 판단할 일이 있는가 — 내일까지 예정이거나 아직 판단 전. 하나도 없으면 A11 을 부르지 않는다. */
export function needsDecision(r: CandidateRow, today: string): boolean {
  return isDueBy(r, dates.addDays(today, 1)) || isUndecided(r)
}

export function orderCandidates<T extends CandidateRow>(rows: readonly T[], today: string): T[] {
  const soon = dates.addDays(today, 1)
  const rank = (r: T): number[] => [isDueBy(r, soon) ? 0 : 1, isUndecided(r) ? 0 : 1, r.priority === 'FOCUS' ? 0 : 1, -r.wrongCount]
  return [...rows].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
    return (a.nextDueAt ?? '9999-12-31').localeCompare(b.nextDueAt ?? '9999-12-31') || byId(a, b)
  })
}

/** 다음 복습일 = 마지막 학습일(KST) + 간격. 오래 쉰 항목은 과거 날짜가 되어 바로 due 다(밀린 복습). */
export function nextDueDate(lastStudiedAt: Date | null, intervalDays: number, today: string): string {
  return dates.addDays(lastStudiedAt ? dates.todayKst(lastStudiedAt) : today, intervalDays)
}

// ── 다음 복습 묶음(#60 nextReview.groups · #58 nextReview) ──────────────────────

export interface NextReviewGroup {
  /** 기준일(완료한 날)에서 며칠 뒤. */
  days: number
  date: string
  itemIds: string[]
}

/** 항목을 다음 복습일로 묶는다(날짜 오름차순, 묶음 안은 입력 순서). 예정일 없는 항목은 뺀다. */
export function groupNextReview(items: readonly { id: string; nextDueAt: string | null }[], from: string): NextReviewGroup[] {
  const groups = new Map<string, string[]>()
  for (const it of items) {
    if (!it.nextDueAt) continue
    const g = groups.get(it.nextDueAt) ?? []
    g.push(it.id)
    groups.set(it.nextDueAt, g)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, itemIds]) => ({ days: Math.max(0, dates.countDays(from, date) - 1), date, itemIds }))
}

export interface NextReviewSummary {
  date: string
  /** 오늘에서 며칠 뒤(≥1). */
  days: number
  itemCount: number
  /** 그 묶음이 전부 강사 판단이면 TUTOR, 하나라도 기본 규칙(폴백·등록 직후)이면 FALLBACK(Leader ④, 선택값). */
  decidedBy: DecidedBy
}

/**
 * #58 `nextReview` — 오늘보다 뒤의 가장 이른 예정일(`date`) 묶음의 판단 주체별 개수 → 요약(순수). 개수가 0 이거나 날짜가 오늘 이전이면 null.
 */
export function nextReviewOf(date: string, today: string, counts: readonly { decidedBy: DecidedBy; n: number }[]): NextReviewSummary | null {
  const itemCount = counts.reduce((a, c) => a + Math.max(0, c.n), 0)
  if (!itemCount || date <= today) return null
  return { date, days: dates.countDays(today, date) - 1, itemCount, decidedBy: counts.every((c) => c.n <= 0 || c.decidedBy === 'TUTOR') ? 'TUTOR' : 'FALLBACK' }
}
