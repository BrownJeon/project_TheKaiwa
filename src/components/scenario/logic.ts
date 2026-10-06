/**
 * 상황 역할극 화면의 순수 유도 함수(task-010d B, 가이드 §5) — 카드 상태·장소 묶음·추천 순서·조사·목표 요약·초안 모양·검사·오류 분류·초안 보관.
 * React·브라우저 API 를 쓰지 않는다(단위 테스트 `__tests__/logic.test.ts`). 문구는 `scenarioCopy.ts` 만.
 * 표현 id·진행 값은 서버(`learning/scenarios/expressions.ts`) 규약 그대로 받는다 — 글자 비교로 ✓ 를 만들지 않는다.
 */
import { cpLength, kstDateKey } from '@/components/common/format'
import type { Err } from '@/components/common/errors'
import { formatMonthDay } from '@/components/vocab/format'
import type { JlptLevel } from '@/types/lesson'
import {
  SCENARIO_LIMITS as L,
  type ScenarioDetail,
  type ScenarioInput,
  type ScenarioListItem,
  type ScenarioListResponse,
  type ScenarioPatch,
  type ScenarioRecommendReason,
  type ScenarioTopicRef,
} from '@/types/scenario'
import { CARD, CHECK, HOME, RECOMMEND_REASON_KO } from './scenarioCopy'

/* ── 조사 ─────────────────────────────────────────────────────────────── */

const HANGUL_FIRST = 0xac00
const HANGUL_LAST = 0xd7a3

/** 마지막 글자 받침: 있음 true · 없음 false · 한글이 아님 null. */
export function finalConsonant(word: string): { has: boolean; rieul: boolean } | null {
  const chars = Array.from(word.trim())
  const last = chars[chars.length - 1]
  if (!last) return null
  const code = last.codePointAt(0) ?? 0
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null
  const jong = (code - HANGUL_FIRST) % 28
  return { has: jong !== 0, rieul: jong === 8 }
}

/** `josa('점원', '이', '가')` → '점원이'. 한글이 아닌 끝이면 '이(가)' 처럼 둘 다 적는다. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const f = finalConsonant(word)
  if (!f) return `${word}${withFinal}(${withoutFinal})`
  return `${word}${f.has ? withFinal : withoutFinal}`
}

/** '(으)로' — ㄹ 받침은 '로'. */
export function withRo(word: string): string {
  const f = finalConsonant(word)
  if (!f) return `${word}(으)로`
  return `${word}${f.has && !f.rieul ? '으로' : '로'}`
}

/* ── 주소 값 ──────────────────────────────────────────────────────────── */

const ID_PARAM = /^[A-Za-z0-9_-]{1,40}$/
/** `?sc=`·`[id]` — 서버 id 모양(영문·숫자·_·- 1~40자)만 받는다. */
export const isScenarioIdParam = (v: unknown): v is string => typeof v === 'string' && ID_PARAM.test(v)

/* ── 카드 ─────────────────────────────────────────────────────────────── */

export type CardStatus = { kind: 'first' } | { kind: 'achieved' | 'almost' | 'notYet'; date: string }

export function dateLabel(iso: string): string {
  const key = kstDateKey(iso)
  return key ? formatMonthDay(key) : ''
}

export function cardStatus(item: Pick<ScenarioListItem, 'last'>): CardStatus {
  const last = item.last
  if (!last) return { kind: 'first' }
  const date = dateLabel(last.at)
  if (last.outcome === 'ACHIEVED') return { kind: 'achieved', date }
  if (last.outcome === 'ALMOST') return { kind: 'almost', date }
  return { kind: 'notYet', date }
}

/** 추천 이유 → 한 줄. 모르는 코드·없음 = null(줄 없음). */
export function recommendReasonText(reason: string | null | undefined): string | null {
  if (!reason || !Object.prototype.hasOwnProperty.call(RECOMMEND_REASON_KO, reason)) return null
  return RECOMMEND_REASON_KO[reason as ScenarioRecommendReason]
}

export function difficultyOf(d: unknown): number {
  const n = typeof d === 'number' && Number.isFinite(d) ? Math.round(d) : L.difficultyMin + 1
  return Math.min(L.difficultyMax, Math.max(L.difficultyMin, n))
}

