/**
 * 상황 역할극 화면의 순수 유도 함수(task-010d B, 가이드 §5) — 카드 상태·장소 묶음·추천 순서·조사·목표 요약·초안 모양·검사·오류 분류·초안 보관.
 * React·브라우저 API 를 쓰지 않는다(단위 테스트 `__tests__/logic.test.ts`). 문구는 `scenarioCopy.ts` 만.
 * 표현 id·진행 값은 서버(`learning/scenarios/expressions.ts`) 규약 그대로 받는다 — 글자 비교로 ✓ 를 만들지 않는다.
 */
import { cpLength, kstDateKey } from '@/components/common/format'
import { toErr, type Err } from '@/components/common/errors'
import { formatMonthDay } from '@/components/vocab/format'
import type { ChatDetail, ChatMessageView, RolePlayChatView, RolePlayProgress, TurnDoneEvent } from '@/types/chat'
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
import { scenarioFailure, scenarioFieldFailures, type ScenarioFailContext, type ScenarioFailure } from './failure'
import { CARD, CHECK, END, HOME, OPENING, RECOMMEND_REASON_KO, ROOM, type FieldLabelKey } from './scenarioCopy'

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

/**
 * 시트에 넘길 id — 수화가 끝나기 전(서버 렌더·수화 첫 렌더)에는 늘 닫힘(null). 공용 `Sheet` 는 서버에서 null, 클라이언트에선 포털을 그리므로
 * `?sc=` 딥링크로 첫 렌더부터 열면 수화 불일치(React #418)가 난다(qa-p2c-A 결함 #2). 수화 뒤에 고른 id 를 그대로 넘긴다.
 */
export const sheetIdAfterHydration = (sheetId: string | null, hydrated: boolean): string | null => (hydrated ? sheetId : null)

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
  if (o.checksHidden) return ROOM.summaryChecksHidden(o.total)
  const pos = stepPosition(o.stepIndex, o.stepCount)
  const expr = ROOM.summaryExpr(Math.min(o.usedCount, o.total), o.total)
  if (o.stepCount <= 0) return expr
  return pos === null ? ROOM.summarySteps(o.stepCount, expr) : ROOM.summaryStepAt(pos + 1, o.stepCount, expr)
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
  /** 화면 안에서만 쓰는 행 키(`withRowKeys`) — 서버로 보내지 않는다. 편집 폼이 순번이 아니라 이 키로 행을 가리킨다. */
  rowKey?: string
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
  /** 선생님 첫마디(D5=A) — null 과 한국어가 빈 값은 같은 뜻(첫마디 없음). */
  opening: OpeningValue | null
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

/* ── 상황 시트 행동 줄(S10) ───────────────────────────────────────────── */

/**
 * 시트 출처 — `isMine` + #179(`kind=SCENARIO`)의 내 버전 id. #179 를 못 읽으면(`overrides` null) 내 상황인지 내 버전인지 몰라
 * `MINE_UNSURE`(고치기만 — 내 버전을 「지우기」하면 기본까지 숨겨지는 #165 경로를 열지 않으려고).
 */
export type SheetOrigin = 'MINE' | 'SEED' | 'COPY' | 'MINE_UNSURE'

export interface SheetOverride {
  seedId: string
  state: string
  copyId: string | null
  orphan: boolean
}

export function sheetOrigin(s: Pick<ScenarioListItem, 'id' | 'isMine'>, overrides: readonly SheetOverride[] | null): SheetOrigin {
  if (!s.isMine) return 'SEED'
  if (!overrides) return 'MINE_UNSURE'
  return overrides.some((o) => o.state === 'COPIED' && !o.orphan && o.copyId === s.id) ? 'COPY' : 'MINE'
}

/** 내 버전 → 원본 시드 id(#176 `seedId`). */
export function seedIdOfCopy(copyId: string, overrides: readonly SheetOverride[] | null): string | null {
  return overrides?.find((o) => o.state === 'COPIED' && !o.orphan && o.copyId === copyId)?.seedId ?? null
}

/* ── 선생님 첫마디(공유 편집기 `OpeningField`, D5=A — screens.md §16-2) ─────── */

