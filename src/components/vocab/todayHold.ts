/**
 * 오늘 탭 첫 화면을 **한 번에** 그리는 규칙(task-046 IMP-0027, T3) — 순수 함수. 카드 4곳(단어·회화·챌린지 띠·평가)의 요청이 도착 순서대로
 * 따로 그려지면 화면이 3~4번 바뀐다(기준선: 본문 +669px, 단계 3~4). 그래서 **모두 끝난 뒤(또는 상한이 지나면)** 한 번에 보인다.
 * 한 요청이 실패해도 「끝남」으로 센다 — 실패가 나머지를 막지 않는다. 상한은 회화 탭 목록(`chat/listHold.ts` 의 `LIST_HOLD_CAP_MS`)과 같은 값이다(파일을 겹치지 않으려고 따로 둔다).
 */

/** 이 시간이 지나면 아직 안 온 카드가 있어도 보인다(그 카드는 자기 자리표시로 남는다). */
export const TODAY_HOLD_MS = 1500

export interface TodaySettled {
  /** 단어 카드·세트·통계 묶음(`loadState !== 'loading'`) */
  home: boolean
  /** 오늘의 회화·복습 카드(#58) */
  lessons: boolean
  /** 챌린지 띠·카드 모드(#158) */
  challenge: boolean
  /** AI 평가 카드(#69·#66) */
  evaluation: boolean
}

/** 지금 첫 화면을 보여도 되는가. 한 번 참이 되면 호출한 쪽이 붙잡아 둔다(다시 로딩해도 자리표시로 돌아가지 않는다). */
export function todayRevealed(settled: TodaySettled, holdOver: boolean): boolean {
  return holdOver || (settled.home && settled.lessons && settled.challenge && settled.evaluation)
}