/** 카드 아래 줄의 조각(단계 수가 0 이면 단계 조각 없음). */
export function cardMetaSteps(stepCount: number): string | null {
  return stepCount > 0 ? CARD.steps(stepCount) : null
}

/** 추천 칸 — 서버 `recommendedIds` 순서, 목록에 있는 것만, ≤3. 뿌리 칸이 없으면 항목의 `recommended`. */
export function pickRecommended(res: Pick<ScenarioListResponse, 'items' | 'recommendedIds'>): ScenarioListItem[] {
  const byId = new Map(res.items.map((x) => [x.id, x]))
  const ids = Array.isArray(res.recommendedIds) ? res.recommendedIds : res.items.filter((x) => x.recommended).map((x) => x.id)
  const out: ScenarioListItem[] = []
  for (const id of ids) {
    const it = byId.get(id)
    if (it && !out.includes(it)) out.push(it)
    if (out.length >= 3) break
  }
  return out
}

/* ── 장소 칩·묶음 ─────────────────────────────────────────────────────── */

export type PlaceFilter = 'all' | 'mine' | `topic:${string}`

export interface PlaceGroup {
  key: string
  title: string
  titleJa: string | null
  items: ScenarioListItem[]
}

/** 장소 순서 — 시드 상황의 첫 장소(서버가 시드 주제 순서로 정렬해 준다) → 그 밖 장소, 처음 나온 순서. */
export function placeOrder(items: readonly ScenarioListItem[]): ScenarioTopicRef[] {
  const seen = new Map<string, ScenarioTopicRef>()
  const seeds = items.filter((x) => !x.isMine)
  for (const x of seeds) if (x.topics[0] && !seen.has(x.topics[0].id)) seen.set(x.topics[0].id, x.topics[0])
  for (const x of [...seeds, ...items.filter((y) => y.isMine)]) for (const t of x.topics) if (!seen.has(t.id)) seen.set(t.id, t)
  return [...seen.values()]
}

export function placeOptions(items: readonly ScenarioListItem[]): { value: PlaceFilter; label: string }[] {
  const mine = items.filter((x) => x.isMine).length
  return [
    { value: 'all', label: HOME.chipAll },
    ...(mine > 0 ? [{ value: 'mine' as const, label: HOME.chipMine(mine) }] : []),
    ...placeOrder(items).map((t) => ({ value: `topic:${t.id}` as const, label: t.title })),
  ]
}

/** 고른 칩이 사라졌으면(지운 뒤 장소가 없어짐) 전체로. '내 상황'은 0개여도 그대로 둔다(빈 안내를 보여야 한다). */
export function effectiveFilter(filter: PlaceFilter, options: readonly { value: PlaceFilter }[]): PlaceFilter {
  if (filter === 'mine' || filter === 'all') return filter
  return options.some((o) => o.value === filter) ? filter : 'all'
}

/**
 * 전체: 내 상황 묶음 → 장소별(상황마다 첫 장소에만 한 번) → 장소 없는 "다른 상황".
 * 장소 칩: 그 장소와 이어진 상황 전부(여러 장소면 칩마다 보인다). 내 상황 칩: 내 상황만(서버 순서 = 최근 만든 것 위).
 */
export function groupByPlace(items: readonly ScenarioListItem[], filter: PlaceFilter): PlaceGroup[] {
  if (filter === 'mine') {
    const mine = items.filter((x) => x.isMine)
    return mine.length ? [{ key: 'mine', title: HOME.groupMine, titleJa: null, items: mine }] : []
  }
  if (filter !== 'all') {
    const id = filter.slice('topic:'.length)
    const hit = items.filter((x) => x.topics.some((t) => t.id === id))
    const ref = hit[0]?.topics.find((t) => t.id === id)
    return ref ? [{ key: filter, title: ref.title, titleJa: ref.titleJa, items: hit }] : []
  }
  const groups: PlaceGroup[] = []
  const mine = items.filter((x) => x.isMine)
  if (mine.length) groups.push({ key: 'mine', title: HOME.groupMine, titleJa: null, items: mine })
  const others = items.filter((x) => !x.isMine)
  for (const t of placeOrder(others)) {
    const inPlace = others.filter((x) => x.topics[0]?.id === t.id)
    if (inPlace.length) groups.push({ key: `topic:${t.id}`, title: t.title, titleJa: t.titleJa, items: inPlace })
  }
  const loose = others.filter((x) => x.topics.length === 0)
  if (loose.length) groups.push({ key: 'other', title: HOME.groupOther, titleJa: null, items: loose })
  return groups
}

