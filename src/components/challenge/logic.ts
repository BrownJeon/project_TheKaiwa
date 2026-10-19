/**
 * 챌린지 화면(task-043 T3)의 순수 로직 — 응답(`@/types/challenge`) → 화면 값. 서버 모듈을 import 하지 않는다.
 * 판정(달성·인정 장수·달성률)은 서버가 정한 값을 그대로 옮긴다. 화면이 계산하는 것은 표기(문구·날짜)와 만들기 ④ 미리 보기뿐이다.
 * 날짜는 전부 KST 달력 날짜 문자열(`YYYY-MM-DD`)이고, "오늘"은 호출부가 주입한다.
 */
import { kstDateKey } from '@/components/common/format'
import { formatMonthDay } from '@/components/vocab/format'
import { JLPT_LEVELS, levelLabel } from '@/components/vocab/labels'
import { dayLabel, daySpoken, timeLabel, weekdayOf } from '@/components/plan/logic'
import type {
  ChallengeDailyGoal,
  ChallengeDay,
  ChallengeDayState,
  ChallengeDetail,
  ChallengeLength,
  ChallengeListResponse,
  ChallengeStats,
  ChallengeSummary,
  ChallengeTask,
  ChallengeTodayResponse,
  ChallengeWordCount,
  CreateChallengeBody,
  DayChallenge,
} from '@/types/challenge'
import type { JlptLevel, Topic } from '@/types/lesson'
import { COPY, CREATE, DAY_VIEW, STATE_ORDER, TODAY_HREF } from './challengeCopy'

export type LoadStatus = 'loading' | 'ready' | 'error'

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isChallengeIdParam(v: unknown): v is string {
  return typeof v === 'string' && ID_RE.test(v)
}

function utc(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
}

/** `b − a` 날 수(같은 날 0). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

export function addDaysTo(date: string, n: number): string {
  return new Date(utc(date) + n * 86_400_000).toISOString().slice(0, 10)
}

export const md = (date: string) => formatMonthDay(date)
export const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`)
const isWords = (t: ChallengeTask): t is Extract<ChallengeTask, { kind: 'WORDS' }> => t.kind === 'WORDS'

// ── 계획표 카드 ────────────────────────────────────────────────────────────────

export type PlanCardKind = 'loading' | 'error' | 'active' | 'tomorrow' | 'ended' | 'none'

/** 판정 순서(위가 이김): 불러오는 중 → 오류 → 진행 중(오늘 할 일 있음) → 내일 시작 → 최근 끝남 → 없음. 진행 중과 최근 끝남이 함께 오면 진행 중만. */
export function planCardKind(status: LoadStatus, data: ChallengeTodayResponse | null): PlanCardKind {
  if (status === 'loading') return 'loading'
  if (status === 'error' || !data) return 'error'
  const c = data.challenge
  if (c && c.status === 'ACTIVE') return !data.today && c.stats.dayIndex === 0 ? 'tomorrow' : 'active'
  if (data.recentlyEnded) return 'ended'
  return 'none'
}

export function isLastDay(c: Pick<ChallengeSummary, 'lengthDays' | 'stats'>): boolean {
  return c.stats.dayIndex > 0 && c.stats.dayIndex === c.lengthDays
}

/** 진행 중 카드 머리: `챌린지 · 4일째 / 7일`(+ 마지막 날 마감 안내). */
export function cardHead(c: Pick<ChallengeSummary, 'lengthDays' | 'stats'>): string {
  return `챌린지 · ${c.stats.dayIndex}일째 / ${c.lengthDays}일${isLastDay(c) ? ' · 오늘 자정에 마감돼요' : ''}`
}

/** 시작 카드·만들기 기본 장수 — 설정 장수에 가장 가까운 값(같으면 작은 쪽). */
export function nearestCount(daily: number, allowed: readonly number[] = [5, 10, 15]): number | null {
  let best: number | null = null
  for (const v of allowed) if (best === null || Math.abs(v - daily) < Math.abs(best - daily)) best = v
  return best
}

// ── 오늘 할 일 줄 ──────────────────────────────────────────────────────────────

export type TaskGlyph = 'todo' | 'half' | 'done' | 'spin' | 'fail'

export interface TaskRowView {
  key: string
  glyph: TaskGlyph
  title: string
  desc: string
  /** "오늘 탭에서 하기" 같은 가는 곳 글(없으면 줄은 링크가 아니다). */
  go: string | null
  href: string | null
  /** 화면 읽기 앞말(`할 일: `·`끝냄: ` …). */
  prefix: string
  aria: string
}

export interface TaskRowOpts {
  /** 내일 시작 — 줄은 LATER 문구, 링크 없음. */
  later?: boolean
  /** 만들기 ④ 미리 보기 — 링크 없음. */
  preview?: boolean
  /** S4 회화 DONE 줄의 그날 점수(`days[오늘].lesson`). */
  lessonScore?: { correct: number; total: number } | null
}

