import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  answerStartPlan,
  ARRIVAL_WINDOW_MS,
  arrivalTarget,
  endsWithDoneAnswer,
  isArrival,
  isTopInView,
  measureArrivalTarget,
  questionIdBefore,
  rowTop,
  windowGrowthAction,
  type ScrollBoxLike,
} from '../arrivalAlign'

// task-064 QA64-B2-1 · screens.md §25-5 J — 답 도착·재진입 스크롤 위치. 계산·판정은 순수 함수, 합격선은 J-7 표(허용 ±2px, 바닥은 ±1).

const PAD = 12
/** 360×740 · 390×844 · 412×892 에서 방 목록의 보이는 높이(화면 − 157, J-1). */
const WIDTHS = [
  { w: 360, C: 583 },
  { w: 390, C: 687 },
  { w: 412, C: 735 },
] as const
/** 누가 줄(아바타 28 + 간격 8) — 답 `<li>` 윗면에서 `article` 윗면까지. */
const WHO = 36

const near = (actual: number, expected: number, tol = 2, msg = '') => assert.ok(Math.abs(actual - expected) <= tol, `${msg} ${actual} !≈ ${expected} (±${tol})`)

/** 위쪽 대화 700px 뒤에 질문(한 줄 말풍선 + 간격) → 답 행. `ansH` 는 답 `<li>` 높이(누가 줄 포함). */
function scene(o: { C: number; ansH: number; qRow?: number; qTop?: number }) {
  const qTop = o.qTop ?? 700
  const qRow = o.qRow ?? 79 // 질문 `<li>` 높이(1줄 ≈67 + 시각 줄) — 답 `<li>` 의 위 간격 12 는 아래에서 더한다
  const aTop = qTop + qRow + 12
  const scrollHeight = aTop + o.ansH + PAD
  const target = arrivalTarget({ aTop, qTop, clientHeight: o.C, scrollHeight, padTop: PAD })
  return { qTop, aTop, scrollHeight, target, max: scrollHeight - o.C }
}

for (const { w, C } of WIDTHS) {
  test(`J-7 긴 답 도착 ${w}px — 질문 <li> 윗면이 목록 위 12±2 에, 답 article 윗면은 [pad+36, ⌊C/3⌋+pad+36]`, () => {
    const s = scene({ C, ansH: WHO + 793 }) // QA A2: article 793
    assert.ok(s.target < s.max, '바닥보다 위에서 멈춘다(답이 목록보다 길다)')
    near(s.qTop - s.target, 12, 2, '질문 윗면')
    const article = s.aTop + WHO - s.target
    assert.ok(article >= PAD + WHO - 2 && article <= Math.floor(C / 3) + PAD + WHO + 2, `article 윗면 ${article}`)
  })

  test(`J-7 4,000자 답 도착·재진입 ${w}px — 긴 답과 같은 위치(시작이 5,100px 위로 밀리지 않는다)`, () => {
    const s = scene({ C, ansH: WHO + 5743 })
    near(s.qTop - s.target, 12, 2, '질문 윗면')
    const article = s.aTop + WHO - s.target
    assert.ok(article >= PAD + WHO - 2 && article <= Math.floor(C / 3) + PAD + WHO + 2, `article 윗면 ${article}`)
  })

  test(`J-7 짧은 답 도착(되묻기 답) ${w}px — 질문+답이 목록에 다 들어오면 정확히 바닥(±1), 질문 말풍선도 보인다`, () => {
    const s = scene({ C, ansH: 250 })
    near(s.target, s.max, 1, '바닥')
    assert.ok(s.qTop - s.target >= 0, '질문 윗면이 목록 안')
  })
}

test('J-7 질문 행이 ⌊C/3⌋ 보다 길면(8줄 질문) 답 <li> 윗면 − 목록 위 = 12 + ⌊C/3⌋ (360 → 206)', () => {
  const C = 583
  const s = scene({ C, ansH: WHO + 793, qRow: 300 }) // aTop − qTop = 312
  near(s.aTop - s.target, PAD + Math.floor(C / 3), 2, '답 <li> 윗면')
  assert.equal(Math.floor(C / 3), 194)
  near(s.aTop - s.target, 206, 2)
})

test('J-7 키보드가 열려 목록이 낮아도(C≈283) 답 <li> 윗면 ≤ 12 + 94, 답 article 이 ≥130px 보인다 — 질문 1줄·2줄 모두', () => {
  const C = 283
  for (const qRow of [79, 102]) {
    const s = scene({ C, ansH: WHO + 793, qRow })
    const liOffset = s.aTop - s.target
    assert.ok(liOffset <= PAD + 94 + 2, `qRow ${qRow}: 답 <li> 윗면 ${liOffset}`)
    assert.ok(C - (liOffset + WHO) >= 130, `qRow ${qRow}: article 이 보이는 높이 ${C - (liOffset + WHO)}`)
  }
})