/* ── 목표 카드 요약·단계(역할극 방 — B2 가 쓴다) ──────────────────────── */

/** 단계 진행값은 0부터 센 "지금 단계". 없거나 이상하면 null(순서만 보인다). */
export function stepPosition(stepIndex: number | null | undefined, stepCount: number): number | null {
  if (typeof stepIndex !== 'number' || !Number.isInteger(stepIndex) || stepIndex < 0 || stepCount <= 0) return null
  return Math.min(stepIndex, stepCount - 1)
}

export function goalSummary(o: { stepIndex: number | null | undefined; stepCount: number; usedCount: number; total: number; checksHidden: boolean }): string {
  if (o.checksHidden) return `표현 ${o.total}개`
  const pos = stepPosition(o.stepIndex, o.stepCount)
  const expr = `표현 ${Math.min(o.usedCount, o.total)}/${o.total}`
  if (o.stepCount <= 0) return expr
  return pos === null ? `${o.stepCount}단계 · ${expr}` : `${pos + 1}/${o.stepCount}단계 · ${expr}`
}

export type StepState = 'done' | 'current' | 'next'

export function stepView(steps: readonly { ko: string }[], stepIndex: number | null | undefined): { ko: string; state: StepState }[] {
  const pos = stepPosition(stepIndex, steps.length)
  return steps.map((s, i) => ({ ko: s.ko, state: pos === null ? 'next' : i < pos ? 'done' : i === pos ? 'current' : 'next' }))
}

/** 필수 표현 수 — 만들 때는 서버 기본(min(2, 표현 수)), 고칠 때는 저장 값을 표현 수 안으로. */
export function requiredOf(count: number, stored: number | null | undefined): number {
  if (count <= 0) return 0
  if (typeof stored === 'number' && Number.isInteger(stored) && stored >= 1) return Math.min(stored, count)
  return Math.min(2, count)
}

/* ── 초안(편집 모양) ──────────────────────────────────────────────────── */

export const DRAFT_LEVELS = ['N5', 'N4', 'N3'] as const satisfies readonly JlptLevel[]
export type DraftLevel = (typeof DRAFT_LEVELS)[number]

/** 프로필 수준 → 초안 수준(N2·N1 은 N3, 모르면 N5). */
export function draftLevelOf(level: unknown): DraftLevel {
  if (level === 'N5' || level === 'N4' || level === 'N3') return level
  if (level === 'N2' || level === 'N1') return 'N3'
  return 'N5'
}

export interface DraftExpression {
  /** 저장된 표현 id(고칠 때만 — 서버가 그대로 둔다). 새 표현은 없음. */
  id?: string
  ja: string
  reading?: string
  ko: string
}

export interface EditableDraft {
  title: string
  titleJa: string
  level: JlptLevel
  difficulty: number | null
  learner: string
  tutor: string
  goalKo: string
  criteria: string[]
  steps: string[]
  expressions: DraftExpression[]
  opening: { ja: string; ko: string } | null
  topicIds: string[]
  /** 고칠 때 저장된 필수 표현 수(보이기만 — 화면에서 바꾸지 않는다). */
  requiredExpressions: number | null
}

export interface DraftAsk {
  desc: string
  topicId: string | null
  level: DraftLevel
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : isObj(x) ? str(x.ko) : '')) : [])
const levelOr = (v: unknown, d: JlptLevel): JlptLevel => (v === 'N5' || v === 'N4' || v === 'N3' || v === 'N2' || v === 'N1' ? v : d)

function exprList(v: unknown, keepIds: boolean): DraftExpression[] {
  if (!Array.isArray(v)) return []
  return v.filter(isObj).map((e) => {
    const out: DraftExpression = { ja: str(e.ja), ko: str(e.ko) }
    if (keepIds && typeof e.id === 'string' && e.id) out.id = e.id
    if (typeof e.reading === 'string' && e.reading) out.reading = e.reading
    return out
  })
}

