/**
 * 화면 읽기 전용 대체 버튼(제스처의 단일 포인터 대체 수단, WCAG 2.5.1)의 모양: 평소 `sr-only`, Tab 으로 닿으면(`:focus-visible`) 작은 테두리 칩(WCAG 2.4.7).
 * 앞면 안내 자리의 [뜻 보기]·[객관식](`FlipControls`)과 도구 줄의 [건너뛰기](`DeckToolbar`)가 같은 모양을 쓴다.
 *
 * `not-sr-only` 는 position 을 static 으로 되돌려 자리 밖으로 밀어내고 같은 변형의 `absolute` 와 우선순위도 불확실해서 쓰지 않는다 —
 * sr-only 가 숨기는 속성(크기·여백·잘림)만 초점 상태에서 되돌린다(각 속성이 서로 다른 유틸이고 변형 구체성 (0,2,0) 이 기본 `.sr-only` (0,1,0) 를 이긴다).
 * 위치는 sr-only 의 absolute 그대로 — 쓰는 쪽이 부모에 `relative` 를 주면 `inset-0 m-auto` 로 그 자리 가운데에 뜬다. 부모 높이는 바뀌지 않는다.
 */
export const SR_CHIP =
  'sr-only focus-visible:inset-0 focus-visible:m-auto focus-visible:h-8 focus-visible:w-fit focus-visible:overflow-visible focus-visible:[clip-path:none] ' +
  'focus-visible:rounded-full focus-visible:border focus-visible:border-line focus-visible:bg-surface focus-visible:px-3 focus-visible:text-[13px] focus-visible:font-semibold focus-visible:text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