test('앞 행이 내 질문이 아니면(qTop 없음) lead 0 — 답 <li> 윗면이 목록 위 12 에 온다', () => {
  const aTop = 900
  const target = arrivalTarget({ aTop, qTop: null, clientHeight: 583, scrollHeight: aTop + 2000, padTop: PAD })
  assert.equal(target, aTop - PAD)
})

test('질문이 답보다 아래로 잡힌 이상 입력(음수 간격)도 lead 0 으로 — 답 윗면 기준', () => {
  const target = arrivalTarget({ aTop: 900, qTop: 950, clientHeight: 583, scrollHeight: 5000, padTop: PAD })
  assert.equal(target, 900 - PAD)
})

test('padTop 은 목록의 실제 안쪽 여백 — 글자 크기를 키워 여백이 커지면 같이 커진다', () => {
  const base = { aTop: 900, qTop: 800, clientHeight: 583, scrollHeight: 5000 }
  assert.equal(arrivalTarget({ ...base, padTop: 12 }), 800 - 12)
  assert.equal(arrivalTarget({ ...base, padTop: 24 }), 800 - 24)
})

test('clamp 아래끝 — 맨 위 행이면 음수가 아니라 0', () => {
  // 첫 질문 행의 윗면은 목록 안쪽 여백(12) 위치 → qTop − pad = 0, 더 위로 잡혀도 0 아래로 가지 않는다
  assert.equal(arrivalTarget({ aTop: 91, qTop: 12, clientHeight: 583, scrollHeight: 4000, padTop: PAD }), 0)
  assert.equal(arrivalTarget({ aTop: 40, qTop: 5, clientHeight: 583, scrollHeight: 4000, padTop: PAD }), 0)
})

test('clamp 위끝 — 내용이 목록보다 낮으면(max 0) 0, 목록이 내용보다 커도 음수가 되지 않는다', () => {
  assert.equal(arrivalTarget({ aTop: 300, qTop: 200, clientHeight: 583, scrollHeight: 500, padTop: PAD }), 0)
  assert.equal(arrivalTarget({ aTop: 300, qTop: 200, clientHeight: 583, scrollHeight: 583, padTop: PAD }), 0)
})

test('clamp 위끝 — 정렬 위치가 바닥보다 아래로 잡히면 바닥(max)', () => {
  const t = arrivalTarget({ aTop: 5000, qTop: 4900, clientHeight: 583, scrollHeight: 5300, padTop: PAD })
  assert.equal(t, 5300 - 583)
})

test('경계 — 답이 목록보다 겨우 큰 경우: 딱 맞으면 바닥, +1 이면 바닥에서 1, −1 이면 바닥(clamp)', () => {
  const C = 583
  const lead = 91
  const base = 700 // qTop
  const aTop = base + lead
  const fitH = C - lead - 2 * PAD // lead + 답 + pad×2 = C 가 되는 답 높이
  const at = (ansH: number) => {
    const scrollHeight = aTop + ansH + PAD
    return { target: arrivalTarget({ aTop, qTop: base, clientHeight: C, scrollHeight, padTop: PAD }), max: scrollHeight - C }
  }
  assert.equal(at(fitH).target, at(fitH).max)
  assert.equal(at(fitH + 1).target, at(fitH + 1).max - 1)
  assert.equal(at(fitH - 1).target, at(fitH - 1).max)
  assert.equal(at(fitH + 40).target, base - PAD, '조금 더 길면 질문 윗면 정렬로 넘어간다')
})

test('⌊C/3⌋ 는 소수점 아래를 버린다 — C 584 → 194', () => {
  const t = arrivalTarget({ aTop: 1000, qTop: 0, clientHeight: 584, scrollHeight: 9000, padTop: PAD })
  assert.equal(t, 1000 - 194 - PAD)
})

// ── 질문 행 찾기 ─────────────────────────────────────────────────────────────

test('questionIdBefore — 바로 앞이 내 질문일 때만 그 id', () => {
  const ms = [
    { id: 'u1', role: 'USER' },
    { id: 'a1', role: 'ASSISTANT' },
    { id: 'a2', role: 'ASSISTANT' },
    { id: 'u2', role: 'USER' },
    { id: 'a3', role: 'ASSISTANT' },
  ]
  assert.equal(questionIdBefore(ms, 'a1'), 'u1')
  assert.equal(questionIdBefore(ms, 'a2'), null, '앞이 선생님 답')
  assert.equal(questionIdBefore(ms, 'a3'), 'u2')
  assert.equal(questionIdBefore(ms, 'u1'), null, '첫 행')
  assert.equal(questionIdBefore(ms, 'zz'), null, '없는 id')
})