/**
 * 편집 값: 한국어(주 입력) · 선생님이 만든 일본어 · 그 일본어를 만든 때의 한국어(한 줄 정리) · 확인용 읽기(저장하지 않는다).
 * 저장 값은 지금과 같은 `{ja, ko}` 다.
 */
export interface OpeningValue {
  ko: string
  ja: string | null
  koAtJa: string | null
  reading: string | null
}

export const EMPTY_OPENING: OpeningValue = { ko: '', ja: null, koAtJa: null, reading: null }

/** `none` 첫마디 없음(저장 `opening:null`) · `koOnly` 일본어 아직 없음 · `stale` 한국어를 고침 · `matched` 저장 가능. 앞의 둘은 저장을 막는다. */
export type OpeningState = 'none' | 'koOnly' | 'stale' | 'matched'

export function openingState(o: OpeningValue | null | undefined): OpeningState {
  if (!o || !oneLine(o.ko)) return 'none'
  if (!o.ja) return 'koOnly'
  return oneLine(o.ko) === o.koAtJa ? 'matched' : 'stale'
}

/** 저장된 첫마디(#162 상세·#166 초안의 `{ja, ko}`) → 맞춤 상태. 일본어가 없으면 null. */
export function openingFromSaved(v: unknown): OpeningValue | null {
  if (!isObj(v) || typeof v.ja !== 'string' || !v.ja) return null
  const ko = str(v.ko)
  return { ko, ja: v.ja, koAtJa: oneLine(ko), reading: null }
}

/** 저장 본문 — 맞춤일 때만 `{ja, ko}`, 그 밖은 null(막힌 상태는 `validateDraft` 가 먼저 막는다). */
export function openingBody(o: OpeningValue | null | undefined): { ja: string; ko: string } | null {
  if (!o || openingState(o) !== 'matched' || !o.ja) return null
  return { ja: oneLine(o.ja), ko: oneLine(o.ko) }
}

/**
 * [일본어로 만들기]를 누를 수 있는지 — 한국어 없음·글자 넘침·역할 없음·역할 글자 넘침/꺾쇠(서버 400 `scenario.roles.*` 를 보내지 않게)이면 막는다.
 * `badRoles` 의 이유 문구는 `rolesProblem`(저장 검사와 같은 문구).
 */
export type OpeningBlock = 'noKo' | 'noRoles' | 'badRoles' | 'tooLong' | null
export function openingBlock(d: Pick<EditableDraft, 'opening' | 'learner' | 'tutor'>): OpeningBlock {
  const ko = oneLine(d.opening?.ko ?? '')
  if (!ko) return 'noKo'
  if (cpLength(ko) > L.openingKoMax) return 'tooLong'
  if (!oneLine(d.learner) || !oneLine(d.tutor)) return 'noRoles'
  if (rolesProblem(d)) return 'badRoles'
  return null
}

/** 역할 두 칸의 첫 문제 문구(길이는 서버와 같은 `SCENARIO_LIMITS.roleMax`·꺾쇠) — 없으면 null. 저장 검사(`validateDraft`)와 같은 `checkText` 를 쓴다. */
export function rolesProblem(d: Pick<EditableDraft, 'learner' | 'tutor'>): string | null {
  const p: DraftProblem[] = []
  checkText(p, 'learner', d.learner, L.roleMax, 'learner', false)
  checkText(p, 'tutor', d.tutor, L.roleMax, 'tutor', false)
  return p[0]?.message ?? null
}

/** 선택 칸은 서버 한도 안·꺾쇠 없음일 때만 싣는다(넘는 칸 하나로 400 이 나지 않게 — 그 칸은 저장 검사가 따로 알린다). */
function optional(raw: string, max: number): string | undefined {
  const t = oneLine(raw)
  return t && cpLength(t) <= max && !/[<>]/.test(t) ? t : undefined
}

/** #178 본문 — 지금 편집 중인 값으로(저장 전). */
export function openingRequestBody(d: EditableDraft, placeTitle: string | null) {
  const scenario: Record<string, unknown> = { level: d.level, roles: { learner: oneLine(d.learner), tutor: oneLine(d.tutor) } }
  const title = optional(d.title, L.titleMax)
  const titleJa = optional(d.titleJa, L.titleJaMax)
  const goal = optional(d.goalKo, L.goalMax)
  const place = placeTitle ? optional(placeTitle, 40) : undefined
  if (title) scenario.title = title
  if (titleJa) scenario.titleJa = titleJa
  if (goal) scenario.goal = goal
  if (place) scenario.placeTitle = place
  return { ko: oneLine(d.opening?.ko ?? ''), scenario }
}