export function taskRowView(t: ChallengeTask, opts: TaskRowOpts = {}): TaskRowView {
  let glyph: TaskGlyph = 'todo'
  let desc: string
  let go: string | null = null
  let prefix = '할 일: '
  const title = isWords(t) ? '오늘의 단어' : '오늘의 회화'
  if (isWords(t)) {
    const need = t.minAnswered ?? 0
    const n = t.wordCount ?? 0
    if (opts.later) desc = `내일부터 · 하루 ${n}장 중 ${need}장 이상`
    else if (t.state === 'TODO') {
      desc = `오늘 ${t.answered}/${need}장 · ${n}장 세트 · 약 3분`
      go = '공부 탭에서 하기'
    } else if (t.state === 'IN_PROGRESS') {
      desc = `풀던 세트가 있어요 · 오늘 ${t.answered}/${need}장`
      go = '공부 탭에서 이어서'
    } else if (t.state === 'SHORT') {
      glyph = 'half'
      prefix = '덜 함: '
      desc = `오늘 ${t.answered}/${need}장 · ${Math.max(0, need - t.answered)}장 더 풀면 완료`
      go = '공부 탭에서 하기'
    } else {
      glyph = 'done'
      prefix = '끝냄: '
      desc = `${t.sets >= 2 ? `${t.sets}세트 합쳐 ` : '오늘 '}${t.answered}장 풂(${need}장 이상)`
    }
  } else if (opts.later) desc = '내일 공부 탭에서 만들어요'
  else {
    switch (t.state) {
      case 'GENERATING':
        glyph = 'spin'
        prefix = '준비 중: '
        desc = '만드는 중 · 1분쯤'
        go = '공부 탭에서 보기'
        break
      case 'READY':
        desc = '수업이 준비됐어요 · 약 15분'
        go = '공부 탭에서 시작'
        break
      case 'IN_PROGRESS':
        desc = '하던 수업이 있어요'
        go = '공부 탭에서 이어서'
        break
      case 'CONTINUE':
        desc = '어제 만든 수업이 있어요 · 오늘 끝내면 오늘 기록으로 인정돼요'
        go = '공부 탭에서 이어서'
        break
      case 'DONE':
        glyph = 'done'
        prefix = '끝냄: '
        desc = `끝냈어요${opts.lessonScore ? ` · 문제 ${opts.lessonScore.correct}/${opts.lessonScore.total}` : ''}`
        break
      case 'FAILED':
        glyph = 'fail'
        prefix = '문제 있음: '
        desc = '만들지 못했어요'
        go = '공부 탭에서 다시'
        break
      default:
        desc = '아직 안 만들었어요 · 공부 탭에서 누르면 1분쯤'
        go = '공부 탭에서 하기'
    }
  }
  if (opts.preview) go = null
  return { key: t.kind, glyph, title, desc, go, href: go ? TODAY_HREF : null, prefix, aria: `${prefix}${title}, ${desc}${go ? `, ${go}` : ''}` }
}

/** 하루 목표에서 만든 미리 보기 과제(내일 시작 카드·만들기 ④). 꺼진 과제는 넣지 않는다. */
export function goalTasks(goal: Pick<ChallengeDailyGoal, 'lesson' | 'words' | 'wordCount' | 'wordsMinAnswered'>): ChallengeTask[] {
  const out: ChallengeTask[] = []
  if (goal.words)
    out.push({ kind: 'WORDS', state: 'TODO', sessionId: null, wordCount: goal.wordCount, minAnswered: goal.wordsMinAnswered, answered: 0, sets: 0 })
  if (goal.lesson) out.push({ kind: 'LESSON', state: 'TODO', lessonId: null, jobId: null })
  return out
}

export function taskCounts(tasks: readonly ChallengeTask[]): { done: number; total: number } {
  return { done: tasks.filter((t) => t.state === 'DONE').length, total: tasks.length }
}

/** 할 일 제목 오른쪽 한마디. */
export function dayWord(tasks: readonly ChallengeTask[], todayMet: boolean): string {
  if (todayMet) return '다 했어요'
  const { done } = taskCounts(tasks)
  const short = tasks.some((t) => t.kind === 'WORDS' && t.state === 'SHORT')
  if (done === 0 && !short) return '아직 시작 전'
  const left = tasks.filter((t) => t.state !== 'DONE').map((t) => (t.kind === 'WORDS' ? '단어' : '회화'))
  return left.length ? `남은 것: ${left.join(' · ')}` : '다 했어요'
}

// ── 지표 칸 ────────────────────────────────────────────────────────────────────

export interface StatTile {
  key: 'rate' | 'streak' | 'longest'
  value: string
  label: string
  sub: string[]
}

export function rateTile(s: ChallengeStats): StatTile {
  const sub = s.rate === null ? (s.dayIndex === 0 ? '내일부터 셀게요' : '오늘 채우면 생겨요') : `${s.elapsedDays}일 중 ${s.metDays}일`
  return { key: 'rate', value: pct(s.rate), label: '달성률', sub: [sub] }
}

/** 수행 연속 — 진행 중만(끝난 챌린지 `streak:null` 이면 호출하지 않는다). "연속 출석"(앱을 연 날)과 이름으로 구분한다. */
export function streakTile(s: ChallengeStats, short = false): StatTile {
  const n = s.streak ?? 0
  const second = s.todayMet ? '오늘까지 이어졌어요' : s.dayIndex === 0 ? '내일 채우면 1일' : `오늘 채우면 ${n + 1}일`
  return { key: 'streak', value: `${n}일`, label: '수행 연속', sub: short ? ['목표를 다 한 날만'] : ['하루 목표를 다 한 날만 계산해요', second] }
}

export function longestTile(longest: number): StatTile {
  return { key: 'longest', value: `${longest}일`, label: '최장 연속', sub: ['이 챌린지에서'] }
}

/** 계획표 카드 = 달성률·수행 연속 2칸. 끝난 챌린지(`streak:null`)는 수행 연속을 그리지 않는다. */
export function planStatTiles(s: ChallengeStats): StatTile[] {
  return s.streak === null ? [rateTile(s), longestTile(s.longestStreak)] : [rateTile(s), streakTile(s)]
}

/** 상세(S4) 지표 아래 메모. */
export function detailMemo(s: ChallengeStats): string {
  if (s.elapsedDays === 0 && !s.todayMet)
    return s.dayIndex === 0 ? '내일 시작해요. 첫날 목표를 채우면 달성률과 연속이 생겨요.' : '첫날이에요. 오늘 목표를 채우면 달성률과 연속이 생겨요.'
  if (s.todayMet) return `오늘 목표를 채워서 오늘도 달성률에 넣었어요. 수행 연속 ${s.streak ?? 0}일째예요.`
  return `오늘은 아직 끝나지 않아서 달성률에 넣지 않았어요. 오늘 채우면 수행 연속 ${(s.streak ?? 0) + 1}일이 돼요.`
}

/** 첫날 아침·내일 시작처럼 지난 날이 없는 상세 — 점수 추이·누적 절을 그리지 않는다. */
export function isFresh(s: ChallengeStats): boolean {
  return s.elapsedDays === 0 && !s.todayMet
}

// ── 하루 상태 ──────────────────────────────────────────────────────────────────

export function dayView(state: ChallengeDayState) {
  return DAY_VIEW[state]
}

/** 날짜 띠 칸 글: 7일 = `5(일)`, 14·30일 = `10/5`. */
export function stripDateText(date: string, lengthDays: number): string {
  const m = Number(date.slice(5, 7))
  const d = Number(date.slice(8, 10))
  if (lengthDays <= 7) return `${d}(${'일월화수목금토'[weekdayOf(date)]})`
  return `${m}/${d}`
}

