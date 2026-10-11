import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canNext,
  canPeek,
  cardSide,
  clampResponseMs,
  classifyGesture,
  countOptions,
  createSerialQueue,
  createStopwatch,
  estimateMinutes,
  frontierOf,
  keyAction,
  markChoice,
  pickNotice,
  resistX,
  surfaceSize,
  tallyCards,
  type KeyContext,
} from '../deck'

test('classifyGesture: 탭 10px 미만 · 위 −80 초과 · 좌우 60 초과(bjj 부등호 그대로)', () => {
  assert.equal(classifyGesture(0, 0), 'tap')
  assert.equal(classifyGesture(5, 4), 'tap', '합 9 → 탭')
  assert.equal(classifyGesture(6, 4), 'none', '합 10 → 탭 아님')
  assert.equal(classifyGesture(0, -80), 'none', 'dy −80 은 위가 아니다')
  assert.equal(classifyGesture(0, -81), 'up')
  assert.equal(classifyGesture(-60, 0), 'none', '|dx| 60 은 좌우가 아니다')
  assert.equal(classifyGesture(-61, 0), 'left')
  assert.equal(classifyGesture(61, 0), 'right')
  assert.equal(classifyGesture(-100, -100), 'up', '대각선 위는 위가 먼저')
  assert.equal(classifyGesture(100, 79), 'right', '아래 대각선은 좌우')
})

test('resistX: 막힌 방향만 ×0.25', () => {
  assert.equal(resistX(-100, false, true), -25, '안 답한 카드를 왼쪽(다음)으로')
  assert.equal(resistX(100, true, false), 25, '첫 카드를 오른쪽(이전)으로')
  assert.equal(resistX(-100, true, false), -100)
  assert.equal(resistX(100, false, true), 100)
})

const card = (answer: 'CORRECT' | 'WRONG' | 'SKIPPED' | null, flagged = false) => ({ answered: answer !== null, answer, flagged })

test('frontierOf·canNext: 부분 답·전부 답·마지막 카드', () => {
  const partial = [card('CORRECT'), card('WRONG'), card(null), card(null)]
  assert.equal(frontierOf(partial), 2)
  assert.equal(frontierOf([card('CORRECT'), card('SKIPPED')]), 2, '모두 답했으면 cardCount')
  assert.equal(frontierOf([]), 0)
  assert.equal(canNext(partial, 1), true)
  assert.equal(canNext(partial, 2), false, '안 답한 카드는 다음으로 못 간다')
  assert.equal(canNext([card('CORRECT'), card('CORRECT')], 1), false, '마지막 카드는 다음이 없다(결과 보기)')
  // answered 플래그 없이 answer 만 와도 답한 것으로 본다
  assert.equal(frontierOf([{ answered: false, answer: 'CORRECT' }, { answered: false, answer: null }]), 1)
})

test('tallyCards: 맞힘·틀림·건너뜀·표시 합계', () => {
  const t = tallyCards([card('CORRECT', true), card('WRONG'), card('SKIPPED', true), card(null)])
  assert.deepEqual(t, { answered: 3, correct: 1, wrong: 1, skipped: 1, flagged: 2 })
})

test('cardSide·canPeek: FLIP 은 뜻이 있을 때만 뒤집어 본다(F1), 답한 카드는 늘 뒷면', () => {
  assert.equal(canPeek('FLIP', { meaning: '영화' }), true)
  assert.equal(canPeek('FLIP', { meaning: null }), false)
  assert.equal(canPeek('CHOICE', { meaning: '영화' }), false)
  assert.equal(cardSide('CHOICE', card(null), true), 'front', 'CHOICE 는 뒤집기 없음')
  assert.equal(cardSide('FLIP', card(null), true), 'back')
  assert.equal(cardSide('FLIP', card(null), false), 'front')
  assert.equal(cardSide('CHOICE', card('WRONG'), false), 'back')
})