/** #178 응답 → `{ja, reading, truncated}`. 일본어가 없으면 null(쓸 수 없는 응답 — 실패로 본다). */
export function openingDraftResult(raw: unknown): { ja: string; reading: string | null; truncated: boolean } | null {
  if (!isObj(raw) || typeof raw.ja !== 'string' || !raw.ja.trim()) return null
  const warnings = Array.isArray(raw.warnings) ? raw.warnings : []
  const reading = typeof raw.reading === 'string' && raw.reading.trim() && !warnings.includes('READING_DROPPED') ? raw.reading : null
  return { ja: raw.ja, reading, truncated: warnings.includes('JA_TRUNCATED') }
}

/** 받은 일본어를 넣는다 — 「맞춘 한국어」는 보낸 값(만드는 동안 한국어 칸은 읽기 전용). */
export function applyOpeningDraft(o: OpeningValue | null, sentKo: string, r: { ja: string; reading: string | null }): OpeningValue {
  return { ko: o?.ko ?? sentKo, ja: r.ja, koAtJa: sentKo, reading: r.reading }
}

/** 보관 값(새 모양 또는 예전 `{ja, ko}`) → 편집 값. */
function parseOpening(v: unknown): OpeningValue | null {
  if (!isObj(v)) return null
  if ('koAtJa' in v) {
    const nul = (x: unknown) => (typeof x === 'string' ? x : null)
    return { ko: str(v.ko), ja: nul(v.ja) || null, koAtJa: nul(v.koAtJa), reading: nul(v.reading) || null }
  }
  return openingFromSaved(v)
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
    opening: openingFromSaved(d.opening),
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
    opening: s.opening ? openingFromSaved(s.opening) : null,
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
    opening: openingBody(d.opening),
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

/* ── 표현 행 키(핵심 표현 편집기) ─────────────────────────────────────── */

export type KeyedExpression = DraftExpression & { rowKey: string }

/** 편집 폼 상태: 행 키 · 새 표현 넣기 · 닫힘. 행 키는 `id:`·`c` 로 시작해 이 값과 겹치지 않는다. */
export const NEW_EXPRESSION = 'new' as const
export type ExpressionEditing = string | null

const CLIENT_KEY = /^c(\d+)$/

function nextClientSeq(items: readonly DraftExpression[]): number {
  let n = 0
  for (const e of items) {
    const m = e.rowKey ? CLIENT_KEY.exec(e.rowKey) : null
    if (m) n = Math.max(n, Number(m[1]) + 1)
  }
  return n
}

/** 키 없는 행에 키를 붙인다 — 저장된 표현은 `id:<id>`, 그 밖은 `c<n>`. 겹치는 키는 새로 준다. 모두 맞으면 같은 배열. */
export function withRowKeys(items: DraftExpression[]): KeyedExpression[] {
  const taken = new Set<string>()
  const keep = items.map((e) => (e.rowKey && !taken.has(e.rowKey) ? (taken.add(e.rowKey), true) : false))
  if (keep.every(Boolean)) return items as KeyedExpression[]
  let n = nextClientSeq(items)
  const fresh = () => {
    while (taken.has(`c${n}`)) n++
    const k = `c${n++}`
    taken.add(k)
    return k
  }
  return items.map((e, i) => {
    if (keep[i]) return e as KeyedExpression
    const byId = e.id ? `id:${e.id}` : null
    const rowKey = byId && !taken.has(byId) ? (taken.add(byId), byId) : fresh()
    return { ...e, rowKey }
  })
}

/** 새 표현 행 키 — 지금 행의 `c<n>` 다음, 그리고 이 편집기가 이미 준 수(`floor`)보다 작지 않게(지운 행 키를 다시 쓰지 않는다). */
export function newRowKey(items: readonly DraftExpression[], floor = 0): string {
  return `c${Math.max(nextClientSeq(items), floor)}`
}

/** 열린 폼이 가리키는 행이 아직 있으면 그대로, 사라졌으면(지움·다시 만들기·복구) 닫는다. */
export function editingTarget(items: readonly DraftExpression[], editing: ExpressionEditing): ExpressionEditing {
  if (editing === null || editing === NEW_EXPRESSION) return editing
  return items.some((e) => e.rowKey === editing) ? editing : null
}

/** 행을 지운 뒤의 폼 상태 — 지운 행의 폼이면 닫고, 다른 행·새 표현 폼은 그대로 둔다. */
export function editingAfterRemove(editing: ExpressionEditing, removedKey: string): ExpressionEditing {
  return editing === removedKey ? null : editing
}

/** 키로 찾은 행 지우기. 최소 개수 아래로는 지우지 않는다(같은 배열). */
export function removeExpression(items: KeyedExpression[], key: string): KeyedExpression[] {
  if (items.length <= L.expressionsMin) return items
  const next = items.filter((e) => e.rowKey !== key)
  return next.length === items.length ? items : next
}

/** 키로 찾은 행만 바꾼다(없는 키면 같은 배열). 일본어가 바뀌면 저장된 읽기는 버린다(어긋난 읽기를 남기지 않게). 표현 id·행 키는 유지. */
export function editExpression(items: KeyedExpression[], key: string, v: { ja: string; ko: string }): KeyedExpression[] {
  let hit = false
  const next = items.map((e) => {
    if (e.rowKey !== key) return e
    hit = true
    const out: KeyedExpression = { ...(e.id ? { id: e.id } : {}), rowKey: e.rowKey, ja: v.ja, ko: v.ko }
    if (oneLine(e.ja) === oneLine(v.ja) && e.reading) out.reading = e.reading
    return out
  })
  return hit ? next : items
}

export function addExpression(items: KeyedExpression[], v: { ja: string; ko: string }, rowKey: string): KeyedExpression[] {
  return [...items, { rowKey, ja: v.ja, ko: v.ko }]
}

/* ── 검사 ─────────────────────────────────────────────────────────────── */

/** 화면 칸 열쇠: title·titleJa·place·level·learner·tutor·goal·criteria·criteria[i]·steps·steps[i]·expr·expr[i]·opening·openingKo·description·other. */
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
  if (field === 'opening.ko') return 'openingKo'
  if (field === 'opening' || field.startsWith('opening.')) return 'opening'
  if (field === 'topicIds' || field.startsWith('topicIds[')) return 'place'
  if (field === 'title' || field === 'titleJa' || field === 'level' || field === 'description') return field
  return 'other'
}

