/**
 * 계획표 성장 탭의 순수 계산(task-080, screens.md §36-6 D·E — 화면이 하는 것). 숫자 판정(단계·추세·표본 기준)은 서버(#78)가 하고,
 * 여기서는 날짜 글·칸 상태·막대 눈금·읽기 줄·안내 고르기만 한다. 오늘은 응답 `range.today`(자정 넘김 대비 — 달력 `cal.data.today` 와 같은 방식).
 * 날짜는 KST 달력 문자열(`YYYY-MM-DD`)이고 계산은 `infra/dates` 로만 한다(기기 시간대 무관).
 */
import { addDays, countDays } from '@/modules/infra/dates'
import { DIM_NAME, DIM_ORDER, KIND_NAME } from '@/components/eval/evalCopy'
import type { EvalKind } from '@/types/evaluation'
import type { GrowthDay, GrowthEvaluation, GrowthResponse, GrowthSkill, GrowthWeek, GrowthWeeks } from '@/types/plan'
import { GROWTH_WEEKS } from '@/types/plan'
import { AXES, GROWTH, METRICS, type MetricKey, type Rich } from './growthCopy'
import { weekdayOf } from './logic'

const WD = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 차트 색 — 새 색 없이 `--protein` 과 `--surface` 혼합 단계(36-11, Leader 결정 L5). 라이트·다크는 토큰이 바뀌어 따라간다. */
export const GROWTH_TONE = {
  c1: 'color-mix(in srgb, var(--color-protein) 55%, var(--color-surface))',
  c2: 'color-mix(in srgb, var(--color-protein) 78%, var(--color-surface))',
  c3: 'var(--color-protein)',
  empty: 'var(--color-surface2)',
} as const

// ── 주소 ─────────────────────────────────────────────────────────────────────

export const DEFAULT_WEEKS: GrowthWeeks = 4

export function parseGrowthWeeks(v: string | null | undefined): GrowthWeeks {
  const n = Number(v)
  return (GROWTH_WEEKS as readonly number[]).includes(n) ? (n as GrowthWeeks) : DEFAULT_WEEKS
}

/** 기본값(4주)이면 주소에 쓰지 않는다. */
export function growthUrl(weeks: GrowthWeeks): string {
  return weeks === DEFAULT_WEEKS ? '/plan/growth' : `/plan/growth?weeks=${weeks}`
}

// ── 날짜 글 ──────────────────────────────────────────────────────────────────

