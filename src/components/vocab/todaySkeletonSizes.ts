/**
 * 오늘 탭 자리표시 상수(task-046 IMP-0027, T3) — 값은 클래스 합산이 아니라 **실제 렌더를 `getBoundingClientRect` 로 잰 값**이다
 * (task-045 교훈). 근거: QA 3 계정에 N5 기본 단어 50개를 넣은 상태(= 단어가 있는 흔한 상태)의 최종 안정 화면, 개발 서버, 360/390/412 폭,
 * 스크립트 `tests/live/p3-qa-ui/flicker/t3-heights.mjs`. 폭을 360→416 으로 4px 씩 훑어 줄바꿈이 바뀌는 지점을 찾았다.
 *
 * 값과 그리는 곳은 `vocab/__tests__/todaySkeleton.test.ts` 가 묶어 둔다 — 한쪽만 바뀌면 시험이 깨진다.
 * 조건부 섹션(챌린지 띠·복습 카드·「곧 열려요」·통계·보관 세트)은 있을 때만 생기므로 자리표시에 넣지 않는다.
 *
 * ⚠ task-059: `word` 만 **실측이 아니라 클래스 합으로 계산한 임시값**이다 — QA 가 실제 브라우저로 재측정해 바꾼다(screens.md §23-7 A, `t3-heights.mjs` `ONLY=today`).
 */
import type { CSSProperties } from 'react'

/**
 * 카드 하나의 전체 높이(테두리 포함). `narrow` = `narrowBelow`px 보다 좁은 폭의 값(글줄이 한 줄 더 감긴다), `wide` = 그 이상.
 *  - word: 단어 카드 「준비」 상태(장수·[시작하기]). 단어장이 비어 있으면 240 안팎(이제 이 값보다 크다 — §23-7 A), 분류가 둘 이상이면 이보다 크다(조건부).
 *    **임시값(QA 재측정 필요)**: task-046 실측 305/285.5 에서 빠진 「방식」 줄(라벨 `mt-3` 12 + 12.5px×줄높이 1.5 = 18.75 + `mb-1.5` 6
 *    + `Segmented sm` 3+32+3 = 38, 합 74.75)을 뺐다. 폭 경계 370 은 설명 문구(D8 A 그대로)의 줄바꿈이라 그대로 둔다.
 *  - lesson: 오늘의 회화 카드 시작 상태(추천 주제 + [오늘 수업 만들기]) — 폭과 무관.
 *  - eval: AI 평가 카드 시작 상태(두 갈래 타일).
 */
export const TODAY_CARD_H = {
  word: { narrow: 230.25, wide: 210.75, narrowBelow: 370 },
  lesson: { narrow: 253.6, wide: 253.6, narrowBelow: 0 },
  eval: { narrow: 217.1, wide: 199.1, narrowBelow: 362 },
} as const

/** 카드 테두리(1+1) + 안쪽 여백(14+14) + 머리줄(제목 15px × 1.5) + 머리줄과 몸통 사이(mt-2) — 몸통 자리표시 높이 = 카드 높이 − 이 값. */
export const TODAY_CARD_CHROME = { border: 2, padding: 28, head: 22.5, gap: 8 } as const
export const TODAY_CARD_CHROME_H = TODAY_CARD_CHROME.border + TODAY_CARD_CHROME.padding + TODAY_CARD_CHROME.head + TODAY_CARD_CHROME.gap

/** 카드 사이 간격 — 실제 `section.mt-[18px]` 와 같다. */
export const TODAY_CARD_GAP = 18

export type TodayCardKind = keyof typeof TODAY_CARD_H

/** CSS 에서 읽을 값(px 문자열) — 클래스는 리터럴로 두고 숫자만 변수로 넘긴다(Tailwind 가 클래스를 정적으로 찾으므로). */
export function cardHeightVars(kind: TodayCardKind, body = false): CSSProperties {
  const sub = body ? TODAY_CARD_CHROME_H : 0
  const h = TODAY_CARD_H[kind]
  return { '--h-n': `${round1(h.narrow - sub)}px`, '--h-w': `${round1(h.wide - sub)}px` } as CSSProperties
}

const round1 = (n: number) => Math.round(n * 10) / 10