// ── 도착 판정 · 규칙 갈림 ────────────────────────────────────────────────────

const DONE = { role: 'ASSISTANT', status: 'DONE' }

test('endsWithDoneAnswer — 끝난 선생님 답만', () => {
  assert.equal(endsWithDoneAnswer(DONE), true)
  assert.equal(endsWithDoneAnswer({ role: 'ASSISTANT', status: 'PENDING' }), false)
  assert.equal(endsWithDoneAnswer({ role: 'ASSISTANT', status: 'FAILED' }), false)
  assert.equal(endsWithDoneAnswer({ role: 'USER', status: 'DONE' }), false)
  assert.equal(endsWithDoneAnswer(undefined), false)
})

test('isArrival — 대기·실패였거나 없던 id 가 DONE 이 되면 도착, 이미 DONE 이면(제안만 바뀜·앞붙임) 아니다', () => {
  assert.equal(isArrival('PENDING', DONE), true)
  assert.equal(isArrival('FAILED', DONE), true, '[다시 받기] 뒤 도착')
  assert.equal(isArrival(undefined, DONE), true, '폴링이 한 번에 가져온 답')
  assert.equal(isArrival('DONE', DONE), false)
  assert.equal(isArrival('PENDING', { role: 'ASSISTANT', status: 'PENDING' }), false, '대기 행이 생기는 것은 도착이 아니다')
  assert.equal(isArrival(undefined, { role: 'USER', status: 'DONE' }), false, '내 질문이 붙는 것')
})

test('answerStartPlan 규칙 3 — 첫 로드: 마지막이 끝난 답이면 (바닥 여부와 무관하게) 정렬', () => {
  for (const atBottom of [true, false]) {
    assert.equal(answerStartPlan({ firstLoad: true, last: DONE, prevStatus: undefined, atBottom }), 'align')
  }
})

test('answerStartPlan 규칙 3′ — 첫 로드: 대기·실패·내 질문뿐·빈 방은 지금처럼(default = 맨 아래)', () => {
  const none = { prevStatus: undefined, atBottom: true, firstLoad: true }
  assert.equal(answerStartPlan({ ...none, last: { role: 'ASSISTANT', status: 'PENDING' } }), 'default')
  assert.equal(answerStartPlan({ ...none, last: { role: 'ASSISTANT', status: 'FAILED' } }), 'default')
  assert.equal(answerStartPlan({ ...none, last: { role: 'USER', status: 'DONE' } }), 'default')
  assert.equal(answerStartPlan({ ...none, last: undefined }), 'default')
})

test('answerStartPlan 규칙 1·2 — 도착: 바닥 120px 안이면 정렬, 위로 올려 뒀으면 알약(위치 유지)', () => {
  assert.equal(answerStartPlan({ firstLoad: false, last: DONE, prevStatus: 'PENDING', atBottom: true }), 'align')
  assert.equal(answerStartPlan({ firstLoad: false, last: DONE, prevStatus: 'PENDING', atBottom: false }), 'pill')
  assert.equal(answerStartPlan({ firstLoad: false, last: DONE, prevStatus: 'FAILED', atBottom: false }), 'pill')
})

test('answerStartPlan — 도착이 아닌 변화(제안만 바뀜·앞붙임·대기 행 생김·임시 말풍선 걷힘)는 default', () => {
  assert.equal(answerStartPlan({ firstLoad: false, last: DONE, prevStatus: 'DONE', atBottom: true }), 'default')
  assert.equal(answerStartPlan({ firstLoad: false, last: DONE, prevStatus: 'DONE', atBottom: false }), 'default')
  assert.equal(answerStartPlan({ firstLoad: false, last: { role: 'ASSISTANT', status: 'PENDING' }, prevStatus: undefined, atBottom: true }), 'default')
  assert.equal(answerStartPlan({ firstLoad: false, last: { role: 'USER', status: 'DONE' }, prevStatus: undefined, atBottom: true }), 'default')
})

// ── 알약 사라짐 · 2초 창 ─────────────────────────────────────────────────────

test('isTopInView — 답 행 윗면이 보이는 영역([scrollTop, scrollTop+C]) 안일 때만', () => {
  assert.equal(isTopInView(1000, 400, 583), false, '아래로 벗어남')
  assert.equal(isTopInView(300, 400, 583), false, '위로 벗어남')
  assert.equal(isTopInView(983, 400, 583), true, '아래 끝선')
  assert.equal(isTopInView(400, 400, 583), true, '위 끝선')
  assert.equal(isTopInView(984, 400, 583), false)
})

