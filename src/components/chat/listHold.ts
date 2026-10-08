/**
 * 회화·채팅 홈에서 「채택을 기다리는 교정」 카드와 목록이 함께 나타나게 하는 판단(task-046 T2b, IMP-0027).
 *
 * 카드는 0건·오류면 아무것도 그리지 않고 있을 때만 약 252px 섹션이 생긴다. 카드와 목록이 별도 요청이라
 * 도착 순서가 갈리면 그려진 쪽이 다른 쪽 때문에 밀린다 — 그래서 둘 다 끝난 뒤 한 번에 그린다.
 * 카드 요청이 느릴 때 목록을 오래 막지 않도록 상한을 둔다(상한 뒤에 카드가 늦게 오면 기존처럼 위에 생긴다).
 */

/** 카드 요청을 기다리는 최대 시간(ms). 이 시간이 지나면 카드를 기다리지 않고 목록을 그린다. */
export const LIST_HOLD_CAP_MS = 1500

/**
 * 목록 데이터가 와 있어도 자리표시를 유지할지. 카드 요청이 끝났거나(성공·0건·오류 모두) 상한이 지나면 푼다.
 * 시간이 갈수록 true → false 로만 바뀐다 — 이미 목록을 그린 뒤에 자리표시로 되돌아가지 않는다.
 */
export function shouldHoldList(cardSettled: boolean, capElapsed: boolean): boolean {
  return !cardSettled && !capElapsed
}

/**
 * 카드 데이터가 와 있어도 그리지 않을지. 목록이 첫 결과(데이터·오류)를 받기 전에 카드만 그리면
 * 아래의 목록 자리표시가 카드 높이만큼 밀려 내려간다.
 */
export function shouldHoldCard(listSettled: boolean): boolean {
  return !listSettled
}

/** 타이머 예약 함수 — 시험에서 가짜로 바꾼다. */
export type Schedule = (fn: () => void, ms: number) => ReturnType<typeof setTimeout>

/**
 * 목록 첫 읽기가 실패했을 때의 순서(REV-171 L-4). 오류 상자를 보이는 일(`showError`)과 「첫 결과가 정해졌다」는 알림(`settle`)은
 * **항상 같은 호출(같은 틱)에서 이 순서로** 일어난다 — `settle` 이 먼저 가면 부모가 교정 카드를 오류 상자보다 먼저 공개한다.
 * `holdMs`(다시 시도 직후 실패가 너무 빨리 돌아오지 않게 하는 유예, `retryFailHoldMs`)가 있으면 둘 다 그 시간 뒤다. 반환값은 유예 타이머(없으면 undefined) — 호출한 쪽이 정리한다.
 */
export function settleFirstFailure(
  holdMs: number,
  fx: { showError: () => void; settle: () => void },
  schedule: Schedule = setTimeout,
): ReturnType<typeof setTimeout> | undefined {
  const fire = () => {
    fx.showError()
    fx.settle()
  }
  if (holdMs <= 0) {
    fire()
    return undefined
  }
  return schedule(fire, holdMs)
}