function openingOf(v: unknown): { ja: string; ko: string } | null {
  return isObj(v) && typeof v.ja === 'string' && v.ja ? { ja: v.ja, ko: str(v.ko) } : null
}

/**
 * 초안 응답(S3 `{draft:{…}}`) → 편집 모양. 서버가 아직 없는 API 라 모양을 넉넉히 받는다(빠진 칸은 빈 칸 — 사용자가 채운다).
 * 표현 id 는 받지 않는다(만들 때 서버가 정한다). 객체가 아니면 null.
 */
export function draftFromResponse(raw: unknown, ask: DraftAsk): EditableDraft | null {
  const d = isObj(raw) && isObj(raw.draft) ? raw.draft : null
  if (!d) return null
  const roles = isObj(d.roles) ? d.roles : {}
  const goal = isObj(d.goal) ? d.goal : {}
  const topicIds = Array.isArray(d.topicIds) ? d.topicIds.filter(isScenarioIdParam).slice(0, L.topicsMax) : isScenarioIdParam(d.topicId) ? [d.topicId] : ask.topicId ? [ask.topicId] : []
  return {
    title: str(d.title),
    titleJa: str(d.titleJa),
    level: levelOr(d.level, ask.level),
    difficulty: typeof d.difficulty === 'number' ? difficultyOf(d.difficulty) : null,
    learner: str(roles.learner),
    tutor: str(roles.tutor),
    goalKo: str(goal.communicativeGoalKo),
    criteria: strList(goal.successCriteria).slice(0, L.successCriteriaMax),
    steps: strList(d.steps).slice(0, L.stepsMax),
    expressions: exprList(d.keyExpressions, false).slice(0, L.expressionsMax),
    opening: openingOf(d.opening),
    topicIds,
    requiredExpressions: null,
  }
}

export function draftFromDetail(s: ScenarioDetail): EditableDraft {
  return {
    title: s.title,
    titleJa: s.titleJa ?? '',
    level: s.level,
    difficulty: s.difficulty,
    learner: s.roles.learner,
    tutor: s.roles.tutor,
    goalKo: s.goal.communicativeGoalKo,
    criteria: [...s.goal.successCriteria],
    steps: s.steps.map((x) => x.ko),
    expressions: exprList(s.keyExpressions, true),
    opening: s.opening ? { ja: s.opening.ja, ko: s.opening.ko } : null,
    topicIds: s.topics.map((t) => t.id),
    requiredExpressions: s.requiredExpressions,
  }
}

/** 한 줄 정리(서버와 같은 방향 — 줄바꿈·탭·연속 공백을 한 칸으로, 앞뒤 공백 제거). */
export function oneLine(s: string): string {
  return s.replace(/[\r\n\t\f\v ]+/g, ' ').trim()
}

function exprBody(e: DraftExpression, keepId: boolean): ScenarioInput['keyExpressions'][number] {
  const out: ScenarioInput['keyExpressions'][number] = { ja: oneLine(e.ja), ko: oneLine(e.ko) }
  if (keepId && e.id) out.id = e.id
  if (e.reading) out.reading = oneLine(e.reading)
  return out
}

/** #163 만들기 본문. 표현 id 는 보내지 않는다. 필수 표현 수도 보내지 않는다(서버 기본). */
export function draftInput(d: EditableDraft, ask: Pick<DraftAsk, 'desc'>): ScenarioInput {
  const desc = oneLine(ask.desc)
  const titleJa = oneLine(d.titleJa)
  return {
    title: oneLine(d.title),
    titleJa: titleJa || null,
    description: desc || null,
    level: d.level,
    ...(d.difficulty !== null ? { difficulty: difficultyOf(d.difficulty) } : {}),
    roles: { learner: oneLine(d.learner), tutor: oneLine(d.tutor) },
    goal: { communicativeGoalKo: oneLine(d.goalKo), successCriteria: d.criteria.map(oneLine) },
    steps: d.steps.map((ko) => ({ ko: oneLine(ko) })),
    keyExpressions: d.expressions.map((e) => exprBody(e, false)),
    opening: d.opening ? { ja: oneLine(d.opening.ja), ko: oneLine(d.opening.ko) } : null,
    topicIds: d.topicIds.slice(0, L.topicsMax),
  }
}

