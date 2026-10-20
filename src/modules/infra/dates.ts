/**
 * 날짜 경계·KST 처리 — **달력 날짜는 `YYYY-MM-DD` 문자열이 유일한 표현**이다.
 *
 * 왜 문자열인가: `Date` 로 달력 날짜를 다루면 "어느 시간대의 자정인가"가 매번 따라붙고,
 * 그 답이 코드 지점마다 달라지는 순간 하루가 밀린다. 문자열은 시간대를 갖지 않는다.
 *
 * **Prisma `@db.Date` 왕복 규칙(2026-09-11 실측)**: MariaDB `DATE` 컬럼은 Prisma 가
 * **UTC 자정** `Date` 로 읽어 준다. 쓸 때도 UTC 자정으로 넣어야 같은 날로 왕복한다.
 * 서버 로컬 시간대가 KST(UTC+9)라 `new Date(2026, 8, 12)`(로컬 자정)를 넣으면
 * 실제로는 `2026-09-11T15:00Z` 이고 Prisma 가 UTC 날짜만 잘라 **9/11 로 저장**한다 —
 * 실측에서 9/11 행과 유니크 충돌(P2002)로 재현했다. 그래서 DB 로 가는 모든 날짜는
 * 반드시 `toDbDate()` 를 거친다.
 */

/** KST 는 고정 오프셋(+9)이고 서머타임이 없다 — 오프셋 하나로 충분하다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 조회 구간 상한. 없으면 `from=1900-01-01` 한 방으로 전체 테이블을 훑게 된다. */
export const MAX_RANGE_DAYS = 366

/**
 * 사용자 입력이 계약을 어겼을 때 던진다. 라우트가 잡아 **400 + 사람이 읽는 문구**로 바꾼다.
 *
 * 가장 아래 계층인 이 모듈에 두는 이유: `nutrition/*`·`meals/*` 가 전부 이 클래스를
 * 던지는데, 상위 모듈에 두면 순환 import 가 된다.
 */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidInputError'
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** `YYYY-MM-DD` 형식이면서 **실재하는 날짜**인지(2026-02-30 은 거짓). */
export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  )
}

export function assertDateString(value: unknown, field = 'date'): string {
  if (!isDateString(value)) {
    throw new InvalidInputError(`${field} 는 YYYY-MM-DD 형식의 실제 날짜여야 합니다`)
  }
  return value
}

/** UTC 구성요소로 달력 날짜 문자열을 만든다(로컬 시간대에 의존하지 않는다). */
function fromUtcParts(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
}

/** 지금 이 순간의 **KST 달력 날짜**. 서버 시간대 설정과 무관하게 같은 답을 준다. */
export function todayKst(now: Date = new Date()): string {
  return fromUtcParts(new Date(now.getTime() + KST_OFFSET_MS))
}

/** 달력 날짜 → Prisma `@db.Date` 에 넣을 `Date`(UTC 자정). */
export function toDbDate(date: string, field = 'date'): Date {
  const valid = assertDateString(date, field)
  return new Date(
    Date.UTC(Number(valid.slice(0, 4)), Number(valid.slice(5, 7)) - 1, Number(valid.slice(8, 10))),
  )
}

/** Prisma `@db.Date` 에서 읽은 값 → 달력 날짜 문자열. */
export function fromDbDate(value: Date): string {
  return fromUtcParts(value)
}

export function addDays(date: string, days: number): string {
  const base = toDbDate(date)
  base.setUTCDate(base.getUTCDate() + days)
  return fromUtcParts(base)
}

/**
 * 주 시작 요일(0 = 일요일). 달력·성장 탭·질문 탭 «이번 주»가 이 상수 하나를 같이 쓴다
 * — 2026-10-20 사용자 결정(task-080 Q8·Q9), 2026-10-01 task-012 c=B «월요일»을 대체.
 */
export const WEEK_START_DOW = 0

/** 그 날짜가 속한 주의 첫날(`WEEK_START_DOW` 요일). 달력 문자열의 UTC 요일로 계산해 시간대와 무관하다. */
export function weekStartOf(date: string): string {
  const dow = toDbDate(date).getUTCDay()
  return addDays(date, -((dow - WEEK_START_DOW + 7) % 7))
}

/** 문자열 비교로 충분하다 — `YYYY-MM-DD` 는 사전순 = 시간순이다. */
export function compareDateStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** `from` 이 `to` 보다 늦거나 구간이 너무 길면 던진다. */
export function assertRange(from: string, to: string): { from: string; to: string } {
  assertDateString(from, 'from')
  assertDateString(to, 'to')
  if (compareDateStrings(from, to) > 0) {
    throw new InvalidInputError('from 은 to 보다 늦을 수 없습니다')
  }
  if (countDays(from, to) > MAX_RANGE_DAYS) {
    throw new InvalidInputError(`조회 구간은 최대 ${MAX_RANGE_DAYS}일까지입니다`)
  }
  return { from, to }
}

/** 양 끝 포함 일수. */
export function countDays(from: string, to: string): number {
  const ms = toDbDate(to).getTime() - toDbDate(from).getTime()
  return Math.floor(ms / 86_400_000) + 1
}

/** 양 끝 포함 날짜 목록. 구간 검증을 먼저 통과해야 한다. */
export function eachDateInRange(from: string, to: string): string[] {
  assertRange(from, to)
  const out: string[] = []
  for (let cursor = from; compareDateStrings(cursor, to) <= 0; cursor = addDays(cursor, 1)) {
    out.push(cursor)
  }
  return out
}

/** Prisma `where.date` 에 넣을 양 끝 포함 범위. */
export function dbDateRange(from: string, to: string): { gte: Date; lte: Date } {
  return { gte: toDbDate(from, 'from'), lte: toDbDate(to, 'to') }
}

/** 그 달의 1일·말일. 월 그리드 조회용. */
export function monthBounds(date: string): { from: string; to: string } {
  const valid = assertDateString(date)
  const year = Number(valid.slice(0, 4))
  const month = Number(valid.slice(5, 7))
  const first = `${year}-${pad2(month)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: first, to: `${year}-${pad2(month)}-${pad2(lastDay)}` }
}

/** `on` 날짜 기준 만 나이. 생일이 아직 안 지났으면 1을 뺀다. */
export function ageOn(birthDate: string, on: string): number {
  const birth = assertDateString(birthDate, 'birthDate')
  const at = assertDateString(on, 'date')
  let age = Number(at.slice(0, 4)) - Number(birth.slice(0, 4))
  // 월·일을 문자열로 비교한다 — `MM-DD` 도 사전순 = 시간순이다.
  if (at.slice(5) < birth.slice(5)) age -= 1
  return age
}