test('markChoice: 답하기 전에는 정답을 표시하지 않고, 응답의 correctText 로만 가른다', () => {
  const unanswered = { answered: false, answer: null, correctText: null, chosenText: null }
  assert.equal(markChoice('영화', unanswered, null), 'idle')
  assert.equal(markChoice('영화', unanswered, '영화'), 'pending')
  assert.equal(markChoice('음악', unanswered, '영화'), 'dim')
  const wrong = { answered: true, answer: 'WRONG' as const, correctText: '영화', chosenText: '음악' }
  assert.equal(markChoice('영화', wrong, null), 'correct')
  assert.equal(markChoice('음악', wrong, null), 'mine')
  assert.equal(markChoice('사진', wrong, null), 'other')
  const skipped = { answered: true, answer: 'SKIPPED' as const, correctText: '영화', chosenText: null }
  assert.equal(markChoice('영화', skipped, null), 'correct')
  assert.equal(markChoice('음악', skipped, null), 'other')
})

test('surfaceSize: 코드포인트 기준 40/34/28/22px, 최소 22px', () => {
  assert.equal(surfaceSize('映画'), 'text-[40px]')
  assert.equal(surfaceSize('食べる'), 'text-[40px]')
  assert.equal(surfaceSize('ありがとう'), 'text-[34px]')
  assert.equal(surfaceSize('よろしくお願い'), 'text-[28px]')
  assert.equal(surfaceSize('よろしくお願いします'), 'text-[28px]')
  assert.equal(surfaceSize('よろしくお願いいたします'), 'text-[22px]')
  assert.equal(surfaceSize('😀😀😀'), 'text-[40px]', '이모지 3개 = 3자')
})

test('clampResponseMs: 0~60,000 으로 자른다', () => {
  assert.equal(clampResponseMs(-5), 0)
  assert.equal(clampResponseMs(Number.NaN), 0)
  assert.equal(clampResponseMs(4200.6), 4201)
  assert.equal(clampResponseMs(60_000), 60_000)
  assert.equal(clampResponseMs(60_001), 60_000)
  assert.equal(clampResponseMs(Number.POSITIVE_INFINITY), 0)
})

test('estimateMinutes·countOptions', () => {
  assert.equal(estimateMinutes(5), 2)
  assert.equal(estimateMinutes(10), 3)
  assert.equal(estimateMinutes(30), 7)
  assert.deepEqual(countOptions(10), [5, 10, 15, 20, 30])
  assert.deepEqual(countOptions(12), [5, 10, 12, 15, 20, 30])
  assert.deepEqual(countOptions(40), [5, 10, 15, 20, 30], '범위 밖 설정값은 넣지 않는다')
})

const base: KeyContext = { sheetOpen: false, mode: 'CHOICE', isCurrent: true, answered: false, side: 'front', peekable: false, focusOnControl: false }

test('keyAction: CHOICE 1~4·Space·화살표·F/R/S', () => {
  assert.deepEqual(keyAction({ key: '1' }, base), { type: 'choose', index: 0 })
  assert.deepEqual(keyAction({ key: '4', code: 'Digit4' }, base), { type: 'choose', index: 3 })
  assert.equal(keyAction({ key: '5' }, base), null)
  assert.equal(keyAction({ key: '1' }, { ...base, answered: true }), null, '답한 카드는 다시 고르지 않는다')
  assert.equal(keyAction({ key: '1' }, { ...base, isCurrent: false }), null, '지난 카드는 읽기 전용')
  assert.equal(keyAction({ key: ' ' }, base), null, '안 답한 CHOICE 에서 Space 는 아무것도 안 함')
  assert.deepEqual(keyAction({ key: 'Enter' }, { ...base, answered: true }), { type: 'advance' })
  assert.deepEqual(keyAction({ key: 'ArrowRight' }, base), { type: 'next' })
  assert.deepEqual(keyAction({ key: 'ArrowLeft' }, base), { type: 'prev' })
  assert.deepEqual(keyAction({ key: 'ArrowUp' }, base), { type: 'flag' })
  assert.deepEqual(keyAction({ key: 'f' }, base), { type: 'flag' })
  assert.deepEqual(keyAction({ key: 'ㄹ', code: 'KeyF' }, base), { type: 'flag' }, '한글 자판에서도 F 자리')
  assert.deepEqual(keyAction({ key: 'r' }, base), { type: 'reading' })
  assert.deepEqual(keyAction({ key: 'S' }, base), { type: 'skip' })
  assert.equal(keyAction({ key: 's' }, { ...base, answered: true }), null)
})

