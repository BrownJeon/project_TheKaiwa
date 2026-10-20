/**
 * 계획표 달력(task-012, 승인 데모 `docs/demo/task-012-calendar-v1.html`)의 순수 로직 — 테스트에서 `today` 를 주입한다.
 *
 * - 날짜는 전부 KST 달력 날짜 문자열(`YYYY-MM-DD`)이고 계산은 `infra/dates` 로만 한다(브라우저 시간대 무관).
 *   "오늘"은 서버가 정한다(#70 `today`) — 화면은 그 값을 받아 쓴다.
 * - 사용자 결정(2026-10-01): (a) 날짜 칸 = 종류 글자 · (b) 하루 상세 = 바텀 시트.
 * - 주 시작 = **일요일**(2026-10-20 사용자 결정, task-080 — 2026-10-01 c=B 월요일 대체). 상수는 `infra/dates` 의 `WEEK_START_DOW` 하나를 달력·성장·질문 탭이 같이 쓴다.
 */
import { addDays, isDateString, monthBounds, WEEK_START_DOW } from '@/modules/infra/dates'
import { formatClock } from '@/components/common/format'
import type { CalendarDay, CalendarSummary, DayReview, StudyLogItem, StudyType } from '@/types/plan'
import type { ChallengeDayState } from '@/types/challenge'

const WD = ['일', '월', '화', '수', '목', '금', '토'] as const
/** 요일 머리 — 요일 배열을 주 시작(`WEEK_START_DOW`)만큼 돌린 값(일요일 시작 = 일~토). */
export const WEEK_HEADERS: readonly string[] = [...WD.slice(WEEK_START_DOW), ...WD.slice(0, WEEK_START_DOW)]
/** 서버 허용 범위(#70 연도 2000~2100) 안에서 가장 이른 달. */
export const MIN_MONTH = '2000-01'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isMonthString(v: unknown): v is string {
  return typeof v === 'string' && MONTH_PATTERN.test(v)
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

function parts(date: string): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) }
}

/** 0=일 … 6=토. UTC 로 계산해 기기 시간대와 무관하다. */
export function weekdayOf(date: string): number {
  const p = parts(date)
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
}

export function shiftMonth(month: string, n: number): string {
  let y = Number(month.slice(0, 4))
  let m = Number(month.slice(5, 7)) + n
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  return `${y}-${m < 10 ? '0' : ''}${m}`
}

/** 월 격자: 주 시작(일요일) 기준 앞 빈칸 수 + 그 달의 모든 날짜. */
export function monthGrid(month: string): { leading: number; dates: string[] } {
  const { from, to } = monthBounds(`${month}-01`)
  const dates: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d)
  return { leading: (weekdayOf(from) - WEEK_START_DOW + 7) % 7, dates }
}

