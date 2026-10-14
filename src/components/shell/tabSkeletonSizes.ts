/**
 * 탭 화면 자리표시 상수(task-046 IMP-0027, T2) — 값은 클래스 합산이 아니라 **실제 렌더를 `getBoundingClientRect` 로 잰 값**이다
 * (task-045 교훈: 클래스로 정한 자리표시는 실제와 어긋났다). 측정 근거는 task-046 이력서 「Developer 기록 (T2)」 표.
 * 어긋나면 그 차이만큼 아래가 밀린다 — `shell/__tests__/tabSkeleton.test.ts` 가 값과 그리는 클래스를 묶어 둔다.
 */

/** 스크린리더에만 읽히는 한 줄 — 보이는 「불러오는 중…」 글자는 그리지 않는다(깜빡임의 한 원인). */
export const SKELETON_SR_LABEL = '불러오고 있어요'

/**
 * 회화·채팅 목록 한 줄(`ChatListItem`) — 실측(task-046 T2, 360/390/412 모두 같음): 67.5 · 67.5 · 68.5(상태 뱃지가 붙은 줄 +1), 목록 `ul` 219.5 = 줄 3 + `gap-2` 8×2.
 * 줄 수는 첫 화면을 채우는 수(7~8)가 아니라 **흔한 상태의 중간값** — 많으면 아래로 늘고 적으면 아래만 줄어 위쪽 블록은 움직이지 않는다.
 */
export const CHAT_SKELETON = { rows: 5, rowHeight: 67.5, gap: 8 } as const

/**
 * 단어장 목록 한 줄(`WordRow`) — 실측(단어 50개 N5, 앞 30개, 표시 설정 기본 = 히라가나·한글 켬, 세 폭 모두 같음): 줄 93.8~105.8, 목록 `ul` 3120.7 → 줄 사이 divide 1 을
 * 포함한 평균 피치 = (3120.7−2)/30 ≈ 104. 한글 줄을 끄면 더 낮다. 줄 수 7 = 한 쪽 행 수(task-068 D1 — 쪽 넘김 회색 자리도 7줄, 이 높이를 쓴다).
 */
export const WORD_SKELETON = { rows: 7, rowHeight: 104 } as const

/**
 * 칩 줄 높이 — 실측 래퍼 [top 112, h 44] = `mt-1.5`(6) + `py-1`(4+4) + 칩 `h-9`(36). 교정 모음 「유형」 줄 자리표시(`ErrorTypeRowSkeleton`)가 쓴다.
 * task-068: 단어장 분류 칩 줄 자리표시는 지웠다(난이도 이름 칩이 빠져 흔한 상태가 「줄 없음」 — 자리표시가 오히려 접힘을 만든다, §28-10 ⑦).
 */
export const WORD_CATEGORY_ROW = { top: 6, pad: 4, chip: 36, widths: [52, 72, 64, 80] } as const

/**
 * 채택 교정 모음 카드 자리표시(task-055 §21-7 C) — 줄 수는 흔한 상태의 중간값 3(목록 시작 ≈298 + 카드 ≈280 이면 첫 화면은 1개 + 걸침 1개라 아래로 넘친다),
 * 간격은 목록 `gap-2.5`(10). **카드 높이 280 은 아직 실측값이 아니다** — 승인 데모 렌더 평균 275~287(히라가나·한글 켬·접힘, 헤드리스 시스템 글꼴)의
 * 가운데 값이다. QA 재측정: QA 계정(채택 교정 ≥ 3) · 켬·접힘 · 360/390/412 에서 첫 3개 카드 `getBoundingClientRect().height` 평균을 task-055 이력서에
 * 표로 남기고 이 값을 바꾼다(task-046 방식). 어긋나면 카드 3개 아래(더 보기·끝 표시)만 밀리고 첫 카드 위쪽은 움직이지 않는다.
 */
export const CORRECTION_SKELETON = { rows: 3, cardHeight: 280, gap: 10 } as const

/** 교정 모음 「유형」 칩 줄 자리표시의 칩 폭(데모 자리표시 — 높이와 무관). 줄 높이는 `WORD_CATEGORY_ROW`(같은 `mt-1.5`·`py-1`·`h-9`)를 쓴다. */
export const CORRECTION_TYPE_ROW = { widths: [56, 64, 60, 72] } as const