test('keyAction: FLIP — 앞면 Space 뒤집기, 뒷면 1 알았어요·2 몰랐어요', () => {
  const flip: KeyContext = { ...base, mode: 'FLIP', peekable: true }
  assert.deepEqual(keyAction({ key: ' ' }, flip), { type: 'flip' })
  assert.equal(keyAction({ key: '1' }, flip), null, '앞면에서는 먼저 뒤집는다')
  assert.deepEqual(keyAction({ key: '1' }, { ...flip, side: 'back' }), { type: 'self', result: 'CORRECT' })
  assert.deepEqual(keyAction({ key: '2' }, { ...flip, side: 'back' }), { type: 'self', result: 'WRONG' })
  assert.equal(keyAction({ key: '3' }, { ...flip, side: 'back' }), null)
  assert.deepEqual(keyAction({ key: '1' }, { ...flip, peekable: false }), { type: 'self', result: 'CORRECT' }, '대체 흐름(뜻 없음)은 앞면에서 바로 채점')
})

test('keyAction: 무시 조건(입력창·시트·조합·수정키·반복·버튼 초점의 Space/Enter)', () => {
  assert.equal(keyAction({ key: '1', targetTag: 'input' }, base), null)
  assert.equal(keyAction({ key: '1', targetTag: 'textarea' }, base), null)
  assert.equal(keyAction({ key: '1', targetTag: 'select' }, base), null)
  assert.equal(keyAction({ key: '1', targetEditable: true }, base), null)
  assert.equal(keyAction({ key: '1' }, { ...base, sheetOpen: true }), null)
  assert.equal(keyAction({ key: '1', isComposing: true }, base), null)
  assert.equal(keyAction({ key: '1', ctrlKey: true }, base), null)
  assert.equal(keyAction({ key: 'f', metaKey: true }, base), null)
  assert.equal(keyAction({ key: 'ArrowRight', altKey: true }, base), null)
  assert.equal(keyAction({ key: 'ArrowRight', repeat: true }, base), null)
  assert.equal(keyAction({ key: 'Enter' }, { ...base, answered: true, focusOnControl: true }), null)
  assert.deepEqual(keyAction({ key: '2' }, { ...base, focusOnControl: true }), { type: 'choose', index: 1 }, '숫자는 버튼 초점과 무관')
})

test('createSerialQueue: 누른 순서대로 한 줄, 앞 요청이 실패해도 뒤 요청은 간다', async () => {
  const q = createSerialQueue()
  const log: string[] = []
  const later = (name: string, ms: number, fail = false) => () =>
    new Promise<string>((resolve, reject) =>
      setTimeout(() => {
        log.push(name)
        if (fail) reject(new Error(name))
        else resolve(name)
      }, ms),
    )
  const a = q.run(later('answer', 20))
  const b = q.run(later('flag', 1, true))
  const c = q.run(later('finish', 1))
  assert.equal(await a, 'answer')
  await assert.rejects(b)
  assert.equal(await c, 'finish')
  await q.idle()
  assert.deepEqual(log, ['answer', 'flag', 'finish'], 'finish 가 앞선 답보다 먼저 도착하지 않는다')
})

test('createStopwatch: 보이는 동안만 쌓고 reset 으로 새 카드', () => {
  let t = 1000
  const sw = createStopwatch(() => t)
  sw.start()
  t += 3000
  sw.stop()
  t += 50_000 // 숨김 동안
  sw.start()
  t += 1200
  assert.equal(sw.elapsed(), 4200)
  sw.start() // 이미 도는 중이면 무시
  t += 100
  assert.equal(sw.elapsed(), 4300)
  sw.reset()
  assert.equal(sw.elapsed(), 0)
  assert.equal(sw.running, false)
})

test('pickNotice: 우선순위(강등 → 적게 만듦 → 이어 풀기 → 지난 날)', () => {
  const s = { cardCount: 10, requestedCount: 10, downgraded: false, replayOfId: null, date: '2026-09-27' }
  assert.deepEqual(pickNotice(s, 0, 'few', '2026-09-27'), { kind: 'few' })
  assert.deepEqual(pickNotice({ ...s, downgraded: true, replayOfId: 'vs_1' }, 0, null, '2026-09-27'), { kind: 'deleted' })
  assert.deepEqual(pickNotice({ ...s, downgraded: true }, 0, null, '2026-09-27'), { kind: 'few' })
  assert.deepEqual(pickNotice({ ...s, cardCount: 6 }, 0, null, '2026-09-27'), { kind: 'fewer', cardCount: 6 })
  assert.deepEqual(pickNotice(s, 3, null, '2026-09-27'), { kind: 'resume', answered: 3 })
  assert.deepEqual(pickNotice({ ...s, date: '2026-09-25' }, 0, null, '2026-09-27'), { kind: 'pastDate', date: '2026-09-25' })
  assert.equal(pickNotice(s, 0, null, '2026-09-27'), null)
})