/** #164 고치기 본문 — 바뀐 칸만(설명·난이도·필수 수는 이 화면에서 바꾸지 않아 보내지 않는다). 바뀐 것이 없으면 빈 객체. */
export function draftPatch(d: EditableDraft, original: ScenarioDetail): ScenarioPatch {
  const next = draftInput(d, { desc: '' })
  next.keyExpressions = d.expressions.map((e) => exprBody(e, true))
  const before = draftInput(draftFromDetail(original), { desc: '' })
  before.keyExpressions = original.keyExpressions.map((e) => exprBody({ id: e.id, ja: e.ja, ko: e.ko, ...(e.reading ? { reading: e.reading } : {}) }, true))
  const keys = ['title', 'titleJa', 'level', 'roles', 'goal', 'steps', 'keyExpressions', 'opening', 'topicIds'] as const
  const out: ScenarioPatch = {}
  for (const k of keys) {
    if (JSON.stringify(next[k] ?? null) !== JSON.stringify(before[k] ?? null)) Object.assign(out, { [k]: next[k] })
  }
  return out
}

/* ── 검사 ─────────────────────────────────────────────────────────────── */

/** 화면 칸 열쇠: title·titleJa·place·level·learner·tutor·goal·criteria·criteria[i]·steps·steps[i]·expr·expr[i]·opening·description·other. */
export interface DraftProblem {
  key: string
  message: string
}

/** 서버 칸 경로(`steps[2].ko`·`keyExpressions[0].ja`·`goal.successCriteria[1]`·`roles.tutor` …) → 화면 칸 열쇠. */
export function problemKey(field: string): string {
  let m: RegExpExecArray | null
  if ((m = /^steps\[(\d+)\]/.exec(field))) return `steps[${m[1]}]`
  if (field === 'steps') return 'steps'
  if ((m = /^goal\.successCriteria\[(\d+)\]/.exec(field))) return `criteria[${m[1]}]`
  if (field === 'goal.successCriteria') return 'criteria'
  if (field === 'goal' || field.startsWith('goal.')) return 'goal'
  if ((m = /^keyExpressions\[(\d+)\]/.exec(field))) return `expr[${m[1]}]`
  if (field === 'keyExpressions' || field === 'requiredExpressions') return 'expr'
  if (field === 'roles.tutor') return 'tutor'
  if (field === 'roles' || field.startsWith('roles.')) return 'learner'
  if (field === 'opening' || field.startsWith('opening.')) return 'opening'
  if (field === 'topicIds' || field.startsWith('topicIds[')) return 'place'
  if (field === 'title' || field === 'titleJa' || field === 'level' || field === 'description') return field
  return 'other'
}

/** 화면 칸 열쇠 → 초점 받을 요소 id. */
export function problemDomId(key: string): string {
  return `dr-${key.replace(/\[(\d+)\]/, '-$1')}`
}

function checkText(p: DraftProblem[], key: string, raw: string, max: number, label: string, required: boolean) {
  const t = oneLine(raw)
  if (!t) {
    if (required) p.push({ key, message: CHECK.required(label) })
    return
  }
  if (cpLength(t) > max) p.push({ key, message: CHECK.tooLong(label, max) })
  else if (/[<>]/.test(t)) p.push({ key, message: CHECK.angle(label) })
}