/** 날짜 띠 오늘 테두리 — 상태가 TODAY 이거나 오늘의 일 번호 칸(오늘 목표를 채워 MET 가 된 날도 오늘 칸이다). */
export function stripCellIsToday(day: Pick<ChallengeDay, 'dayIndex' | 'state'>, todayIndex: number | null = null): boolean {
  return day.state === 'TODAY' || todayDayOf([day], todayIndex) !== null
}

/** 칸 읽기 — 테두리로만 보이는 "오늘"을 글로도 붙인다(상태 글자가 이미 "오늘"이면 붙이지 않음). */
export function stripCellAria(day: Pick<ChallengeDay, 'date' | 'dayIndex' | 'state'>, todayIndex: number | null = null): string {
  const base = `${daySpoken(day.date)}, ${day.dayIndex}일째, ${DAY_VIEW[day.state].word}`
  return day.state !== 'TODAY' && stripCellIsToday(day, todayIndex) ? `${base}, 오늘` : base
}

export function stripLegend(days: readonly Pick<ChallengeDay, 'state'>[]): ChallengeDayState[] {
  const has = new Set(days.map((d) => d.state))
  return STATE_ORDER.filter((s) => has.has(s))
}

/**
 * 오늘 칸 = 오늘의 일 번호(`today.dayIndex`)로 찾는다. 상태로 찾으면 안 된다 — 서버는 오늘 목표를 채운 날을 TODAY 가 아니라
 * MET 로 보내서(`learning/challenges/metrics.ts` 하루 상태 우선순위) 다 한 날에는 TODAY 칸이 없다. 번호가 없거나 0(내일 시작)이면 null.
 */
export function todayDayOf<T extends Pick<ChallengeDay, 'dayIndex'>>(days: readonly T[], todayIndex: number | null | undefined): T | null {
  if (!todayIndex || todayIndex < 1) return null
  return days.find((d) => d.dayIndex === todayIndex) ?? null
}

/** S4 "오늘 할 일" — 오늘 칸(일 번호로 찾음)의 수업 점수를 회화 끝냄 줄의 "문제 n/5" 로 붙인다. */
export function activeTodayView(d: Pick<ChallengeDetail, 'days' | 'today' | 'stats'>): { todayIndex: number; todayDay: ChallengeDay | null; rows: TaskRowView[] } {
  const todayIndex = d.today?.dayIndex ?? d.stats.dayIndex
  const todayDay = todayDayOf(d.days, todayIndex)
  const score = todayDay?.lesson ? { correct: todayDay.lesson.quizCorrect, total: todayDay.lesson.quizTotal } : null
  return { todayIndex, todayDay, rows: (d.today?.tasks ?? []).map((t) => taskRowView(t, { lessonScore: score })) }
}

/** 날짜 띠 초점 시작점 = 오늘 칸(일 번호로 찾음), 없으면 첫 칸. */
export function stripFocusDate(days: readonly Pick<ChallengeDay, 'date' | 'dayIndex'>[], todayIndex: number | null = null): string | null {
  return todayDayOf(days, todayIndex)?.date ?? days[0]?.date ?? null
}

/** 그만둔 날 n(1~N) — `endedAt` 의 KST 날짜로 센다. 시작 전에 그만뒀으면 0. */
export function stopDayIndex(startDate: string, endedAt: string | null, lengthDays: number): number {
  if (!endedAt) return 0
  const n = daysBetween(startDate, kstDateKey(endedAt)) + 1
  return Math.max(0, Math.min(lengthDays, n))
}

// ── 달력 하루 시트의 챌린지 줄(#71) ─────────────────────────────────────────────

/** #71 `words.need`(T1 additive) — null 이면 같은 챌린지일 때 #158 `dailyGoal.wordsMinAnswered` 로 보충, 그 밖은 null. */
export function dayChallengeNeed(c: DayChallenge, fallback: number | null): number | null {
  const n = c.words?.need
  return typeof n === 'number' ? n : fallback
}

export function dayLineView(c: DayChallenge, needFallback: number | null): { title: string; desc: string; aria: string } {
  const word = DAY_VIEW[c.state].word
  const w = c.words
  const answered = w ? w.correct + w.wrong : 0
  let desc: string
  switch (c.state) {
    case 'MET':
      desc = `하루 목표를 다 채웠어요${c.lesson ? ` · 문제 ${c.lesson.quizCorrect}/${c.lesson.quizTotal}` : ''}${w ? ` · 단어 ${w.cardCount}장 중 ${w.correct}장 맞힘` : ''}`
      break
    case 'PARTIAL': {
      const need = dayChallengeNeed(c, needFallback)
      if (c.lesson && (!w || answered === 0)) desc = '회화는 했고 단어는 안 했어요'
      else if (w && w.ok === true) desc = '단어는 했고 회화는 안 했어요'
      else if (w) desc = `${need !== null ? `단어를 ${answered}/${need}장만 풀었어요` : `단어를 ${answered}장 풀었어요 · 하루 목표에는 못 미쳤어요`}${c.lesson ? ' · 회화는 했어요' : ''}`
      else desc = '하루 목표 중 일부만 했어요'
      break
    }
    case 'MISSED':
      desc = w && answered === 0 ? '건너뛰기만 해서 ‘놓침’이에요' : '이날은 챌린지 공부가 없었어요'
      break
    case 'TODAY':
      desc = '오늘 · 아직 진행 중이에요'
      break
    case 'UPCOMING':
      desc = '그날 공부 탭에서 할 수 있어요'
      break
    default:
      desc = '챌린지를 그만둔 뒤라 세지 않아요'
  }
  const title = `챌린지 ${c.dayIndex}일째 — ${word}`
  return { title, desc, aria: `챌린지 ${c.dayIndex}일째 ${word}, ${desc}, 챌린지 화면에서 보기` }
}

// ── S5 챌린지 하루 시트 ─────────────────────────────────────────────────────────

export interface SheetRow {
  kind: 'words' | 'lesson'
  main: string
  sub: string | null
  /** `half` = 글 앞에 일부 반원 그림(`PartialMark`)을 붙인다. */
  badge: { tone: 'good' | 'neutral'; text: string; half?: true } | null
  link: { href: string; label: string } | null
  gone: boolean
}

