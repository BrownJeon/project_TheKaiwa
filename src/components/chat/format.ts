/**
 * 채팅 화면의 시각·글자 수 표기(KST). 순수 모듈 — 테스트에서 `now` 를 주입한다.
 *
 * 서버 타임스탬프는 UTC ISO(api-contract §0-6)이고 화면은 한국 시각으로 읽는다. 기기 시간대가
 * 한국이 아니어도(해외 출장) 달력·출석과 같은 날짜로 보이게 `Asia/Seoul` 로 고정한다.
 */

const TZ = 'Asia/Seoul'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

interface KstParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
})

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function kstParts(d: Date): KstParts {
  const map: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(d)) map[p.type] = p.value
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  }
}

function toDate(iso: string): Date | null {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

/** KST 달력 날짜 `YYYY-MM-DD`(날짜 구분선·그룹 기준). 잘못된 값이면 빈 문자열. */
export function kstDateKey(iso: string): string {
  const d = toDate(iso)
  if (!d) return ''
  const p = kstParts(d)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

/** `HH:mm` */
export function formatClock(iso: string): string {
  const d = toDate(iso)
  if (!d) return ''
  const p = kstParts(d)
  return `${pad2(p.hour)}:${pad2(p.minute)}`
}

/** 목록 시각: 오늘 `HH:mm` · 어제 `어제` · 올해 `M월 D일` · 그 외 `YYYY.M.D`. */
export function formatListTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = toDate(iso)
  if (!d) return ''
  const p = kstParts(d)
  const key = kstDateKey(iso)
  if (key === kstDateKey(now.toISOString())) return `${pad2(p.hour)}:${pad2(p.minute)}`
  // KST 는 서머타임이 없어 24시간 전의 KST 날짜가 곧 어제다.
  if (key === kstDateKey(new Date(now.getTime() - 86_400_000).toISOString())) return '어제'
  if (p.year === kstParts(now).year) return `${p.month}월 ${p.day}일`
  return `${p.year}.${p.month}.${p.day}`
}

/** 날짜 구분선: `9월 27일 (일)`, 올해가 아니면 앞에 `2025년`. */
export function formatDateDivider(iso: string, now: Date = new Date()): string {
  const d = toDate(iso)
  if (!d) return ''
  const p = kstParts(d)
  const head = p.year === kstParts(now).year ? '' : `${p.year}년 `
  return `${head}${p.month}월 ${p.day}일 (${WEEKDAYS[p.weekday]})`
}

/** 서버와 같은 기준의 글자 수(코드포인트). `.length` 는 이모지를 2로 센다. */
export function cpLength(s: string): number {
  return Array.from(s).length
}

/** 같은 역할 말풍선을 한 묶음으로 보는 간격(5분). */
export const GROUP_GAP_MS = 5 * 60 * 1000

export function withinGroupGap(aIso: string, bIso: string): boolean {
  const a = toDate(aIso)
  const b = toDate(bIso)
  if (!a || !b) return false
  return Math.abs(b.getTime() - a.getTime()) <= GROUP_GAP_MS
}