// ── task-059 카드 우선 세트(추가 케이스 — 위 단언은 그대로) ─────────────────────────────────────

const cardFirst: KeyContext = { ...base, mode: 'FLIP', peekable: true, choices: 'closed' }

test('keyAction: 카드 우선 — C 로 열기/닫기(한글 자판 KeyC 포함), 열림이면 1~4 보기·Space 무시', () => {
  assert.deepEqual(keyAction({ key: 'c' }, cardFirst), { type: 'choices' }, '닫힘 → 열기')
  assert.deepEqual(keyAction({ key: 'C' }, { ...cardFirst, choices: 'open' }), { type: 'choices' }, '열림 → 닫기')
  assert.deepEqual(keyAction({ key: 'ㅊ', code: 'KeyC' }, cardFirst), { type: 'choices' }, '한글 자판에서도 C 자리')
  assert.deepEqual(keyAction({ key: 'c' }, { ...cardFirst, focusOnControl: true }), { type: 'choices' }, 'C 는 버튼 초점과 무관')
  assert.deepEqual(keyAction({ key: '3' }, { ...cardFirst, choices: 'open' }), { type: 'choose', index: 2 })
  assert.equal(keyAction({ key: '1' }, cardFirst), null, '닫힘에서 숫자는 무시')
  assert.equal(keyAction({ key: ' ' }, { ...cardFirst, choices: 'open' }), null, '열림에서 Space 무시')
  assert.equal(keyAction({ key: 'Enter' }, { ...cardFirst, choices: 'open' }), null, '열림에서 Enter 무시')
  assert.deepEqual(keyAction({ key: ' ' }, cardFirst), { type: 'flip' }, '닫힘에서 Space = 뜻 보기')
  assert.deepEqual(keyAction({ key: 's' }, { ...cardFirst, choices: 'open' }), { type: 'skip' }, '열림에서도 건너뛰기')
  assert.deepEqual(keyAction({ key: 'ArrowRight' }, { ...cardFirst, choices: 'open' }), { type: 'next' })
})

test('keyAction: C 무시 — 뜻 보기 면·답한 카드·지난 카드·이전 세트·보기 없는 세트·입력창', () => {
  assert.equal(keyAction({ key: 'c' }, { ...cardFirst, side: 'back' }), null, '뜻 보기 면')
  assert.equal(keyAction({ key: 'c' }, { ...cardFirst, answered: true }), null)
  assert.equal(keyAction({ key: 'c' }, { ...cardFirst, isCurrent: false }), null)
  assert.equal(keyAction({ key: 'c' }, base), null, '이전 4지선다(choices 생략)')
  assert.equal(keyAction({ key: 'c' }, { ...base, choices: 'closed' }), null, 'CHOICE 세트는 choices 가 와도 무시')
  assert.equal(keyAction({ key: 'c' }, { ...cardFirst, choices: 'none' }), null, '보기 없는 세트·이전 뒤집기')
  assert.equal(keyAction({ key: 'c', targetTag: 'input' }, cardFirst), null)
  assert.equal(keyAction({ key: 'c', ctrlKey: true }, cardFirst), null)
  assert.deepEqual(keyAction({ key: '1' }, { ...cardFirst, choices: 'none', side: 'back' }), { type: 'self', result: 'CORRECT' }, '뜻 보기 면 1·2 그대로')
})

test('pickNotice: noChoice 는 few·deleted 와 같은 최우선', () => {
  const s = { cardCount: 6, requestedCount: 10, downgraded: false, replayOfId: null, date: '2026-09-25' }
  assert.deepEqual(pickNotice(s, 0, 'noChoice', '2026-09-27', '주제 사유'), { kind: 'noChoice' })
  assert.deepEqual(pickNotice(s, 3, 'noChoice', '2026-09-27'), { kind: 'noChoice' }, '이어 풀기보다 먼저(남긴 값은 첫 열기에만 있다)')
})