export interface DaySheetView {
  title: string
  status: string
  reason: string
  goalLine: string
  rows: SheetRow[]
  missedNote: boolean
  todayCta: boolean
  frozenNote: boolean
  goneNote: boolean
}

export interface DaySheetCtx {
  goal: ChallengeDailyGoal
  topicTitle: string
  finished: boolean
  /** 그만둔 날 n(ENDED 만, 시작 전이면 0) — STOPPED 이유 문장. */
  stopDay: number | null
  /** TODAY 이유의 "오늘 할 일 n / m". */
  todayCounts: { done: number; total: number } | null
}

function goalLine(goal: ChallengeDailyGoal, topic: string): string {
  const parts: string[] = []
  if (goal.words) parts.push(`오늘의 단어 하루 ${goal.wordCount ?? 0}장 중 ${goal.wordsMinAnswered ?? 0}장 이상(세트 합계)`)
  if (goal.lesson) parts.push('오늘의 회화 1개')
  return `그날 할 일 · ${topic} · ${parts.join(' + ')}`
}

export function daySheetView(day: ChallengeDay, ctx: DaySheetCtx): DaySheetView {
  const w = day.words
  const l = day.lesson
  const need = w?.need ?? ctx.goal.wordsMinAnswered ?? 0
  const skipOnly = !!w && w.answered === 0
  let reason: string
  switch (day.state) {
    case 'MET':
      reason = `하루 목표를 다 채웠어요${day.goalMetAt ? ` · ${timeLabel(day.goalMetAt)}` : ''}`
      break
    case 'PARTIAL':
      if (l && (!w || skipOnly)) reason = '회화는 했고 단어는 안 했어요'
      else if (w && w.ok === true) reason = '단어는 했고 회화는 안 했어요'
      else if (w) reason = `단어를 ${w.answered}/${need}장만 풀었어요${l ? ' · 회화는 했어요' : ''}`
      else reason = '하루 목표 중 일부만 했어요'
      break
    case 'MISSED':
      reason = skipOnly ? '건너뛰기만 한 세트는 푼 것으로 세지 않아서 ‘놓침’이에요' : '이날은 챌린지 공부가 없었어요'
      break
    case 'TODAY': {
      const c = ctx.todayCounts
      reason = `아직 진행 중이에요${c ? ` · 오늘 할 일 ${c.done} / ${c.total}` : ''}${ctx.goal.words && w ? ` · 단어 ${w.answered}/${need}장` : ''}`
      break
    }
    case 'UPCOMING':
      reason = '그날 공부 탭에서 할 수 있어요'
      break
    default:
      reason =
        ctx.stopDay === 0
          ? '시작하기 전에 그만둬서 세지 않아요'
          : ctx.stopDay !== null && day.dayIndex === ctx.stopDay
            ? '이날 챌린지를 그만둬서 달성률에 넣지 않아요'
            : '그만둔 뒤라 세지 않아요'
  }
  const status = day.state === 'UPCOMING' ? `${day.dayIndex}일째 · 예정` : DAY_VIEW[day.state].word
  const live = !ctx.finished
  const rows: SheetRow[] = []
  let goneAny = false
  if (ctx.goal.words) {
    if (!w) rows.push({ kind: 'words', main: day.state === 'TODAY' ? '오늘의 단어 · 아직 안 했어요' : '오늘의 단어 · 하지 않았어요', sub: null, badge: null, link: null, gone: false })
    else {
      goneAny ||= !w.refExists && !ctx.finished
      const main = skipOnly
        ? '건너뛰기만 함 · 푼 0장'
        : w.sets >= 2
          ? `오늘의 단어 ${w.sets}세트 합계 — ${w.cardCount}장 중 맞힘 ${w.correct} · 틀림 ${w.wrong} · 건너뜀 ${w.skipped}(푼 ${w.answered}장)`
          : `오늘의 단어 ${w.cardCount}장 중 ${w.correct}장 맞힘`
      const sub = !skipOnly && w.sets < 2 ? `틀림 ${w.wrong} · 건너뜀 ${w.skipped}` : null
      const badge = skipOnly
        ? { tone: 'neutral' as const, text: '✕ 건너뛰기만 함' }
        : w.ok
          ? { tone: 'good' as const, text: `✓ 완료 · 푼 ${w.answered}장(${need}장 이상)` }
          : { tone: 'neutral' as const, text: `덜 풂 · ${w.answered}/${need}장`, half: true as const }
      const link =
        live && w.sessionId && w.refExists
          ? { href: `/study/today/words/${encodeURIComponent(w.sessionId)}`, label: w.sets >= 2 ? `가장 많이 푼 세트 결과 보기 · 외 ${w.sets - 1}세트 ›` : '세트 결과 보기 ›' }
          : null
      rows.push({ kind: 'words', main, sub, badge, link, gone: live && !w.refExists })
    }
  }
  if (ctx.goal.lesson) {
    if (!l) rows.push({ kind: 'lesson', main: day.state === 'TODAY' ? '아직 안 했어요 · 공부 탭에서 [오늘 수업 만들기]' : '오늘의 회화 · 하지 않았어요', sub: null, badge: null, link: null, gone: false })
    else {
      goneAny ||= !l.refExists && !ctx.finished
      const link = live && l.lessonId && l.refExists ? { href: `/study/today/talk/${encodeURIComponent(l.lessonId)}`, label: '수업 결과 보기 ›' } : null
      rows.push({ kind: 'lesson', main: `오늘의 회화 「${ctx.topicTitle}」 · 문제 ${l.quizCorrect}/${l.quizTotal}`, sub: null, badge: null, link, gone: live && !l.refExists })
    }
  }
  return {
    title: `${dayLabel(day.date)} · ${day.dayIndex}일째`,
    status,
    reason,
    goalLine: goalLine(ctx.goal, ctx.topicTitle),
    rows,
    missedNote: live && day.state === 'MISSED',
    todayCta: live && day.state === 'TODAY',
    frozenNote: ctx.finished,
    goneNote: goneAny,
  }
}

// ── 점수 추이 · 규칙 ────────────────────────────────────────────────────────────

export interface ScoreRow {
  date: string
  label: string
  dateText: string
  lesson: { text: string; dots: { correct: number; total: number } | null } | null
  words: string | null
}