test('정렬 유지 창은 2초', () => {
  assert.equal(ARRIVAL_WINDOW_MS, 2000)
})

test('windowGrowthAction — 창 안·안 만짐 → 다시 맞춤(바닥 여부와 무관하게 따라가기 대신)', () => {
  const base = { now: 1500, windowUntil: 2000, touched: false, holdUntil: 0 }
  assert.equal(windowGrowthAction({ ...base, atBottom: true }), 'realign')
  assert.equal(windowGrowthAction({ ...base, atBottom: false }), 'realign')
})

test('windowGrowthAction — 만졌거나 창이 끝났으면 기존 규칙(바닥이면 따라가기, 아니면 그대로)', () => {
  assert.equal(windowGrowthAction({ now: 1500, windowUntil: 2000, touched: true, atBottom: true, holdUntil: 0 }), 'follow')
  assert.equal(windowGrowthAction({ now: 1500, windowUntil: 2000, touched: true, atBottom: false, holdUntil: 0 }), 'none')
  assert.equal(windowGrowthAction({ now: 2000, windowUntil: 2000, touched: false, atBottom: true, holdUntil: 0 }), 'follow', '창 끝 시각 정각 = 끝')
  assert.equal(windowGrowthAction({ now: 2001, windowUntil: 2000, touched: false, atBottom: false, holdUntil: 0 }), 'none')
  assert.equal(windowGrowthAction({ now: 100, windowUntil: 0, touched: false, atBottom: true, holdUntil: 0 }), 'follow', '창이 없던 방')
})

test('windowGrowthAction — 사용자가 접이식 줄을 펼친 직후(hold)는 창 안에서도 정렬하지 않는다', () => {
  assert.equal(windowGrowthAction({ now: 1500, windowUntil: 2000, touched: false, atBottom: true, holdUntil: 1800 }), 'hold')
})

// ── DOM 측정(가짜 목록 상자) ─────────────────────────────────────────────────

/** 내용 좌표 `tops`(id → 윗면)의 행을 가진 가짜 스크롤 상자. 행의 화면 좌표 = 상자 윗면 + 내용 좌표 − scrollTop. */
function fakeBox(tops: Record<string, number>, o: { boxTop: number; scrollTop: number; clientHeight: number; scrollHeight: number }): ScrollBoxLike {
  const rows = Object.entries(tops).map(([id, top]) => ({
    getBoundingClientRect: () => ({ top: o.boxTop + top - o.scrollTop }),
    getAttribute: (name: string) => (name === 'data-mid' ? id : null),
  }))
  return {
    scrollTop: o.scrollTop,
    clientHeight: o.clientHeight,
    scrollHeight: o.scrollHeight,
    getBoundingClientRect: () => ({ top: o.boxTop }),
    querySelectorAll: () => rows,
  }
}

test('rowTop — 스크롤 위치·상자 위치와 무관하게 스크롤 내용 좌표', () => {
  for (const scrollTop of [0, 250, 1049]) {
    for (const boxTop of [0, 96]) {
      const box = fakeBox({ u1: 700, a1: 791 }, { boxTop, scrollTop, clientHeight: 583, scrollHeight: 1632 })
      assert.equal(rowTop(box, 'u1'), 700)
      assert.equal(rowTop(box, 'a1'), 791)
    }
  }
  assert.equal(rowTop(fakeBox({ u1: 700 }, { boxTop: 0, scrollTop: 0, clientHeight: 583, scrollHeight: 900 }), 'nope'), null)
})

test('measureArrivalTarget — 지금 스크롤 위치에서 재도 같은 정렬 위치(질문 윗면 − pad)', () => {
  const tops = { u1: 700, a1: 791 }
  for (const scrollTop of [0, 300, 1049]) {
    const box = fakeBox(tops, { boxTop: 96, scrollTop, clientHeight: 583, scrollHeight: 1632 })
    assert.equal(measureArrivalTarget(box, PAD, 'a1', 'u1'), 700 - PAD)
  }
})

test('measureArrivalTarget — 질문 행이 없으면 답 윗면 기준, 답 행이 없으면 null', () => {
  const box = fakeBox({ a1: 791 }, { boxTop: 0, scrollTop: 0, clientHeight: 583, scrollHeight: 3000 })
  assert.equal(measureArrivalTarget(box, PAD, 'a1', null), 791 - PAD)
  assert.equal(measureArrivalTarget(box, PAD, 'a1', 'u1'), 791 - PAD, '질문 행이 DOM 에 없으면(앞붙임 전) 답 윗면')
  assert.equal(measureArrivalTarget(box, PAD, 'zz', null), null)
})
