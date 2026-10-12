/**
 * 답 도착·재진입 스크롤 위치 계산(순수 — screens.md §25-5 J, task-064 QA64-B2-1). `MessageList arrivalAlign="answer-start"`(질문 방)만 쓴다.
 * 긴 답이 바닥에 붙으면 질문과 답의 시작이 화면 밖이라, 직전 질문 말풍선 윗면을 목록 위 여백에 맞춘다. 짧은 답은 같은 식이 바닥으로 귀결된다.
 * 값은 모두 그 순간 DOM 에서 잰 것을 받는다(키보드·안내 줄·글자 크기가 저절로 반영).
 */
import { contentGrowthAction } from './followHold'

/** 정렬 뒤 이 시간 동안은(사용자가 목록을 만지지 않았으면) 내용이 늘 때 바닥 따라가기 대신 같은 식으로 다시 맞춘다(J-3). */
export const ARRIVAL_WINDOW_MS = 2000

export interface ArrivalInput {
  /** 답 행 `<li>` 윗면(스크롤 내용 좌표) */
  aTop: number
  /** 그 답 바로 앞 메시지가 내 질문이면 그 `<li>` 윗면, 아니면 null */
  qTop: number | null
  clientHeight: number
  scrollHeight: number
  /** 목록 위 안쪽 여백(`getComputedStyle(목록).paddingTop`) */
  padTop: number
}

/**
 * J-1 `target = clamp(aTop − lead − pad, 0, max)`, `lead = qTop 없음 ? 0 : min(aTop − qTop, ⌊C/3⌋)`.
 * 질문 행이 `⌊C/3⌋` 보다 길면(1,000자 질문·키보드가 열린 좁은 목록) 답이 화면 밖으로 밀리지 않게 질문 끝부분만 보인다.
 */
export function arrivalTarget({ aTop, qTop, clientHeight, scrollHeight, padTop }: ArrivalInput): number {
  const max = Math.max(0, scrollHeight - clientHeight)
  const lead = qTop === null ? 0 : Math.min(Math.max(0, aTop - qTop), Math.floor(clientHeight / 3))
  return Math.min(Math.max(aTop - lead - padTop, 0), max)
}

/** 그 답 바로 앞 메시지가 내 질문이면 그 id(`arrivalTarget` 의 `qTop` 대상). */
export function questionIdBefore(messages: ReadonlyArray<{ id: string; role: string }>, answerId: string): string | null {
  const i = messages.findIndex((m) => m.id === answerId)
  const before = i > 0 ? messages[i - 1] : undefined
  return before && before.role === 'USER' ? before.id : null
}

type LastRow = { role: string; status: string } | undefined

/** 끝난 선생님 답으로 끝나는 목록인가(마지막 행 기준). */
export function endsWithDoneAnswer(last: LastRow): boolean {
  return !!last && last.role === 'ASSISTANT' && last.status === 'DONE'
}

/**
 * 도착 = 마지막 행이 끝난 선생님 답이고, 직전 렌더에서 그 id 행이 DONE 이 아니었거나(대기·실패) 없었다.
 * 첫 로드는 도착이 아니다(재진입 — 규칙 3). 대기 행이 생기는 것·이전 메시지를 앞에 붙이는 것·제안만 바뀌는 것도 아니다.
 * `prevStatus` 는 **직전 렌더의 같은 id 행** 상태 — 마지막 행끼리 비교하면 임시 말풍선이 걷히며 옛 답이 다시 마지막이 될 때 도착으로 오인한다.
 */
export function isArrival(prevStatus: string | undefined, last: LastRow): boolean {
  return endsWithDoneAnswer(last) && prevStatus !== 'DONE'
}

export type AnswerStartPlan =
  /** 직전 질문 윗면 정렬(규칙 1·3) */
  | 'align'
  /** 위치 유지 + 「새 답 ↓」 알약(규칙 2) */
  | 'pill'
  /** 이 규칙이 다루지 않음 — 지금 동작(맨 아래·앞붙임 유지·따라가기) */
  | 'default'

/**
 * J-2 규칙 1·2·3·3′ 의 갈림. 첫 로드: 마지막이 끝난 답이면 정렬, 대기·실패·내 질문뿐·빈 방이면 default(맨 아래).
 * 도착: 바닥 120px 안이면 정렬, 위로 올려 둔 상태면 알약.
 */
export function answerStartPlan(i: { firstLoad: boolean; last: LastRow; prevStatus: string | undefined; atBottom: boolean }): AnswerStartPlan {
  if (!endsWithDoneAnswer(i.last)) return 'default'
  if (i.firstLoad) return 'align'
  if (!isArrival(i.prevStatus, i.last)) return 'default'
  return i.atBottom ? 'align' : 'pill'
}

/** 알약이 가리키는 답 행 윗면이 보이는 영역 안인가(J-2 규칙 2 — 들어오면 알약이 사라진다). */
export function isTopInView(aTop: number, scrollTop: number, clientHeight: number): boolean {
  return aTop >= scrollTop && aTop <= scrollTop + clientHeight
}

export type GrowthAction = 'realign' | 'hold' | 'follow' | 'none'

/**
 * 내용 높이가 늘었을 때 할 일(J-3). 펼침 hold(사용자가 접이식 줄을 펼친 직후)가 먼저 — 그 증가는 정렬도 따라가기도 하지 않는다.
 * 그 밖에는 정렬 창(2초) 안이고 사용자가 목록을 만지지 않았으면 `realign`, 아니면 기존 규칙(바닥에 붙어 있었으면 `follow`).
 */
export function windowGrowthAction(i: { now: number; windowUntil: number; touched: boolean; atBottom: boolean; holdUntil: number }): GrowthAction {
  if (i.now < i.holdUntil) return 'hold'
  if (i.now < i.windowUntil && !i.touched) return 'realign'
  return contentGrowthAction(i.now, i.holdUntil, i.atBottom)
}

// ── DOM 측정(브라우저 목록 상자와 같은 모양의 값이면 시험에서 가짜로도 쓴다) ─────────────────

export interface RowLike {
  getBoundingClientRect(): { top: number }
  getAttribute(name: string): string | null
}

export interface ScrollBoxLike {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  getBoundingClientRect(): { top: number }
  querySelectorAll(selector: string): ArrayLike<RowLike>
}

/** 메시지 행 `<li data-mid>` 의 윗면 — 스크롤 내용 좌표. 행이 없으면 null. */
export function rowTop(box: ScrollBoxLike, id: string): number | null {
  const rows = box.querySelectorAll('li[data-mid]')
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].getAttribute('data-mid') === id) return rows[k].getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  }
  return null
}

/** 답 행(과 그 앞 질문 행)을 지금 DOM 에서 재서 정렬 위치를 돌려준다. 답 행이 없으면 null. */
export function measureArrivalTarget(box: ScrollBoxLike, padTop: number, answerId: string, questionId: string | null): number | null {
  const aTop = rowTop(box, answerId)
  if (aTop === null) return null
  const qTop = questionId === null ? null : rowTop(box, questionId)
  return arrivalTarget({ aTop, qTop, clientHeight: box.clientHeight, scrollHeight: box.scrollHeight, padTop })
}