/** 예정·그만둠을 뺀 날. 꺼진 과제 칸은 null(칸을 그리지 않는다). 오늘 = 일 번호(`todayIndex`) — 오늘 목표를 채운 날은 상태가 MET 라서. */
export function scoreRows(days: readonly ChallengeDay[], goal: Pick<ChallengeDailyGoal, 'lesson' | 'words'>, todayIndex: number | null = null): ScoreRow[] {
  const todayDay = todayDayOf(days, todayIndex)
  return days
    .filter((d) => d.state !== 'UPCOMING' && d.state !== 'STOPPED')
    .map((d) => {
      const today = todayDay ? d === todayDay : d.state === 'TODAY'
      const lesson = goal.lesson
        ? d.lesson
          ? { text: `문제 ${d.lesson.quizCorrect}/${d.lesson.quizTotal}`, dots: { correct: d.lesson.quizCorrect, total: d.lesson.quizTotal } }
          : { text: today ? '아직' : '수업 없음', dots: null }
        : null
      let words: string | null = null
      if (goal.words) {
        const w = d.words
        if (w && w.answered > 0) words = `${w.correct}/${w.cardCount} 맞힘${w.sets >= 2 ? ` · ${w.sets}세트` : ''}`
        else if (w) words = '건너뛰기만 함'
        else words = today ? '아직' : '안 함'
      }
      return { date: d.date, label: `${d.dayIndex}일째`, dateText: `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}${today ? ' 오늘' : ''}`, lesson, words }
    })
}

/** 규칙 줄(첫 줄 "✓ 달성 · 일부 · ✕ 놓침" 은 반원 그림이 들어가서 `COPY.ruleLegend` 로 따로 그린다). */
export function ruleLines(goal: ChallengeDailyGoal): string[] {
  const out: string[] = []
  if (goal.words) {
    out.push(
      `단어는 하루 ${goal.wordCount ?? 0}장 중 ${goal.wordsMinAnswered ?? 0}장 이상 풀면 완료예요. 하루에 푼 장수를 합쳐서 계산해요. 건너뛴 카드는 푼 것으로 인정되지 않아요(건너뛰기만 한 세트는 공부한 날로도 인정되지 않아요).`,
      '같은 세트를 다시 푼 장수도 하루 합계에 더해요.',
    )
  }
  if (goal.lesson) out.push('회화는 수업을 끝내기만 하면 완료예요(문제 점수와 상관없음).')
  out.push(
    '같은 주제면 공부 탭 어디서 해도 인정돼요. 오늘 시작한 챌린지는 만들기 전에 끝낸 같은 주제 공부도 오늘 기록으로 인정돼요.',
    '세트는 시작한 날로, 수업은 끝낸 날로 기록돼요 · 마지막 날 자정에 마감돼요.',
    '달성률은 지난 날 수로 나눠요. 오늘은 채운 뒤에 들어가요.',
    '수행 연속은 앱을 연 날(연속 출석)이 아니라 하루 목표를 다 한 날만 계산해요.',
    '기록을 지워도 챌린지 달성은 그대로예요.',
  )
  return out
}

// ── 그만두기 확인 ──────────────────────────────────────────────────────────────

export function endSheetView(d: Pick<ChallengeDetail, 'title' | 'stats' | 'days'>): { intro: string; lines: string[] } {
  const s = d.stats
  const lines: string[] = []
  if (s.dayIndex > 1) {
    const met = d.days.filter((x) => x.state === 'MET').length
    const part = d.days.filter((x) => x.state === 'PARTIAL').length
    lines.push(`지금까지 기록(달성 ${met}일 · 일부 ${part}일)은 그대로 남아요.`)
  }
  if (s.dayIndex === 0) lines.push('아직 시작 전이라 모든 날이 ‘그만둠’이 되고 달성률은 생기지 않아요.')
  else if (s.todayMet) lines.push(`오늘(${s.dayIndex}일째)은 목표를 채워서 달성으로 넣어요 → 결과는 ‘${s.elapsedDays}일 중 ${s.metDays}일 달성’.`)
  else lines.push(`오늘(${s.dayIndex}일째)은 아직 목표를 채우지 않아서 달성률에서 빠져요 → 결과는 ‘${s.elapsedDays ? `${s.elapsedDays}일 중 ${s.metDays}일 달성` : '달성률 —'}’.`)
  lines.push('그만두면 되돌릴 수 없어요. 같은 주제로 다시 도전할 수는 있어요.', '오늘 공부는 그대로 할 수 있지만 이 챌린지에는 세지 않아요.')
  return { intro: `「${d.title}」를 ${s.dayIndex === 0 ? '시작하기 전에' : `${s.dayIndex}일째에`} 끝내요.`, lines }
}

// ── S8 결과 · 기록 · 다시 도전 ──────────────────────────────────────────────────

export interface ResultHeroView {
  badge: { tone: 'good' | 'neutral'; text: string }
  big: string
  sub: string
  preStart: boolean
  removed: boolean
  done: { longest: number; lessons: number; correct: number; sets: number }
}

export function resultHeroView(d: ChallengeDetail): ResultHeroView {
  const r = d.result
  const met = r?.metDays ?? d.stats.metDays
  const elapsed = r?.elapsedDays ?? d.stats.elapsedDays
  const rate = r ? r.rate : d.stats.rate
  const count = (st: ChallengeDayState) => d.days.filter((x) => x.state === st).length
  const partial = r?.partialDays ?? count('PARTIAL')
  const missed = r?.missedDays ?? count('MISSED')
  const ended = d.status === 'ENDED'
  const preStart = ended && d.stats.dayIndex === 0
  const badge = ended
    ? { tone: 'neutral' as const, text: '그만둠' }
    : met === d.lengthDays
      ? { tone: 'good' as const, text: '완주' }
      : { tone: 'neutral' as const, text: '기간 끝' }
  const sub = !ended
    ? `달성률 ${pct(rate)} · 일부 ${partial}일 · 놓침 ${missed}일`
    : preStart
      ? `${d.lengthDays}일 모두 그만둠 · 달성률 —`
      : `${d.lengthDays}일 중 ${d.stats.dayIndex}일째에 그만뒀어요 · 달성률 ${pct(rate)}`
  return {
    badge,
    big: preStart ? '시작 전에 그만뒀어요' : `${elapsed}일 중 ${met}일 달성`,
    sub,
    preStart,
    removed: (r?.endReason ?? null) === 'TOPIC_REMOVED',
    done: {
      longest: r?.longestStreak ?? d.stats.longestStreak,
      lessons: r?.lessonsDone ?? d.totals.lessonsDone,
      correct: r?.wordsCorrect ?? d.totals.wordsCorrect,
      sets: r?.wordSets ?? d.totals.wordSets,
    },
  }
}