/** 화면 칸 열쇠 → 초점 받을 요소 id. */
export function problemDomId(key: string): string {
  return `dr-${key.replace(/\[(\d+)\]/, '-$1')}`
}

function checkText(p: DraftProblem[], key: string, raw: string, max: number, label: FieldLabelKey, required: boolean) {
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
  checkText(p, 'title', d.title, L.titleMax, 'title', true)
  checkText(p, 'titleJa', d.titleJa, L.titleJaMax, 'titleJa', false)
  checkText(p, 'learner', d.learner, L.roleMax, 'learner', true)
  checkText(p, 'tutor', d.tutor, L.roleMax, 'tutor', true)
  checkText(p, 'goal', d.goalKo, L.goalMax, 'goal', true)
  if (d.steps.length < L.stepsMin) p.push({ key: 'steps', message: CHECK.listMin('step', L.stepsMin) })
  else if (d.steps.length > L.stepsMax) p.push({ key: 'steps', message: CHECK.listMax('step', L.stepsMax) })
  d.steps.forEach((s, i) => checkText(p, `steps[${i}]`, s, L.stepMax, 'step', true))
  if (d.criteria.length < L.successCriteriaMin) p.push({ key: 'criteria', message: CHECK.listMin('criterion', L.successCriteriaMin) })
  else if (d.criteria.length > L.successCriteriaMax) p.push({ key: 'criteria', message: CHECK.listMax('criterion', L.successCriteriaMax) })
  d.criteria.forEach((s, i) => checkText(p, `criteria[${i}]`, s, L.successCriterionMax, 'criterion', true))
  if (d.expressions.length < L.expressionsMin) p.push({ key: 'expr', message: CHECK.listMin('expressions', L.expressionsMin) })
  else if (d.expressions.length > L.expressionsMax) p.push({ key: 'expr', message: CHECK.listMax('expressions', L.expressionsMax) })
  const seen = new Set<string>()
  d.expressions.forEach((e, i) => {
    const before = p.length
    checkText(p, `expr[${i}]`, e.ja, L.expressionJaMax, 'exprJa', true)
    if (p.length === before) checkText(p, `expr[${i}]`, e.ko, L.expressionKoMax, 'exprKo', true)
    const ja = oneLine(e.ja)
    if (p.length === before && ja && seen.has(ja)) p.push({ key: `expr[${i}]`, message: CHECK.duplicate })
    if (ja) seen.add(ja)
  })
  // 첫마디: 한국어 칸 → 일본어 맞추기(맞추지 않으면 저장 막음 — 초점은 [일본어로 만들기] 버튼 `dr-opening`).
  const st = openingState(d.opening)
  if (d.opening && st !== 'none') {
    checkText(p, 'openingKo', d.opening.ko, L.openingKoMax, 'openingKo', true)
    if (st === 'koOnly') p.push({ key: 'opening', message: OPENING.problemKoOnly })
    else if (st === 'stale') p.push({ key: 'opening', message: OPENING.problemStale })
  }
  return dedupe(p)
}