export function monthLabel(month: string): string {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`
}

/** 시트 제목·목록 머리: `9월 26일 (토)` */
export function dayLabel(date: string): string {
  const p = parts(date)
  return `${p.m}월 ${p.d}일 (${WD[weekdayOf(date)]})`
}

/** 화면 읽기용: `9월 26일 토요일` */
export function daySpoken(date: string): string {
  const p = parts(date)
  return `${p.m}월 ${p.d}일 ${WD[weekdayOf(date)]}요일`
}

// ── URL(주소에 달·날짜를 담아 원본에서 뒤로 와도 같은 자리) ────────────────────────

export interface PlanParams {
  month: string
  day: string | null
  /** 원본으로 갔다가 돌아왔을 때 초점을 돌려줄 기록 id. */
  log: string | null
}

/** `?month=&day=&log=` 해석 — 형식이 틀리거나 이번 달보다 뒤(미래 달)면 이번 달로, 날짜는 그 달 안일 때만. */
export function parsePlanParams(rawMonth: string | null, rawDay: string | null, rawLog: string | null, today: string): PlanParams {
  const current = monthOf(today)
  const day0 = isDateString(rawDay) ? rawDay : null
  let month = isMonthString(rawMonth) ? rawMonth : day0 ? monthOf(day0) : current
  if (month > current || month < MIN_MONTH) month = current
  const day = day0 && monthOf(day0) === month ? day0 : null
  const log = day && typeof rawLog === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(rawLog) ? rawLog : null
  return { month, day, log }
}

export function planUrl(month: string, day: string | null, log: string | null = null): string {
  const q = new URLSearchParams({ month })
  if (day) q.set('day', day)
  if (day && log) q.set('log', log)
  return `/plan?${q.toString()}`
}

// ── 공부 종류(글자 칩) ──────────────────────────────────────────────────────────

export interface TypeMeta {
  /** 칸·목록의 한 글자 칩 */
  ch: string
  label: string
  /** 원본 화면 이름(메뉴 "… 보기") */
  dest: string
  /** 지우기 확인의 "원본은 그대로" 한 줄 */
  keep: string
}

export const TYPE_META: Record<StudyType, TypeMeta> = {
  WORDS: { ch: '단', label: '오늘의 단어', dest: '단어 세트 결과', keep: '단어 세트 결과는 그대로 남아요.' },
  LESSON: { ch: '수', label: '오늘의 회화', dest: '수업 결과', keep: '수업과 배운 표현은 그대로 남아요.' },
  REVIEW: { ch: '복', label: '복습 수업', dest: '복습 수업 결과', keep: '복습 수업과 선생님의 복습 판단은 그대로예요.' },
  TALK: { ch: '회', label: 'AI 회화', dest: '회화방', keep: '회화 내용과 교정은 그대로 남아요.' },
  CHAT: { ch: '채', label: 'AI 채팅', dest: '채팅방', keep: '채팅 내용과 교정은 그대로 남아요.' },
  EVALUATION: { ch: '평', label: 'AI 평가', dest: '평가 결과', keep: '평가 결과와 점수는 그대로 남아요.' },
  ASK: { ch: '질', label: '질문', dest: '질문', keep: '질문과 답은 그대로 남아요.' },
}

/** 칸에 놓는 순서 — 평가(반전 칩)·복습할 날(점선 칩) 다음에 이 순서(데모 ORDER). */
const CELL_ORDER: StudyType[] = ['LESSON', 'REVIEW', 'WORDS', 'TALK', 'CHAT', 'ASK']
/** 표시 설명에 나오는 종류(질문은 아직 열리지 않은 기능이라 뺀다). */
export const LEGEND_TYPES: StudyType[] = ['WORDS', 'LESSON', 'REVIEW', 'TALK', 'CHAT']
const MAX_CHIPS = 3

/** 평가를 앞에 두고 나머지를 칸 순서로 — 화면 읽기 문구·칩이 같은 순서를 쓴다. */
export function orderedTypes(types: StudyType[]): StudyType[] {
  const has = new Set(types)
  return [...(has.has('EVALUATION') ? (['EVALUATION'] as StudyType[]) : []), ...CELL_ORDER.filter((t) => has.has(t))]
}

/** `ch` = 챌린지 하루 모양(task-043 — 달성·일부·놓침만 칩으로, 칩 3개 안에 센다). */
export type CellMark =
  | { kind: 'type'; type: StudyType }
  | { kind: 'eval' }
  | { kind: 'due' }
  | { kind: 'more'; n: number }
  | { kind: 'ch'; state: 'MET' | 'PARTIAL' | 'MISSED' }

export type CellKind = 'future' | 'study' | 'attended' | 'none'

export interface CellView {
  kind: CellKind
  isToday: boolean
  /** 누를 수 있는가(미래 날짜는 복습할 날만). */
  interactive: boolean
  marks: CellMark[]
  /** 칩이 없고 출석만 했으면 작은 동그라미. */
  attendedDot: boolean
  /** 칸 아래 챌린지 기간 띠(그만둔 날을 뺀 챌린지 날 — 예정 날 포함). 챌린지 칸이 없으면 false(지금 달력과 같다). */
  band: boolean
  label: string
}

export function cellView(day: CalendarDay, today: string): CellView {
  const future = day.date > today
  const attended = day.attended && !future
  const chips: CellMark[] = []
  const ch = day.challenge
  if (ch && (ch.state === 'MET' || ch.state === 'PARTIAL' || ch.state === 'MISSED')) chips.push({ kind: 'ch', state: ch.state })
  if (day.hasEvaluation) chips.push({ kind: 'eval' })
  if (day.reviewDue) chips.push({ kind: 'due' })
  for (const t of orderedTypes(day.types)) if (t !== 'EVALUATION') chips.push({ kind: 'type', type: t })
  const marks: CellMark[] = chips.length > MAX_CHIPS ? [...chips.slice(0, MAX_CHIPS), { kind: 'more', n: chips.length - MAX_CHIPS }] : chips
  const kind: CellKind = future ? 'future' : day.logCount > 0 ? 'study' : attended ? 'attended' : 'none'
  return {
    kind,
    isToday: day.date === today,
    interactive: !future || day.reviewDue,
    marks,
    attendedDot: marks.length === 0 && attended,
    band: !!ch && ch.state !== 'STOPPED',
    label: cellLabel(day, today),
  }
}

/** `9월 26일 토요일, 출석, 공부 3가지: 오늘의 회화, 오늘의 단어, AI 회화` */
export function cellLabel(day: CalendarDay, today: string): string {
  const future = day.date > today
  const p = [daySpoken(day.date)]
  if (day.date === today) p.push('오늘')
  p.push(future ? '아직 오지 않은 날' : day.attended ? '출석' : '출석 안 함')
  if (day.logCount > 0 && day.types.length > 0) {
    const ts = orderedTypes(day.types)
    p.push(`공부 ${ts.length}가지: ${ts.map((t) => TYPE_META[t].label).join(', ')}`)
  }
  if (day.reviewDue) p.push('복습할 날')
  if (day.challenge) p.push(`챌린지 ${day.challenge.dayIndex}일째 ${CHALLENGE_STATE_SPOKEN[day.challenge.state]}`)
  return p.join(', ')
}

const CHALLENGE_STATE_SPOKEN: Record<ChallengeDayState, string> = {
  MET: '달성',
  PARTIAL: '일부',
  MISSED: '놓침',
  TODAY: '오늘, 진행 중',
  UPCOMING: '예정',
  STOPPED: '그만둠',
}

// ── 요약 3칸 · 빈 달 안내 ────────────────────────────────────────────────────────

export interface SummaryTile {
  value: string
  label: string
}

/** 이번 달 = 출석·공부·지금 연속 출석 / 지난 달 = 출석·공부·그 달 최장 연속. `summary` 가 없으면(오류) 값은 `–`. */
export function summaryTiles(summary: CalendarSummary | null, month: string, today: string): SummaryTile[] {
  const isCur = month === monthOf(today)
  const ml = monthWord(month, today)
  const third = isCur ? '지금 연속 출석' : `${ml} 최장 연속`
  const v = (n: number | undefined) => (summary && typeof n === 'number' ? `${n}일` : '–')
  return [
    { value: v(summary?.attendedDays), label: `${ml} 출석` },
    { value: v(summary?.studyDays), label: `${ml} 공부` },
    { value: v(isCur ? summary?.streak : summary?.longestStreak), label: third },
  ]
}

/** 요약 칸의 달 이름: 이번 달이면 "이번 달", 아니면 "8월". */
export function monthWord(month: string, today: string): string {
  return month === monthOf(today) ? '이번 달' : `${Number(month.slice(5, 7))}월`
}

export type MonthNote = { kind: 'first' } | { kind: 'empty'; text: string } | null

export function monthNote(days: CalendarDay[], month: string, today: string): MonthNote {
  if (days.some((d) => d.logCount > 0)) return null
  if (month === monthOf(today)) return { kind: 'first' }
  return { kind: 'empty', text: `${Number(month.slice(5, 7))}월에는 공부 기록이 없어요.` }
}

/** 달력 칸 초점(roving tabindex) 시작점: 열린 날 → 오늘(이번 달) → 1일. */
export function focusDate(month: string, today: string, openDay: string | null): string {
  if (openDay && monthOf(openDay) === month && openDay <= today) return openDay
  if (month === monthOf(today)) return today
  return `${month}-01`
}

/** 방향키 → 날짜 이동 폭(주 7일). */
export function arrowDelta(key: string): number | null {
  switch (key) {
    case 'ArrowLeft':
      return -1
    case 'ArrowRight':
      return 1
    case 'ArrowUp':
      return -7
    case 'ArrowDown':
      return 7
    default:
      return null
  }
}

// ── 하루 상세 ─────────────────────────────────────────────────────────────────

export interface DayNav {
  prev: string
  next: string
  canPrev: boolean
  canNext: boolean
  whyPrev: string
  whyNext: string
}

/** 시트 안 ‹ › — 같은 달 안에서만, 다음 날은 오늘까지. */
export function dayNav(date: string, today: string): DayNav {
  const prev = addDays(date, -1)
  const next = addDays(date, 1)
  return {
    prev,
    next,
    canPrev: monthOf(prev) === monthOf(date),
    canNext: monthOf(next) === monthOf(date) && next <= today,
    whyPrev: '이 달의 첫날이에요',
    whyNext: next > today ? '다음 날은 아직 오지 않았어요' : '이 달의 마지막 날이에요',
  }
}

/** 시트 머리 줄: `기록 3개 · 공부 시간 26분` — 시간은 잰 기록만 더한다(회화·채팅은 재지 않음). 기록이 없으면 빈 문자열. */
export function dayStatusLine(logs: StudyLogItem[]): string {
  if (!logs.length) return ''
  const sec = logs.reduce((a, l) => a + (typeof l.durationSec === 'number' && l.durationSec > 0 ? l.durationSec : 0), 0)
  const minutes = Math.round(sec / 60)
  return `기록 ${logs.length}개${minutes > 0 ? ` · 공부 시간 ${minutes}분` : ''}`
}

/** 목록 맨 아래 안내 — 시간을 재지 않는 기록(회화·채팅)이 있을 때만. */
export function needsUntimedNote(logs: StudyLogItem[]): boolean {
  return logs.some((l) => l.durationSec == null && (l.type === 'TALK' || l.type === 'CHAT' || l.type === 'ASK'))
}

export type EmptyDay = 'future' | 'today' | 'attended' | 'none'

export function emptyDayKind(date: string, today: string, attended: boolean): EmptyDay {
  if (date > today) return 'future'
  if (date === today) return 'today'
  return attended ? 'attended' : 'none'
}

export interface ReviewLine {
  tone: 'due' | 'plain'
  title: string
  sub: string | null
  /** [복습하러 가기] — 오늘 차례면 주 버튼, 지난 차례면 보조 버튼. */
  action: 'primary' | 'ghost' | null
}

/** 그날 복습 한 줄(데모 reviewLine). 끝낸 날에 복습 수업 기록이 있으면 목록으로 대신한다(null). */
export function reviewLine(review: DayReview | null, date: string, today: string, logs: StudyLogItem[]): ReviewLine | null {
  if (!review) return null
  const s = review.status
  if (s === 'DONE' && logs.some((l) => l.type === 'REVIEW')) return null
  if (s === 'DUE' && date === today) return { tone: 'due', title: '오늘 복습할 차례예요', sub: '선생님이 지난 수업 기록을 보고 정한 날이에요.', action: 'primary' }
  if (s === 'DUE' && date < today) return { tone: 'due', title: '이날 복습할 차례였어요', sub: '아직 하지 않았어요. 공부 탭에서 이어서 할 수 있어요.', action: 'ghost' }
  if (s === 'DUE') return { tone: 'due', title: '이날 복습할 차례예요', sub: '선생님이 지난 수업 기록을 보고 정한 날이에요. 날짜는 선생님이 다시 정할 수도 있어요.', action: null }
  if (s === 'DONE') return { tone: 'plain', title: '이날 복습을 끝냈어요', sub: null, action: null }
  return { tone: 'plain', title: '이날 복습은 지나갔어요', sub: '선생님이 다음 복습 날을 다시 정했어요.', action: null }
}

// ── 기록 한 줄 ─────────────────────────────────────────────────────────────────

/** `오후 8:40`(KST) */
export function timeLabel(iso: string): string {
  const hm = formatClock(iso)
  if (!hm) return ''
  const h = Number(hm.slice(0, 2))
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${hm.slice(3)}`
}

