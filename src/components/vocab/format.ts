/**
 * 오늘의 단어 날짜·시간 표기(screens.md §5-8 ⓓ). 순수 모듈 — `today` 는 호출부가 KST 날짜 키로 넘긴다.
 *
 * 세트 날짜(`session.date`)는 서버가 정한 KST `YYYY-MM-DD` 다(api-contract §0-6). 화면의 KST 계산은 "오늘/어제" 라벨과
 * 최근 7일 칸에만 쓴다(§5-10). 날짜 산술은 UTC 자정 기준 — 문자열 날짜는 시간대를 갖지 않는다.
 */
import { kstDateKey } from '@/components/common/format'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function parse(date: string): { y: number; m: number; d: number } | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

/** 지금의 KST 날짜 키. 렌더 중이 아니라 불러올 때 한 번 정해 상태로 둔다. */
export function todayKey(now: Date = new Date()): string {
  return kstDateKey(now.toISOString())
}

export function addDays(date: string, n: number): string {
  const p = parse(date)
  if (!p) return ''
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n))
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

export function weekdayOf(date: string): string {
  const p = parse(date)
  if (!p) return ''
  return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]
}

/** `9월 25일` */
export function formatMonthDay(date: string): string {
  const p = parse(date)
  return p ? `${p.m}월 ${p.d}일` : ''
}

/** `오늘` · `어제` · `9월 25일` */
export function formatSessionDate(date: string, today: string): string {
  if (!date) return ''
  if (today && date === today) return '오늘'
  if (today && date === addDays(today, -1)) return '어제'
  return formatMonthDay(date)
}

/** `45초` · `2분 36초` · `3분`(초가 0). 음수·없음은 빈 문자열. */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return ''
  const s = Math.round(sec)
  if (s < 60) return `${s}초`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m}분` : `${m}분 ${r}초`
}

export interface WeekDay {
  date: string
  weekday: string
  isToday: boolean
}

/** 오늘을 맨 오른쪽에 둔 최근 7일(KST). */
export function weekDays(today: string): WeekDay[] {
  if (!parse(today)) return []
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6)
    return { date, weekday: weekdayOf(date), isToday: i === 6 }
  })
}

/** 정답률(건너뜀 제외). 푼 게 없으면 null → 화면은 "—". */
export function accuracy(correct: number, wrong: number): number | null {
  const t = correct + wrong
  return t > 0 ? Math.round((correct / t) * 100) : null
}