/** 저장 전 검사(서버 한도와 같은 값). 칸마다 첫 문제 하나씩, 화면 순서대로. */
export function validateDraft(d: EditableDraft): DraftProblem[] {
  const p: DraftProblem[] = []
  const C = CHECK.label
  checkText(p, 'title', d.title, L.titleMax, C.title, true)
  checkText(p, 'titleJa', d.titleJa, L.titleJaMax, C.titleJa, false)
  checkText(p, 'learner', d.learner, L.roleMax, C.learner, true)
  checkText(p, 'tutor', d.tutor, L.roleMax, C.tutor, true)
  checkText(p, 'goal', d.goalKo, L.goalMax, C.goal, true)
  if (d.steps.length < L.stepsMin) p.push({ key: 'steps', message: CHECK.listMin(C.steps, L.stepsMin) })
  else if (d.steps.length > L.stepsMax) p.push({ key: 'steps', message: CHECK.listMax(C.steps, L.stepsMax) })
  d.steps.forEach((s, i) => checkText(p, `steps[${i}]`, s, L.stepMax, C.step, true))
  if (d.criteria.length < L.successCriteriaMin) p.push({ key: 'criteria', message: CHECK.listMin(C.criteria, L.successCriteriaMin) })
  else if (d.criteria.length > L.successCriteriaMax) p.push({ key: 'criteria', message: CHECK.listMax(C.criteria, L.successCriteriaMax) })
  d.criteria.forEach((s, i) => checkText(p, `criteria[${i}]`, s, L.successCriterionMax, C.criterion, true))
  if (d.expressions.length < L.expressionsMin) p.push({ key: 'expr', message: CHECK.listMin(C.expressions, L.expressionsMin) })
  else if (d.expressions.length > L.expressionsMax) p.push({ key: 'expr', message: CHECK.listMax(C.expressions, L.expressionsMax) })
  const seen = new Set<string>()
  d.expressions.forEach((e, i) => {
    const before = p.length
    checkText(p, `expr[${i}]`, e.ja, L.expressionJaMax, C.exprJa, true)
    if (p.length === before) checkText(p, `expr[${i}]`, e.ko, L.expressionKoMax, C.exprKo, true)
    const ja = oneLine(e.ja)
    if (p.length === before && ja && seen.has(ja)) p.push({ key: `expr[${i}]`, message: CHECK.duplicate })
    if (ja) seen.add(ja)
  })
  if (d.opening) {
    const before = p.length
    checkText(p, 'opening', d.opening.ja, L.openingJaMax, C.openingJa, true)
    if (p.length === before) checkText(p, 'opening', d.opening.ko, L.openingKoMax, C.openingKo, true)
  }
  return dedupe(p)
}

function dedupe(p: DraftProblem[]): DraftProblem[] {
  const seen = new Set<string>()
  return p.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)))
}

/** 400 `details.problems[]`(없으면 `{field}` + 봉투 문구) → 화면 칸 문제. */
export function serverProblems(details: Record<string, unknown>, message: string): DraftProblem[] {
  const list = Array.isArray(details.problems) ? details.problems : []
  const out = list
    .filter(isObj)
    .filter((x) => typeof x.field === 'string')
    .map((x) => ({ key: problemKey(x.field as string), message: str(x.message) || message }))
  if (!out.length && typeof details.field === 'string') out.push({ key: problemKey(details.field), message })
  return dedupe(out)
}

export function problemMap(p: readonly DraftProblem[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const x of p) if (!(x.key in out)) out[x.key] = x.message
  return out
}

/* ── 오류 분류 ────────────────────────────────────────────────────────── */

export type StartFailure = 'gone' | 'archived' | 'rate' | 'fail'

/** S5(#28 역할극 시작) 실패 → 시트 상태. 404 = 없는 상황 · 409 ARCHIVED · 429 · 그 밖(400 준비 중 포함) = 시작 실패. */
export function startFailureOf(err: Err): StartFailure {
  if (err.status === 404) return 'gone'
  if (err.status === 409 && (err.details.reason === 'ARCHIVED' || err.code === 'ARCHIVED')) return 'archived'
  if (err.status === 429) return 'rate'
  return 'fail'
}

/** 429 대기 초(`common/errors.retryAfterOf` 와 같은 규칙 — 이 파일은 서버 페이지도 읽어서 런타임 import 를 순수 모듈로만 둔다). */
function retrySecOf(err: Err): number {
  const fromDetails = Number(err.details.retryAfterSec)
  if (Number.isFinite(fromDetails) && fromDetails > 0) return Math.ceil(fromDetails)
  return err.retryAfterSec && err.retryAfterSec > 0 ? err.retryAfterSec : 10
}

export type GenFailure = { kind: 'fail' } | { kind: 'unfit' } | { kind: 'rate'; sec: number } | { kind: 'field'; message: string }

/** S3(초안 만들기) 실패 → 화면 상태. 아직 없는 API(404·501)·네트워크·5xx·시간 초과는 모두 다시 시도. */
export function genFailureOf(err: Err, timedOut: boolean): GenFailure {
  if (timedOut) return { kind: 'fail' }
  if (err.status === 422) return { kind: 'unfit' }
  if (err.status === 429) return { kind: 'rate', sec: retrySecOf(err) }
  if (err.status === 400 && err.details.field === 'description' && err.message) return { kind: 'field', message: err.message }
  return { kind: 'fail' }
}