/** 걸린 시간: 10분 넘으면 분 반올림, 1분 미만은 초, 그 사이는 `2분 36초`. */
export function durationLabel(sec: number): string {
  const s0 = Math.max(0, Math.round(sec))
  const m = Math.floor(s0 / 60)
  const s = s0 % 60
  if (m >= 10) return `${Math.round(s0 / 60)}분`
  if (!m) return `${s}초`
  return `${m}분${s ? ` ${s}초` : ''}`
}

function turnsOf(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const t = (result as { turns?: unknown }).turns
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? Math.floor(t) : 0
}

/** `2분 36초 · 메시지 12개 · 교정 3건` 조각들(없는 값은 뺀다). */
export function logMeta(log: StudyLogItem): string[] {
  const out: string[] = []
  if (typeof log.durationSec === 'number' && log.durationSec > 0) out.push(durationLabel(log.durationSec))
  const turns = log.type === 'TALK' || log.type === 'CHAT' || log.type === 'ASK' ? turnsOf(log.result) : 0
  if (turns > 0) out.push(`메시지 ${turns}개`)
  if (log.correctionsCount > 0) out.push(`교정 ${log.correctionsCount}건`)
  return out
}

/**
 * 서버가 레슨 기록 요약 앞에 붙이는 말(learning/lessons/lifecycle 의 `오늘의 회화 「주제」 · …`). 서버 형식이 바뀌면 여기 한 곳만 맞춘다
 * — 어긋나면 복습 기록도 그냥 서버 요약대로 보일 뿐 깨지지는 않는다.
 */