function dedupe(p: DraftProblem[]): DraftProblem[] {
  const seen = new Set<string>()
  return p.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)))
}

/** 400 `details.problems[]`(없으면 `{field, reason}`) → 화면 칸 문제. 문구는 `failure.ts` 고정 문구(서버 `message` 는 쓰지 않는다). */
export function serverProblems(ctx: ScenarioFailContext, details: Record<string, unknown>): DraftProblem[] {
  return dedupe(scenarioFieldFailures(ctx, details).map((x) => ({ key: problemKey(x.field), message: x.text })))
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

/**
 * S3(초안 만들기 #166) 실패 → 화면 문구(`failure.ts` 문맥 `scenarioDraft`). 벽시계 초과는 일반 실패로 본다.
 * `kind:'field'` 의 `problems` 가 상황 설명 칸이면 묻기 칸 아래, 그 밖이면 상자에 보인다.
 */
export function genFailureOf(err: Err, timedOut: boolean): ScenarioFailure {
  if (timedOut) return scenarioFailure('scenarioDraft', { ...err, status: 504 })
  return scenarioFailure('scenarioDraft', err)
}

export type SaveFailure =
  | { kind: 'invalid'; problems: DraftProblem[] }
  | { kind: 'gone' }
  | { kind: 'copied'; text: string }
  | { kind: 'seedGone'; text: string }
  | { kind: 'message'; text: string; block: boolean }

/**
 * S4(#163 만들기·#164 고치기·#175 내 버전 저장) 실패 → 화면 상태. 400 = 칸 문제(고정 문구) · 404·409 ARCHIVED = 고칠 수 없음(#164) ·
 * #175 409 ALREADY_COPIED = 다른 화면이 먼저 만듦 · 404 = 기본 항목 없음 · 그 밖 = 한도·잠시 뒤·실패 고정 문구.
 */
export function saveFailureOf(err: Err, ctx: 'scenarioSave' | 'scenarioEdit' | 'scenarioFork' = 'scenarioSave'): SaveFailure {
  const f = scenarioFailure(ctx, err)
  if (f.kind === 'field') {
    const problems = serverProblems(ctx, err.details)
    return problems.length ? { kind: 'invalid', problems } : { kind: 'message', text: f.text, block: false }
  }
  if (f.kind === 'gone') return { kind: 'gone' }
  if (f.kind === 'copied') return { kind: 'copied', text: f.text }
  if (f.kind === 'seedGone') return { kind: 'seedGone', text: f.text }
  return { kind: 'message', text: f.text, block: f.block }
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
    opening: parseOpening(v.opening),
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

/* ── 역할극 방(B2 — 가이드 §3-D·§3-F·§5 `useRolePlay` 의 순수 부분) ─────── */

/** 진행 값 합치기 — 받은 값 중 최댓값(표현은 합집합, 단계는 큰 쪽). 선생님 판단이 뒤로 가도 화면은 되돌리지 않는다. 표현 목록에 없는 id 는 버린다. */
export function mergeProgress(prev: RolePlayProgress | null | undefined, next: RolePlayProgress | null | undefined, order: readonly { id: string }[]): RolePlayProgress {
  const used = new Set<string>()
  for (const p of [prev, next]) for (const id of Array.isArray(p?.usedIds) ? p.usedIds : []) if (typeof id === 'string') used.add(id)
  const steps = [prev?.stepIndex, next?.stepIndex].filter((s): s is number => typeof s === 'number' && Number.isInteger(s) && s >= 0)
  return { usedIds: order.filter((e) => used.has(e.id)).map((e) => e.id), stepIndex: steps.length ? Math.max(...steps) : null }
}

/** 이번에 새로 생긴 ✓·단계 이동 → 스크린리더 한 줄씩(표현 목록 순서, 단계는 마지막). */
export function progressNews(prev: RolePlayProgress, next: RolePlayProgress, view: Pick<RolePlayChatView, 'keyExpressions' | 'steps'>): string[] {
  const before = new Set(prev.usedIds)
  const out = view.keyExpressions.filter((e) => next.usedIds.includes(e.id) && !before.has(e.id)).map((e) => ROOM.usedAnnounce(e.ja))
  const a = stepPosition(prev.stepIndex, view.steps.length)
  const b = stepPosition(next.stepIndex, view.steps.length)
  if (b !== null && (a === null || b > a)) out.push(ROOM.stepAnnounce(view.steps[b].ko))
  return out
}

/** 학습자 말 수(보내는 중인 임시 말 포함 — "첫 말을 보낸 뒤" 자동 접힘 기준). */
export function learnerTurns(messages: readonly Pick<ChatMessageView, 'role'>[]): number {
  let n = 0
  for (const m of messages) if (m.role === 'USER') n++
  return n
}

/** 대답 연습을 붙일 선생님 말 — 마지막 메시지가 끝난(DONE) 선생님 말일 때만 그 id. */
export function practiceTargetOf(messages: readonly Pick<ChatMessageView, 'id' | 'role' | 'status' | 'localStatus'>[]): string | null {
  const last = messages[messages.length - 1]
  return last && last.role === 'ASSISTANT' && last.status === 'DONE' && !last.localStatus ? last.id : null
}

/** 목표 카드 자동 접힘(가이드 §3-D) — 첫 말을 보낸 뒤 한 번. 사용자가 직접 펼쳤거나 카드 안에 초점이 있으면 접지 않는다. */
export function shouldAutoCollapse(o: { turns: number; alreadyDone: boolean; userOpened: boolean; goalOpen: boolean; focusInside: boolean }): boolean {
  return o.turns >= 1 && !o.alreadyDone && !o.userOpened && o.goalOpen && !o.focusInside
}

/**
 * 자동 접힘 한 걸음 — 방이 학습자 말 수가 바뀔 때마다 부른다. 첫 말(≥1)을 본 순간 딱 한 번 판단하고(`done` 이 true 가 됨),
 * 그때 카드 안 초점·직접 펼침 때문에 접지 않았어도 다시 판단하지 않는다(가이드 §3-D "한 번만"). 다시 들어온 방(이미 말 ≥1)도 첫 판단에서 끝난다.
 */
export function autoCollapseStep(done: boolean, o: { active: boolean; turns: number; userOpened: boolean; goalOpen: boolean; focusInside: boolean }): { done: boolean; collapse: boolean } {
  if (done || !o.active || o.turns < 1) return { done, collapse: false }
  return { done: true, collapse: shouldAutoCollapse({ ...o, alreadyDone: false }) }
}

export type FlightResult<T> = { ran: false } | { ran: true; ok: true; value: T } | { ran: true; ok: false; error: unknown }

/**
 * 한 번에 하나만 도는 요청(마치기 #167·그만두기 #31) — 도는 중에 다시 부르면 아무것도 하지 않는다(`ran:false`).
 * 실패하면 풀려 [다시 시도]로 다시 부를 수 있고, 성공하면 `hold` 면 잠긴 채 둔다(결과 화면으로 넘어가는 동안 두 번째 요청이 나가지 않게).
 */
export function createSingleFlight() {
  let busy = false
  return {
    isBusy: () => busy,
    async run<T>(work: () => Promise<T>, hold: boolean): Promise<FlightResult<T>> {
      if (busy) return { ran: false }
      busy = true
      try {
        const value = await work()
        if (!hold) busy = false
        return { ran: true, ok: true, value }
      } catch (error) {
        busy = false
        return { ran: true, ok: false, error }
      }
    },
  }
}

/** [마치기] 를 지금 누를 수 없는 이유(없으면 null). 순서: 방 준비 → 녹음·인식 → 턴 진행. */
export function endBlockedReason(o: { ready: boolean; listening: boolean; turnBusy: boolean }): string | null {
  if (!o.ready) return ROOM.endWhileLoading
  if (o.listening) return ROOM.endWhileListening
  if (o.turnBusy) return ROOM.endWhileTurn
  return null
}

export type FinishFailure = 'noTurns' | 'busy' | 'fail'

/** #167 실패 → 시트 상태. 409 NO_TURNS = 빈 대화 시트 · 409 TURN_RUNNING(그 밖 409 도) = 토스트 · 그 밖(0·5xx·429·400·404) = 기록 실패(다시 시도). */
export function finishFailureOf(err: Err): FinishFailure {
  if (err.status === 409) return err.details.reason === 'NO_TURNS' ? 'noTurns' : 'busy'
  return 'fail'
}

/** 턴 거절이 "마친 역할극"(#32 409 ROLEPLAY_ENDED)인가. */
export function isRolePlayEndedRejection(status: number, details: Record<string, unknown> | null | undefined): boolean {
  return status === 409 && details?.reason === 'ROLEPLAY_ENDED'
}

/* ── 방 동작 흐름(REV-141 L-6) — 훅(`useRolePlay`)은 부수 효과(요청·상태·이동)만 넘기고 판단은 여기서 한다. 단위 시험이 훅 없이 배선을 본다. ── */

export type SingleFlight = ReturnType<typeof createSingleFlight>
export type EndSheetPhase = 'confirm' | 'empty' | 'busy' | 'fail' | 'quitting'
export interface EndSheetState {
  open: boolean
  phase: EndSheetPhase
}

/** [마치기] 를 눌렀을 때 시트 단계 — 내 말이 없으면 빈 대화 시트(그만두기), 있으면 확인. */
export function endSheetPhaseFor(turns: number): 'confirm' | 'empty' {
  return turns > 0 ? 'confirm' : 'empty'
}

/** 시트 닫기 — 기록·삭제 요청이 도는 중에는 닫지 않는다(서버 결과를 받아 다음 상태로 간다). */
export function closedEndSheet(s: EndSheetState, busy: boolean): EndSheetState {
  return busy ? s : { open: false, phase: s.phase }
}

/** 시트가 실제로 보이는가·닫을 수 있는가. 마친 역할극에서는 열리지 않는다(마친 바가 대신 선다). 정리·삭제 중에는 닫기 막음. */
export function endSheetFlags(s: EndSheetState, o: { active: boolean; ended: boolean }): { open: boolean; dismissible: boolean; empty: boolean; working: boolean } {
  const working = s.phase === 'busy' || s.phase === 'quitting'
  return { open: s.open && o.active && !o.ended, dismissible: !working, empty: s.phase === 'empty' || s.phase === 'quitting', working }
}

/**
 * 마치기(#167) 흐름. 성공하면 잠근 채 결과 화면으로 간다(넘어가는 동안 "정리 중" 유지·두 번째 요청 없음 — 서버도 멱등).
 * 409 NO_TURNS = 빈 대화 시트 · 그 밖 409(TURN_RUNNING) = 시트 닫고 토스트 · 그 밖 = 시트 안 [다시 시도].
 */
export async function runFinish(fx: { flight: SingleFlight; post: () => Promise<unknown>; setSheet: (s: EndSheetState) => void; toResult: () => void; notify: (msg: string) => void }): Promise<void> {
  const r = await fx.flight.run(() => {
    fx.setSheet({ open: true, phase: 'busy' })
    return fx.post()
  }, true)
  if (!r.ran) return
  if (r.ok) {
    fx.toResult()
    return
  }
  const f = finishFailureOf(toErr(r.error))
  if (f === 'noTurns') fx.setSheet({ open: true, phase: 'empty' })
  else if (f === 'busy') {
    fx.setSheet({ open: false, phase: 'confirm' })
    fx.notify(ROOM.endWhileTurn)
  } else fx.setSheet({ open: true, phase: 'fail' })
}

/**
 * 0턴 [그만두기](D-7) 흐름 — 빈 대화를 #31 로 지우고 시나리오로. 지웠으면 `leave(true)`(홈이 "그만뒀어요"를 한 번 보인다),
 * 이미 없으면(404) `leave(false)`. 그 밖 실패는 빈 시트로 돌아가 토스트(연결 실패는 `connText`, 나머지 `END.quitFail`).
 */
export async function runQuit(fx: { flight: SingleFlight; del: () => Promise<unknown>; setSheet: (s: EndSheetState) => void; leave: (quitNotice: boolean) => void; notify: (msg: string) => void; connText: (err: Err) => string }): Promise<void> {
  const r = await fx.flight.run(() => {
    fx.setSheet({ open: true, phase: 'quitting' })
    return fx.del()
  }, true)
  if (!r.ran) return
  if (r.ok) {
    fx.leave(true)
    return
  }
  const err = toErr(r.error)
  if (err.status === 404) {
    fx.leave(false)
    return
  }
  fx.setSheet({ open: true, phase: 'empty' })
  fx.notify(err.status === 0 ? fx.connText(err) : END.quitFail)
}

/** 시나리오 홈이 받는 그만두기 안내 — 방이 남긴 한 번짜리 값이 '1' 일 때만 문구. */
export function quitNoticeOf(raw: string | null): string | null {
  return raw === '1' ? END.quitDone : null
}

/** #29 다시 읽기(409 ROLEPLAY_ENDED·연습 ENDED 뒤) — 역할극 칸이 있으면 방 값을 바꾼다. 실패는 조용히(다음 조회 때 맞춰짐). */
export async function reloadRolePlay(get: () => Promise<Pick<ChatDetail, 'chat'>>, set: (v: RolePlayChatView) => void): Promise<void> {
  try {
    const r = await get()
    if (r.chat.scenario) set(r.chat.scenario)
  } catch {
    /* 다음 조회 때 맞춰진다 */
  }
}

/** #32 done 하나 반영 — 진행 값을 최댓값 규칙으로 합치고, 새 ✓·단계 이동이 있으면 스크린리더 한 줄(여러 소식은 한 번에 — 방의 칸이 한 줄이다). */
export function applyDone(v: Pick<RolePlayChatView, 'keyExpressions' | 'steps'> | null, prev: RolePlayProgress, dn: Pick<TurnDoneEvent, 'scenario'>, fx: { set: (p: RolePlayProgress) => void; announce: (msg: string) => void }): RolePlayProgress {
  if (!v || !dn.scenario) return prev
  const next = mergeProgress(prev, dn.scenario, v.keyExpressions)
  fx.set(next)
  const news = progressNews(prev, next, v)
  if (news.length) fx.announce(news.join(' '))
  return next
}

/**
 * 폴링·동기는 `chat.scenario` 를 통째로 바꾸는데 그 응답(`after` 있음)에는 `lesson` 칸이 없다(REV-141 L-2) — 같은 역할극이면 처음 받은 수업 연결을
 * 그대로 둔다("오늘 수업에서 이어져요"가 사라지지 않게). 바꿀 것이 없으면 받은 값을 그대로 돌려준다(같은 객체).
 */
export function withKeptLesson(v: RolePlayChatView | null, kept: { id: string; lesson: NonNullable<RolePlayChatView['lesson']> } | null): RolePlayChatView | null {
  if (!v || v.lesson || !kept || kept.id !== v.id) return v
  return { ...v, lesson: kept.lesson }
}

/** 키보드가 막 열렸을 때 펼친 목표 카드를 접는가(REV-141 M-1) — 카드 안에 초점이 있으면 접지 않는다(자동 접힘과 같은 규칙). */
export function keyboardCollapse(o: { kbOpen: boolean; goalOpen: boolean; focusInside: boolean }): boolean {
  return o.kbOpen && o.goalOpen && !o.focusInside
}