export type ListBadge = 'active' | 'full' | 'done' | 'stopped'

export function listRowView(s: ChallengeSummary): { desc: string; badge: ListBadge; badgeText: string } {
  const range = `${md(s.startDate)} ~ ${md(s.endDate)}`
  const st = s.stats
  if (s.status === 'ACTIVE') {
    const where = st.dayIndex === 0 ? '내일 시작' : `${st.dayIndex}일째`
    return { desc: `${range} · ${where} · ${st.elapsedDays ? `${st.elapsedDays}일 중 ${st.metDays}일 달성` : '아직 지난 날이 없어요'}`, badge: 'active', badgeText: '진행 중' }
  }
  if (s.status === 'COMPLETED') {
    const full = st.metDays === s.lengthDays
    return { desc: `${range} · ${s.lengthDays}일 중 ${st.metDays}일 달성`, badge: full ? 'full' : 'done', badgeText: full ? '완주' : '기간 끝' }
  }
  const body = st.elapsedDays === 0 && st.dayIndex === 0 ? '시작 전에 그만둠' : `${st.dayIndex}일째 그만둠 · ${st.elapsedDays}일 중 ${st.metDays}일 달성`
  return { desc: `${md(s.startDate)} 시작 · ${body}`, badge: 'stopped', badgeText: '그만둠' }
}

/**
 * #155 한 번 읽기 — 서버는 쪽을 행 기준으로 자르고 결과를 만들 수 없는 끝난 행은 건너뛰어, 한 쪽이 `items: []` + `nextCursor` 일 수 있다.
 * 빈 쪽은 다음 쪽을 이어 읽는다(최대 `maxPages` 쪽). 같은 커서가 다시 오면 더 읽을 것이 없는 것으로 보고 커서를 버린다.
 */
export async function readListPages(
  fetchPage: (cursor: string | null) => Promise<ChallengeListResponse>,
  start: string | null,
  maxPages = 5,
): Promise<ChallengeListResponse> {
  const seen = new Set<string>(start ? [start] : [])
  let page = await fetchPage(start)
  for (let n = 1; n < maxPages && page.items.length === 0 && page.nextCursor && !seen.has(page.nextCursor); n++) {
    seen.add(page.nextCursor)
    page = await fetchPage(page.nextCursor)
  }
  return { items: page.items, nextCursor: page.nextCursor && !seen.has(page.nextCursor) ? page.nextCursor : null }
}

/** 기록 목록 빈 상태는 행도 없고 이어 읽을 커서도 없을 때만. 행이 없어도 커서가 있으면 [더 보기] 를 그린다. */
export function isListEmpty(items: readonly unknown[], cursor: string | null): boolean {
  return items.length === 0 && !cursor
}

/** 끝남 카드 한 줄(#158 `recentlyEnded` — 시작일이 없어 그만둔 날 번호는 모른다: 그 조각은 뺀다). */
export function endedCardLine(e: NonNullable<ChallengeTodayResponse['recentlyEnded']>): string {
  const r = e.result
  if (e.status === 'COMPLETED') return `${r.lengthDays}일 중 ${r.metDays}일 달성 · 최장 연속 ${r.longestStreak}일`
  if (r.elapsedDays === 0) return '시작 전에 그만뒀어요'
  return `그만뒀어요 · ${r.elapsedDays}일 중 ${r.metDays}일 달성 · 최장 연속 ${r.longestStreak}일`
}

export type RetryGate = { kind: 'show' } | { kind: 'blocked'; id: string; title: string; dayIndex: number }

/** [다시 도전] — 진행 중 챌린지가 없을 때만. #158 을 못 읽었으면 버튼을 보이고 409 는 만들기 ④ 가 받는다. */
export function canRetry(today: ChallengeTodayResponse | null, id: string): RetryGate {
  const c = today?.challenge
  if (c && c.status === 'ACTIVE' && c.id !== id) return { kind: 'blocked', id: c.id, title: c.title, dayIndex: c.stats.dayIndex }
  return { kind: 'show' }
}

/** 주제가 지워진 챌린지(`topic.id` null 또는 `exists:false`) — 같은 주제로 다시 만들 수 없다. 제목은 얼린 스냅샷 그대로 보인다(task-045 결정 3). */
export function isTopicGone(topic: Pick<ChallengeDetail['topic'], 'id' | 'exists'>): boolean {
  return !topic.id || topic.exists === false
}

/** 결과 화면 「다음 챌린지」 — 주제가 지워졌으면 [다시 도전](같은 주제)만 숨긴다. [다른 주제로]·진행 중 안내는 그대로. */
export function resultNextView(topic: Pick<ChallengeDetail['topic'], 'id' | 'exists'>, retry: RetryGate): { topicGone: boolean; showRetry: boolean } {
  const topicGone = isTopicGone(topic)
  return { topicGone, showRetry: retry.kind === 'show' && !topicGone }
}

/** 다른 챌린지가 진행 중일 때 결과 화면 상자 글 — 주제가 지워졌으면 같은 주제로 다시 도전할 길이 없으므로 「다시 도전할 수 있어요」를 약속하지 않는다(REV-165 M-1). */
export function blockedNoteText(retry: Extract<RetryGate, { kind: 'blocked' }>, topicGone: boolean): string {
  const now = COPY.blockedNow(retry.title, retry.dayIndex)
  return topicGone ? now : `${now} ${COPY.blockedAgain}`
}

// ── S3 만들기 ──────────────────────────────────────────────────────────────────

export const LENGTHS: readonly ChallengeLength[] = [7, 14, 30]
export const WORD_COUNTS: readonly ChallengeWordCount[] = [5, 10, 15]

/** 인정 장수 미리 보기 = ceil(4n/5)(5·10·15 → 4·8·12). 화면 표시 전용 — 판정은 서버가 얼린 값. */
export function minAnsweredOf(n: number): number {
  return Math.ceil((4 * n) / 5)
}