/** `10월 4일`(앞 0 없음). */
export function mdOf(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`
}

/** `10/4`. */
export function slOf(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

/** 요일 한 글자(일~토). */
export function wdOf(date: string): string {
  return WD[weekdayOf(date)]
}

/** 지난 주 끝(토요일) 글 — 같은 달이면 `D일`, 아니면 `M월 D일`. */
export function weekEndLabel(weekStart: string): string {
  const end = addDays(weekStart, 6)
  return end.slice(5, 7) === weekStart.slice(5, 7) ? `${Number(end.slice(8, 10))}일` : mdOf(end)
}

/** 기록 시작이 기간 첫날보다 늦다 — 기간 줄 꼬리·«공부한 날» 보조 글을 고른다. */
export function isLate(since: string | null, from: string): since is string {
  return since !== null && since > from
}

export function rangeText(range: { from: string }, since: string | null): string {
  return GROWTH.rangeLine(mdOf(range.from)) + (isLate(since, range.from) ? GROWTH.rangeLate(mdOf(since)) : '')
}

// ── 숫자 카드 ────────────────────────────────────────────────────────────────

export interface Tile {
  label: string
  value: number
  sub: string
}

export function summaryTilesOf(data: Pick<GrowthResponse, 'range' | 'since' | 'summary'>): Tile[] {
  const { range, since, summary } = data
  const today = range.today
  const wd = wdOf(today)
  return [
    { label: GROWTH.tileStreak, value: summary.streak, sub: GROWTH.tileStreakSub(summary.longestStreak) },
    {
      label: GROWTH.tileStudy,
      value: summary.studyDays,
      sub: isLate(since, range.from) ? GROWTH.tileStudySubLate(countDays(since, today)) : GROWTH.tileStudySub(mdOf(range.from)),
    },
    { label: GROWTH.tileWeek, value: summary.thisWeekStudyDays, sub: wd === '일' ? GROWTH.tileWeekSubSun : GROWTH.tileWeekSub(wd) },
  ]
}

// ── 적음 안내(36-6 E) ────────────────────────────────────────────────────────

/**
 * 단계가 보이는 축(줄 모양 `stage`)이 1개 이하일 때만. `since=null`(기록 0)이면 안내 없음.
 * `enough` 로 세지 않는다 — 한쪽 증거 축은 `enough` 이지만 단계가 숨겨져, 세면 바로 아래 «아직 판단하기 일러요» 줄과 모순이다(36-6 E · 정정 ⑯ ⓑ).
 */
export function fewNoteOf(data: Pick<GrowthResponse, 'range' | 'since' | 'skills'>): Rich | null {
  if (data.since === null) return null
  const shown = AXES.filter((a) => data.skills.some((s) => s.axis === a.axis && rowShapeOf(s) === 'stage'))
  if (shown.length > 1) return null
  const head = GROWTH.fewNote(countDays(data.since, data.range.today))
  return shown.length === 1 ? [head, ...GROWTH.fewNoteAxis(shown[0].name, shown[0].josa)] : [head + GROWTH.fewNoteEnd]
}

// ── 체크내역 ─────────────────────────────────────────────────────────────────

export type CellState = 'future' | 'pre' | 'k3' | 'k2' | 'k1' | 'att' | 'none'

/**
 * 칸 상태 — 먼저 맞는 것: 미래(이번 주 남은 날) → 기록 전 → 3·2·1단 → 출석만 → 안 함.
 * `since=null`(기록 0)은 오늘을 시작으로 본다 — 오늘 칸만 «안 함»으로 보이고 나머지는 비운다(36-4 ⑧).
 */
export function stripCellState(date: string, today: string, since: string | null, day: GrowthDay | undefined): CellState {
  if (date > today) return 'future'
  if (date < (since ?? today)) return 'pre'
  const kinds = day?.kinds ?? 0
  if (kinds >= 3) return 'k3'
  if (kinds === 2) return 'k2'
  if (kinds === 1) return 'k1'
  if (day?.attended) return 'att'
  return 'none'
}

export interface StripColumn {
  weekStart: string
  cells: { date: string; state: CellState; kinds: number }[]
  /** 주 시작일 `M/D`. */
  sl: string
  /** 첫 열이거나 달이 바뀐 열이면 `M월`, 아니면 null. */
  month: string | null
}

export function stripColumnsOf(data: Pick<GrowthResponse, 'range' | 'since' | 'days' | 'weeks'>): StripColumn[] {
  const byDate = new Map(data.days.map((d) => [d.date, d]))
  const today = data.range.today
  return data.weeks.map((w, j) => {
    const m = Number(w.weekStart.slice(5, 7))
    const prevM = j > 0 ? Number(data.weeks[j - 1].weekStart.slice(5, 7)) : null
    const cells = Array.from({ length: 7 }, (_, k) => {
      const date = addDays(w.weekStart, k)
      const day = byDate.get(date)
      return { date, state: stripCellState(date, today, data.since, day), kinds: day?.kinds ?? 0 }
    })
    return { weekStart: w.weekStart, cells, sl: slOf(w.weekStart), month: j === 0 || m !== prevM ? GROWTH.monthLabel(m) : null }
  })
}

/** 그림 숨김 요약에 쓰는 수 — 칸 상태 그대로 센다(그림과 같은 값). */
export function stripCounts(cols: StripColumn[]): { studied: number; attendOnly: number } {
  let studied = 0
  let attendOnly = 0
  for (const c of cols)
    for (const cell of c.cells) {
      if (cell.state === 'k1' || cell.state === 'k2' || cell.state === 'k3') studied++
      else if (cell.state === 'att') attendOnly++
    }
  return { studied, attendOnly }
}

export interface StripRow {
  week: string
  studied: string
  attendOnly: string
}

/** [주별로 보기] 표 — 최근 주가 위. 그 주 전체가 기록 전이면 «기록 전»/빈칸. */
export function stripRowsOf(cols: StripColumn[], weeks: GrowthWeek[]): StripRow[] {
  const rows = cols.map((c, j) => {
    const before = weeks[j]?.before ?? false
    const thisWeek = j === cols.length - 1
    if (before) return { week: GROWTH.weekCell(c.sl, thisWeek), studied: GROWTH.stripBefore, attendOnly: '' }
    const ds: string[] = []
    const as: string[] = []
    c.cells.forEach((cell, k) => {
      if (cell.state === 'k1' || cell.state === 'k2' || cell.state === 'k3') ds.push(`${WD[k]}(${cell.kinds})`)
      else if (cell.state === 'att') as.push(WD[k])
    })
    return { week: GROWTH.weekCell(c.sl, thisWeek), studied: ds.length ? ds.join(' ') : GROWTH.stripNone, attendOnly: as.length ? as.join(' ') : GROWTH.stripNoAttend }
  })
  return rows.reverse()
}

// ── 주마다 공부량 ────────────────────────────────────────────────────────────

export function metricOf(key: MetricKey) {
  return METRICS.find((m) => m.key === key) ?? METRICS[0]
}

/** 지표 값 — `before` 주는 null(«기록 전»). */
export function metricValue(week: GrowthWeek, key: MetricKey): number | null {
  if (week.before) return null
  switch (key) {
    case 'days':
      return week.studyDays
    case 'words':
      return week.words.sessions
    case 'lessons':
      return week.lessons
    case 'reviews':
      return week.reviews
    case 'turns':
      return week.talkTurns + week.chatTurns
    case 'corr':
      return week.correctionsAccepted
  }
}

export function niceStep(m: number): number {
  if (m <= 5) return 1
  if (m <= 10) return 2
  if (m <= 25) return 5
  if (m <= 50) return 10
  return 20
}

/** 눈금 간격과 위 끝 — 최댓값을 눈금 배수로 올린다(값이 모두 0·기록 전이면 1). */
export function barScale(vals: readonly (number | null)[]): { step: number; max: number } {
  const max0 = Math.max(1, ...vals.map((v) => v ?? 0))
  const step = niceStep(max0)
  return { step, max: Math.ceil(max0 / step) * step }
}

/** x 라벨 — 4주 이하 모두 · 8주 이하 둘에 하나 · 그 밖 셋에 하나(마지막에서 거꾸로 센다). */
export function barLabelShown(j: number, n: number): boolean {
  const every = n <= 4 ? 1 : n <= 8 ? 2 : 3
  return (n - 1 - j) % every === 0
}

/** 막대 그림을 누른 x(그림 좌표) → 주 번호. 기간 밖이면 null. */
export function barPick(x: number, padL: number, slot: number, n: number): number | null {
  const j = Math.floor((x - padL) / slot)
  return j >= 0 && j < n ? j : null
}

/** 고른 주 — `key` = 보이는 기간(주 수·첫 주), `j` = 고른 주 번호(null = 이번 주). */
export interface WeekPick {
  key: string
  j: number | null
}

export function weekKeyOf(weeks: readonly GrowthWeek[]): string {
  return `${weeks.length}|${weeks[0]?.weekStart ?? ''}`
}

/**
 * 보이는 기간이 바뀌면 고른 주를 비운다(36-6 D). 기간마다 고른 주를 기억하지 않는다 —
 * 4→8→4 처럼 같은 기간으로 돌아와도(캐시로 바로 와도) 이번 주로 보인다.
 */
export function syncWeekPick(p: WeekPick, key: string): WeekPick {
  return p.key === key ? p : { key, j: null }
}

/** 지금 보이는 주 번호 — 고른 값이 기간 밖이면(음수 포함) 이번 주(마지막). */
export function selectedWeekOf(p: WeekPick, n: number): number {
  return p.j !== null && p.j >= 0 && p.j < n ? p.j : n - 1
}

/** ‹ › 한 칸 이동 — 끝 칸에서는 null(눌러도 아무 일 없음, `weeks[-1]` 같은 밖 번호를 만들지 않는다). */
export function stepWeek(sel: number, dir: -1 | 1, n: number): number | null {
  const j = sel + dir
  return j >= 0 && j < n ? j : null
}

/** 앞쪽 «기록 전» 주 수(막대 그림의 회색 구역). */
export function leadingBefore(vals: readonly (number | null)[]): number {
  const i = vals.findIndex((v) => v !== null)
  return i < 0 ? vals.length : i
}

/** 읽기 줄 — 보이는 글(«(일)~(토)» 짧은 꼴)과 낭독 글(«일요일부터 … 토요일까지»). */
export function readLineOf(
  weekStart: string,
  thisWeek: boolean,
  today: string,
  key: MetricKey,
  value: number | null,
): { visible: Rich; sr: string } {
  const m = metricOf(key)
  const md = mdOf(weekStart)
  const when = thisWeek ? GROWTH.readThisWeek(md, wdOf(today)) : GROWTH.readPastWeek(md, weekEndLabel(weekStart))
  const whenSr = thisWeek ? GROWTH.readThisWeekSr(md, wdOf(today)) : GROWTH.readPastWeekSr(md, weekEndLabel(weekStart))
  if (value === null) return { visible: [`${when} · ${GROWTH.readBefore}`], sr: `${whenSr}, ${GROWTH.readBefore}` }
  const what = GROWTH.readValue(m.label, value, m.unit)
  return { visible: [`${when} · `, { b: what }], sr: `${whenSr}, ${what}` }
}

// ── 공부결과 ─────────────────────────────────────────────────────────────────

/** 축 순서대로 메타 + 서버 값(없는 축은 그리지 않는다). */
export function axisRowsOf(skills: GrowthSkill[]) {
  return AXES.flatMap((meta) => {
    const s = skills.find((x) => x.axis === meta.axis)
    return s ? [{ meta, skill: s }] : []
  })
}

/** 공부결과 한 줄의 모양 — 기록 전 · 표본 부족(진행선) · 한쪽 증거(진행선·숫자 없음) · 단계. */
export type RowShape = 'none' | 'wait' | 'oneSided' | 'stage'

/**
 * 줄 모양 순서(36-4 — 먼저 맞는 하나): 기록 전 → 표본 부족(`!enough`) → 한쪽 증거(`enough && oneSided`) → 단계 → 그 밖(서버 어긋남) 표본 부족.
 * 표본 부족이 한쪽 증거보다 먼저다 — 건수가 차기 전에는 진행선과 «N건이 되면…» 을 보인다.
 * 한쪽 증거를 표본 부족 줄로 보내면 «관측 119건 · 3일에 걸쳐 모이면…(지금 3일)» 같은 자기모순 문장이 된다(정정 ⑯ ⓐ).
 */
export function rowShapeOf(s: GrowthSkill): RowShape {
  if (!s.recorded) return 'none'
  if (!s.enough) return 'wait'
  if (s.oneSided) return 'oneSided'
  if (s.stage !== null) return 'stage'
  return 'wait'
}

/** 아직 단계 전 줄 글 — 역할극 수 / 건수 부족 / 건수는 되는데 날짜 부족. */
export function waitLineOf(s: GrowthSkill): string {
  if (s.unit === 'SESSION') return GROWTH.needSession(s.n, s.min)
  if (s.n < s.min || s.minDays === null) return GROWTH.needCount(s.n, s.min)
  return GROWTH.needDays(s.n, s.obsDays, s.minDays)
}

/** 진행선 0~1. */
export function progressOf(s: GrowthSkill): number {
  if (s.min <= 0) return 1
  if (s.unit === 'SESSION' || s.n < s.min || s.minDays === null || s.minDays <= 0) return Math.min(s.n, s.min) / s.min
  return Math.min(s.obsDays, s.minDays) / s.minDays
}

export function countLineOf(s: GrowthSkill): string {
  return s.unit === 'SESSION' ? GROWTH.countLineSession(s.n, s.success) : GROWTH.countLine(s.n, s.success, s.partial, s.fail, s.skipped)
}

/** 작은 추이선 — 8주 이상 · 단계가 보이는 축 · 점 4개 이상. */
export function showSpark(weeksCount: number, s: GrowthSkill): boolean {
  return weeksCount >= 8 && s.recorded && s.enough && s.spark.length >= 4
}

/** [단계는 이렇게 정해요] 4번째 줄의 숫자(서버 `min` — 없으면 Q3 A 기준). */
export function minsOf(skills: GrowthSkill[]): { min: number; minSession: number } {
  return {
    min: skills.find((s) => s.unit === 'OBSERVATION')?.min ?? 20,
    minSession: skills.find((s) => s.unit === 'SESSION')?.min ?? 5,
  }
}

// ── AI 평가 ──────────────────────────────────────────────────────────────────

export const EVAL_KIND_ORDER: readonly EvalKind[] = ['TALK', 'WORDS']

/**
 * 기간 안 종류(회화 → 단어 순)와 고른 종류. 고른 종류가 새 기간에 없으면 첫째. 목록의 마지막 = 최근, 2개 이상이면 첫째 = «이 기간 처음».
 */
export function evalPick(evaluations: GrowthEvaluation[], chosen: EvalKind | null) {
  const kinds = EVAL_KIND_ORDER.filter((k) => evaluations.some((e) => e.kind === k))
  const kind = chosen !== null && kinds.includes(chosen) ? chosen : (kinds[0] ?? null)
  const list = kind ? evaluations.filter((e) => e.kind === kind) : []
  const last = list.length ? list[list.length - 1] : null
  const first = list.length > 1 ? list[0] : null
  return { kinds, kind, list, last, first }
}

export function rubricValues(e: GrowthEvaluation): number[] {
  return DIM_ORDER.map((d) => e.rubric[d])
}

/** 레이더 숨김 글. */
export function evalSrOf(kind: EvalKind, last: GrowthEvaluation, first: GrowthEvaluation | null): string {
  const part = (label: string, e: GrowthEvaluation) =>
    GROWTH.evalSrPart(label, mdOf(e.date), e.totalScore, DIM_ORDER.map((d) => GROWTH.evalSrDim(DIM_NAME[d], e.rubric[d])).join(', '))
  return `${KIND_NAME[kind]} ${part(GROWTH.evalSrRecent, last)}${first ? `. ${part(GROWTH.evalSrFirst, first)}` : ''}. ${GROWTH.evalSrEnd}`
}

/** 평가가 기간 밖에만 있을 때 둘째 줄 «기간을 늘리면…» — 12주(최대)에서는 거짓 안내라 뺀다(36-17 ⑥). */
export function showEvalNoneBody(weeksCount: number): boolean {
  return weeksCount < 12
}