export type SaveFailure = { kind: 'invalid'; problems: DraftProblem[] } | { kind: 'gone' } | { kind: 'message'; text: string } | { kind: 'rate' } | { kind: 'fail' }

/**
 * S4(#163·#164) 실패 → 화면 상태. 400 = 칸 문제 · 404(시드·남의 것·없음)·409 ARCHIVED = 고칠 수 없음 ·
 * 409 SCENARIO_LIMIT·429 DAILY_LIMIT = 서버 문구 그대로(가이드에 없는 상태 — 숫자가 서버 한도라 서버 문구가 정확하다) · 그 밖 429 = 잠시 뒤 · 0·5xx = 저장 실패.
 */
export function saveFailureOf(err: Err): SaveFailure {
  if (err.status === 400) {
    const problems = serverProblems(err.details, err.message)
    return problems.length ? { kind: 'invalid', problems } : { kind: 'fail' }
  }
  if (err.status === 404) return { kind: 'gone' }
  if (err.status === 409 && err.details.reason === 'ARCHIVED') return { kind: 'gone' }
  if ((err.status === 409 && err.details.reason === 'SCENARIO_LIMIT') || (err.status === 429 && err.details.reason === 'DAILY_LIMIT')) {
    return err.message ? { kind: 'message', text: err.message } : { kind: 'fail' }
  }
  if (err.status === 429) return { kind: 'rate' }
  return { kind: 'fail' }
}

/* ── 초안 보관(sessionStorage) ───────────────────────────────────────── */

export interface StoredDraft {
  v: 1
  ask: DraftAsk
  draft: EditableDraft | null
  /** 초안을 받은 뒤 사용자가 고쳤는지(다시 만들기 확인). */
  edited: boolean
  savedAt: number
}

function parseEditable(v: unknown): EditableDraft | null {
  if (!isObj(v)) return null
  const strings = ['title', 'titleJa', 'learner', 'tutor', 'goalKo'] as const
  if (!strings.every((k) => typeof v[k] === 'string')) return null
  const arr = (x: unknown) => Array.isArray(x) && x.every((y) => typeof y === 'string')
  if (!arr(v.criteria) || !arr(v.steps) || !arr(v.topicIds) || !Array.isArray(v.expressions)) return null
  return {
    title: v.title as string,
    titleJa: v.titleJa as string,
    level: levelOr(v.level, 'N5'),
    difficulty: typeof v.difficulty === 'number' ? difficultyOf(v.difficulty) : null,
    learner: v.learner as string,
    tutor: v.tutor as string,
    goalKo: v.goalKo as string,
    criteria: (v.criteria as string[]).slice(0, L.successCriteriaMax),
    steps: (v.steps as string[]).slice(0, L.stepsMax),
    expressions: exprList(v.expressions, false).slice(0, L.expressionsMax),
    opening: openingOf(v.opening) ?? (isObj(v.opening) ? { ja: str(v.opening.ja), ko: str(v.opening.ko) } : null),
    topicIds: (v.topicIds as string[]).filter(isScenarioIdParam).slice(0, L.topicsMax),
    requiredExpressions: null,
  }
}

export function parseStoredDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(v) || v.v !== 1 || !isObj(v.ask) || typeof v.ask.desc !== 'string') return null
  const ask: DraftAsk = {
    desc: Array.from(v.ask.desc).slice(0, L.descriptionMax * 2).join(''),
    topicId: isScenarioIdParam(v.ask.topicId) ? v.ask.topicId : null,
    level: draftLevelOf(v.ask.level),
  }
  const draft = v.draft === null || v.draft === undefined ? null : parseEditable(v.draft)
  return { v: 1, ask, draft, edited: v.edited === true && !!draft, savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0 }
}

export function serializeStoredDraft(s: Omit<StoredDraft, 'v'>): string {
  return JSON.stringify({ v: 1, ...s })
}

/** 비어 있는 보관(묻기 칸이 비고 초안이 없음)이면 저장하지 않는다. */
export function isBlankStore(s: Pick<StoredDraft, 'ask' | 'draft'>): boolean {
  return !s.draft && !oneLine(s.ask.desc) && !s.ask.topicId
}