export function acceptLine(n: number): string {
  return `하루에 ${n}장 중 ${minAnsweredOf(n)}장 이상 풀면 인정`
}

export interface WordCountOptions {
  options: { value: ChallengeWordCount; disabled: boolean }[]
  /** 막힌 칸 이유 한 문장(막힌 칸이 없으면 null). */
  reason: string | null
  /** 표현 5개 미만 — 단어 과제 자체를 켤 수 없다. */
  wordsBlocked: string | null
}

export function wordCountOptions(chunkCount: number): WordCountOptions {
  const options = WORD_COUNTS.map((value) => ({ value, disabled: value > chunkCount }))
  const blocked = options.filter((o) => o.disabled).map((o) => o.value)
  if (chunkCount < WORD_COUNTS[0]) return { options, reason: null, wordsBlocked: `이 주제 표현이 ${chunkCount}개라 단어 과제를 켤 수 없어요` }
  if (!blocked.length) return { options, reason: null, wordsBlocked: null }
  const b = Math.min(...blocked)
  return { options, reason: `이 주제 표현이 ${chunkCount}개라 ${b}장${blocked.length > 1 ? ' 이상은' : '은'} 고를 수 없어요`, wordsBlocked: null }
}

/** 고를 수 있는 장수 중 설정 장수에 가장 가까운 값(없으면 null). */
export function defaultWordCount(daily: number, chunkCount: number): ChallengeWordCount | null {
  const allowed = WORD_COUNTS.filter((n) => n <= chunkCount)
  return (nearestCount(daily, allowed) as ChallengeWordCount | null) ?? null
}

export interface Draft {
  topicId: string | null
  lengthDays: ChallengeLength
  lesson: boolean
  words: boolean
  wordCount: ChallengeWordCount | null
  start: 'TODAY' | 'TOMORROW'
  /** 챌린지 난이도(task-076 D9 A) — null = 손대지 않음(고른 주제의 난이도를 따른다, 주제를 바꾸면 같이 바뀜). 고른 뒤에는 주제를 바꿔도 유지. */
  level: JlptLevel | null
}

export const EMPTY_DRAFT: Draft = { topicId: null, lengthDays: 7, lesson: true, words: true, wordCount: null, start: 'TODAY', level: null }

export function isJlptLevel(v: unknown): v is JlptLevel {
  return typeof v === 'string' && (JLPT_LEVELS as readonly string[]).includes(v)
}

export function serializeDraft(d: Draft): string {
  return JSON.stringify({ v: 1, ...d })
}

export function parseDraft(raw: string | null): Draft | null {
  if (!raw || raw.length > 500) return null
  let o: Record<string, unknown>
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object') return null
    o = v as Record<string, unknown>
  } catch {
    return null
  }
  if (o.v !== 1) return null
  const topicId = isChallengeIdParam(o.topicId) ? o.topicId : null
  const lengthDays = LENGTHS.includes(o.lengthDays as ChallengeLength) ? (o.lengthDays as ChallengeLength) : 7
  const wordCount = WORD_COUNTS.includes(o.wordCount as ChallengeWordCount) ? (o.wordCount as ChallengeWordCount) : null
  return {
    topicId,
    lengthDays,
    lesson: o.lesson !== false,
    words: o.words !== false,
    wordCount,
    start: o.start === 'TOMORROW' ? 'TOMORROW' : 'TODAY',
    // task-076 전에 저장된 초안(칸 없음)·잘못된 값은 null = 주제 난이도.
    level: isJlptLevel(o.level) ? o.level : null,
  }
}

export function parseStep(raw: string | null): 1 | 2 | 3 | 4 {
  const n = Number(raw)
  return n === 2 || n === 3 || n === 4 ? n : 1
}

export function parseDayParam(raw: string | null): string | null {
  return typeof raw === 'string' && DATE_RE.test(raw) ? raw : null
}

/** 만들기에서 실제로 보낼 하루 목표 — 표현 5개 미만이면 단어를 끄고, 막힌 장수는 고를 수 있는 기본값으로. */
export function effectiveGoal(d: Draft, topic: Pick<Topic, 'chunks'> | null, daily: number): { lesson: boolean; words: boolean; wordCount: ChallengeWordCount | null } {
  const pool = topic?.chunks.length ?? 0
  const words = d.words && pool >= WORD_COUNTS[0]
  const ok = d.wordCount !== null && d.wordCount <= pool
  return { lesson: d.lesson, words, wordCount: words ? (ok ? d.wordCount : defaultWordCount(daily, pool)) : null }
}

/** `9월 26일 (토) ~ 10월 2일 (금)` — 시작일부터 N일. */
export function rangeLabel(start: string, lengthDays: number): string {
  return `${dayLabel(start)} ~ ${dayLabel(addDaysTo(start, lengthDays - 1))}`
}

export function autoTitle(topicTitle: string, lengthDays: number): string {
  return `${topicTitle} ${lengthDays}일 챌린지`
}

export function goalSummary(g: { lesson: boolean; words: boolean; wordCount: number | null }): string {
  const parts: string[] = []
  if (g.words && g.wordCount) parts.push(`오늘의 단어 하루 ${g.wordCount}장(${minAnsweredOf(g.wordCount)}장 이상 풀면 완료)`)
  if (g.lesson) parts.push('오늘의 회화 1개')
  return parts.join(' + ')
}

// ── 챌린지 난이도(task-076 · screens.md §33) — ③ 목표 단계 · ④ 확인 · 계획표 카드 ─────────────────
// 이름·코드는 `levelLabel`(= `SEED_PACK_LABEL`)로만 만든다. 생성 기준 수준 규칙은 서버(`learning/targetLevel`)가 정하고 여기서는 표시만 한다.

/** 보이는 선택(D9 A) = 고른 값, 손대지 않았으면 주제 난이도. */
export function selectedLevel(d: Pick<Draft, 'level'>, topic: Pick<Topic, 'level'> | null): JlptLevel | null {
  return d.level ?? topic?.level ?? null
}

/** 쉬운 쪽 0(N5) … 어려운 쪽 4(N1). */
export function levelRank(l: JlptLevel): number {
  return JLPT_LEVELS.indexOf(l)
}