export const LESSON_SUMMARY_PREFIX = '오늘의 회화 「'
const REVIEW_SUMMARY_PREFIX = '복습 「'

/**
 * 복습 수업 기록의 요약은 서버가 레슨과 같은 형식(`LESSON_SUMMARY_PREFIX`)으로 만든다 — 목록에서는 종류와 맞게 `복습 「…」` 로 보여 준다
 * (데모 v1 표기, Leader 확인 ②). 저장된 문구는 바꾸지 않는다.
 */
export function displaySummary(log: Pick<StudyLogItem, 'type' | 'summary'>): string {
  if (log.type === 'REVIEW' && log.summary.startsWith(LESSON_SUMMARY_PREFIX)) return `${REVIEW_SUMMARY_PREFIX}${log.summary.slice(LESSON_SUMMARY_PREFIX.length)}`
  return log.summary
}

const SOURCE_PATH: Partial<Record<StudyType, string>> = {
  WORDS: '/study/today/words/',
  LESSON: '/study/today/talk/',
  REVIEW: '/study/today/talk/',
  EVALUATION: '/study/today/eval/',
  TALK: '/study/ai/talk/',
  CHAT: '/study/ai/chat/',
}

export type LinkState = 'open' | 'gone' | 'none'

/** 원본 이동: 열 수 있음 / 원본이 지워짐(배지) / 열 원본이 없음(질문 등 — 링크 없음). */
export function linkState(log: Pick<StudyLogItem, 'type' | 'refId' | 'refExists'>): LinkState {
  if (!log.refId || !SOURCE_PATH[log.type]) return 'none'
  return log.refExists ? 'open' : 'gone'
}

export function sourceHref(log: Pick<StudyLogItem, 'type' | 'refId' | 'refExists'>): string | null {
  if (linkState(log) !== 'open' || !log.refId) return null
  return `${SOURCE_PATH[log.type]}${encodeURIComponent(log.refId)}`
}

// ── 지우기 확인 ────────────────────────────────────────────────────────────────

export const DELETE_MAIN = '이 기록만 지워요. 통계와 성장 기록은 그대로예요.'

/**
 * 확인 시트 설명 줄. 달력 요약의 "…공부 N일"은 기록에서 세므로 그날 마지막 기록을 지우면 하루 줄어든다 —
 * 그 경우에만 한 문장을 더해 "통계는 그대로"와 헷갈리지 않게 한다(Leader 확인 ①).
 */
export function deleteDetail(log: Pick<StudyLogItem, 'type'>, isLastOfDay: boolean, month: string, today: string): string {
  const parts = [TYPE_META[log.type].keep]
  if (isLastOfDay) parts.push(`이날 남은 기록이 없어서 달력의 ‘${monthWord(month, today)} 공부’ 일수는 하루 줄어요.`)
  parts.push('지운 기록은 되돌릴 수 없어요.')
  return parts.join(' ')
}