export type LevelHint = { kind: 'high'; steps: number } | { kind: 'low' } | null

/** 안내 줄 규칙(D8 A) — 내 수준보다 2단계 이상 위 = high, 아래 = low, 같음·1단계 위 = 없음. 내 수준을 모르면 없음. 막지 않는다. */
export function levelHint(sel: JlptLevel, my: JlptLevel | null): LevelHint {
  if (!my) return null
  const d = levelRank(sel) - levelRank(my)
  if (d >= 2) return { kind: 'high', steps: d }
  if (d < 0) return { kind: 'low' }
  return null
}

export function levelHintText(h: LevelHint): string {
  if (!h) return ''
  return h.kind === 'high' ? CREATE.levelHigh(h.steps) : CREATE.levelLow
}

export type WordsLevelNote = { steps: number } | null

/** 새 단어 안내(task-078 §35) — 고른 난이도가 주제보다 2단계 이상 어려우면 { steps }. 쉬운 쪽은 늘 null, 단어 목표와 무관. */
export function wordsLevelNote(sel: JlptLevel, topicLevel: JlptLevel): WordsLevelNote {
  const d = levelRank(sel) - levelRank(topicLevel)
  return d >= 2 ? { steps: d } : null
}

/** 비교·꼬리말 기준 — 내 수준·내 목표는 프로필(모르면 null), 이 주제는 고른 주제. */
export interface LevelContext {
  my: JlptLevel | null
  goal: JlptLevel | null
  topic: JlptLevel
}

/** 프로필 → 만들기 화면 props — 내 수준 = `level`, 내 목표 = `goalLevel`. 서버 페이지라 직접 렌더할 수 없어 값 연결을 시험하려고 따로 둔다(REV-076U M-1). */
export function profileLevelProps(p: { level: JlptLevel | null; goalLevel: JlptLevel | null }): { myLevel: JlptLevel | null; goalLevel: JlptLevel | null } {
  return { myLevel: p.level, goalLevel: p.goalLevel }
}

/** 알약 시각 숨김 글 — 「초급 (N4), 내 수준, 이 주제 기본」. 꼬리말은 맞는 것만, 순서 내 수준 → 내 목표 → 이 주제 기본(§33-2). */
export function levelPillSr(l: JlptLevel, ctx: LevelContext): string {
  const tails: string[] = []
  if (ctx.my === l) tails.push(CREATE.levelSr.my)
  if (ctx.goal === l) tails.push(CREATE.levelSr.goal)
  if (ctx.topic === l) tails.push(CREATE.levelSr.topic)
  return [levelLabel(l), ...tails].join(', ')
}

export interface LevelCompareGroup {
  head: string
  label: string
}

/** 비교 줄 묶음(D3 A) — 내 수준(모르면 빠짐) · 내 목표(없으면 빠짐) · 이 주제. 화면은 묶음 안에서 줄을 바꾸지 않는다. */
export function levelCompareGroups(ctx: LevelContext): LevelCompareGroup[] {
  const out: LevelCompareGroup[] = []
  if (ctx.my) out.push({ head: CREATE.levelCompareHead.my, label: levelLabel(ctx.my) })
  if (ctx.goal) out.push({ head: CREATE.levelCompareHead.goal, label: levelLabel(ctx.goal) })
  out.push({ head: CREATE.levelCompareHead.topic, label: levelLabel(ctx.topic) })
  return out
}

/** 비교 줄을 이어 붙인 글 — 화면에 보이는 글과 같다. */
export function levelCompareText(groups: readonly LevelCompareGroup[]): string {
  return groups.map((g) => `${g.head} ${g.label}`).join(' · ')
}

/** ④ 확인 「난이도」 줄 dd 아래 작은 글 = `head` + (`topicLabel` 한 덩어리). 같으면 「이 주제 기본」, 다르면 「이 주제 기본은 초급 (N4)」. */
export function confirmLevelNote(level: JlptLevel, topicLevel: JlptLevel): { head: string; topicLabel: string | null } {
  if (level === topicLevel) return { head: CREATE.rowLevelSame, topicLabel: null }
  return { head: CREATE.rowLevelDiffHead, topicLabel: levelLabel(topicLevel) }
}

/** 계획표 진행 중 카드 부제 앞(D10 A) — 「난이도 중급 (N3)」. */
export function planLevelText(l: JlptLevel): string {
  return COPY.planLevel(levelLabel(l))
}

/**
 * #156 본문. 난이도는 손대지 않았어도 보이는 값(주제 난이도)을 늘 싣는다 — 확인 단계에 보인 값 = 저장 값
 * (주제 목록을 읽은 뒤 주제 난이도가 바뀌어도 사용자가 본 값으로 만든다). 서버는 같은 값이면 지금과 같은 결과다.
 */
export function createBody(
  topic: Pick<Topic, 'id' | 'level'>,
  d: Pick<Draft, 'lengthDays' | 'start' | 'level'>,
  goal: { lesson: boolean; words: boolean; wordCount: ChallengeWordCount | null },
): CreateChallengeBody {
  return {
    topicId: topic.id,
    lengthDays: d.lengthDays,
    start: d.start,
    dailyGoal: { lesson: goal.lesson, words: goal.words, ...(goal.words && goal.wordCount ? { wordCount: goal.wordCount } : {}) },
    level: d.level ?? topic.level,
  }
}

export type CreateError =
  | { kind: 'over'; poolSize: number }
  | { kind: 'active'; challengeId: string | null }
  | { kind: 'topic' }
  | { kind: 'rate' }
  | { kind: 'fail' }

export function createErrorOf(err: { status: number; details: Record<string, unknown> }): CreateError {
  const reason = typeof err.details.reason === 'string' ? err.details.reason : null
  if (err.status === 409 && (reason === 'ACTIVE_EXISTS' || reason === null))
    return { kind: 'active', challengeId: typeof err.details.challengeId === 'string' ? err.details.challengeId : null }
  if (err.status === 400 && reason === 'WORD_COUNT_OVER_POOL') {
    const p = Number(err.details.poolSize)
    return { kind: 'over', poolSize: Number.isFinite(p) ? p : 0 }
  }
  if (err.status === 404) return { kind: 'topic' }
  if (err.status === 429) return { kind: 'rate' }
  return { kind: 'fail' }
}
