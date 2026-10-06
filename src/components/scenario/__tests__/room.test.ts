import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Err } from '@/components/common/errors'
import {
  autoCollapseStep,
  createSingleFlight,
  endBlockedReason,
  finishFailureOf,
  isRolePlayEndedRejection,
  learnerTurns,
  mergeProgress,
  practiceTargetOf,
  progressNews,
  shouldAutoCollapse,
} from '../logic'
import { checkChoice, practiceFailureOf, practiceModeOf, readPractice, splitBlank } from '../practiceLogic'
import { ROOM } from '../scenarioCopy'

const err = (status: number, details: Record<string, unknown> = {}, code: string | null = null): Err => ({ status, message: '', code, details, retryAfterSec: null })
const EXPR = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]

/* ── splitBlank ───────────────────────────────────────────────────────── */

test('splitBlank: 코드포인트 [start, end) 로 자른다(서로게이트 쌍도 한 글자)', () => {
  assert.deepEqual(splitBlank('コーヒーをください', { start: 0, end: 4 }), { before: '', answer: 'コーヒー', after: 'をください' })
  assert.deepEqual(splitBlank('𠮷野家に行きます', { start: 1, end: 3 }), { before: '𠮷', answer: '野家', after: 'に行きます' })
  // 끝 = 길이(마지막 글자까지)
  assert.deepEqual(splitBlank('はい', { start: 1, end: 2 }), { before: 'は', answer: 'い', after: '' })
})

test('splitBlank: 범위가 틀리면 null', () => {
  const ja = 'はい、どうぞ'
  assert.equal(splitBlank(ja, { start: 2, end: 2 }), null, '빈 구간')
  assert.equal(splitBlank(ja, { start: 3, end: 2 }), null, '거꾸로')
  assert.equal(splitBlank(ja, { start: -1, end: 2 }), null, '음수')
  assert.equal(splitBlank(ja, { start: 0, end: 7 }), null, '길이(6) 초과')
  assert.equal(splitBlank(ja, { start: 0.5, end: 2 }), null, '정수 아님')
  assert.equal(splitBlank(ja, { start: '0', end: 2 }), null, '글')
  assert.equal(splitBlank(ja, null), null)
  assert.equal(splitBlank(ja, [0, 2]), null)
  // 경계 정확값: end = 길이는 통과
  assert.ok(splitBlank(ja, { start: 0, end: 6 }))
})

/* ── readPractice · checkChoice ───────────────────────────────────────── */

const RAW = { messageId: 'm1', ja: 'コーヒーをください', ko: '커피 주세요', blank: { start: 0, end: 4 }, choices: ['お茶', 'コーヒー', 'ジュース'], answerIndex: 1, hintKo: '마실 것' }

test('readPractice: 고르기 세트가 맞으면 그대로', () => {
  const v = readPractice(RAW, 'm1')
  assert.ok(v)
  assert.equal(v.ja, RAW.ja)
  assert.deepEqual(v.choose, { before: '', answer: 'コーヒー', after: 'をください', choices: ['お茶', 'コーヒー', 'ジュース'], answerIndex: 1 })
  assert.equal(v.hintKo, '마실 것')
  assert.equal(checkChoice(v.choose!, 1), true)
  assert.equal(checkChoice(v.choose!, 0), false)
  assert.equal(checkChoice(v.choose!, 2), false)
})

test('readPractice: 세트 중 하나라도 어긋나면 고르기만 버린다(문장·뜻은 남음)', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['정답 위치가 빈칸 글과 다름', { answerIndex: 0 }],
    ['보기 2개', { choices: ['お茶', 'コーヒー'] }],
    ['보기 겹침', { choices: ['コーヒー', 'コーヒー', 'お茶'] }],
    ['빈 보기', { choices: ['', 'コーヒー', 'お茶'] }],
    ['정답 위치 3', { answerIndex: 3 }],
    ['빈칸 범위 밖', { blank: { start: 0, end: 40 } }],
    ['빈칸 없음', { blank: undefined }],
  ]
  for (const [why, over] of cases) {
    const v = readPractice({ ...RAW, ...over }, 'm1')
    assert.ok(v, why)
    assert.equal(v.choose, null, why)
    assert.equal(v.ko, '커피 주세요', why)
  }
})

test('readPractice: 다른 말의 응답·빈 문장·모양 틀림 = null, 빈 힌트 = null', () => {
  assert.equal(readPractice(RAW, 'm2'), null)
  assert.equal(readPractice({ ...RAW, ja: '  ' }, 'm1'), null)
  assert.equal(readPractice({ ...RAW, ko: 3 }, 'm1'), null)
  assert.equal(readPractice(null, 'm1'), null)
  assert.equal(readPractice([RAW], 'm1'), null)
  assert.equal(readPractice({ ...RAW, hintKo: ' ' }, 'm1')?.hintKo, null)
  // messageId 칸이 없으면 요청한 말로 본다
  assert.equal(readPractice({ ja: 'はい', ko: '네' }, 'm1')?.messageId, 'm1')
})

test('practiceModeOf: 마지막 방식(기본 고르기), 고르기 세트가 없으면 따라 하기', () => {
  assert.equal(practiceModeOf(null, true), 'choose')
  assert.equal(practiceModeOf('say', true), 'say')
  assert.equal(practiceModeOf('repeat', false), 'repeat')
  assert.equal(practiceModeOf('choose', false), 'repeat')
  assert.equal(practiceModeOf(null, false), 'repeat')
  assert.equal(practiceModeOf('weird', true), 'choose')
  assert.equal(practiceModeOf('say', false), 'say')
})

test('practiceFailureOf: 상태별 판 상태', () => {
  assert.deepEqual(practiceFailureOf(err(0), false), { kind: 'error' })
  assert.deepEqual(practiceFailureOf(err(500), false), { kind: 'error' })
  assert.deepEqual(practiceFailureOf(err(404), false), { kind: 'error' }, '아직 없는 API')
  assert.deepEqual(practiceFailureOf(err(405), false), { kind: 'error' })
  assert.deepEqual(practiceFailureOf(err(409, { reason: 'NOT_LATEST' }), true), { kind: 'error' }, '시간 초과가 먼저')
  assert.deepEqual(practiceFailureOf(err(429, { retryAfterSec: 7 }), false), { kind: 'rate', sec: 7 })
  assert.deepEqual(practiceFailureOf({ ...err(429), retryAfterSec: 3 }, false), { kind: 'rate', sec: 3 })
  assert.deepEqual(practiceFailureOf(err(429), false), { kind: 'rate', sec: 10 })
  assert.deepEqual(practiceFailureOf(err(409, { reason: 'NOT_LATEST' }), false), { kind: 'stale' })
  assert.deepEqual(practiceFailureOf(err(409, { reason: 'TURN_RUNNING' }), false), { kind: 'busy' })
  assert.deepEqual(practiceFailureOf(err(409, { reason: 'ENDED' }), false), { kind: 'ended' })
  assert.deepEqual(practiceFailureOf(err(409, { reason: 'ROLEPLAY_ENDED' }), false), { kind: 'ended' })
  assert.deepEqual(practiceFailureOf(err(409, {}, 'NOT_LATEST'), false), { kind: 'stale' }, 'code 로 와도')
  assert.deepEqual(practiceFailureOf(err(409, { reason: 'X' }), false), { kind: 'error' })
})

/* ── 진행 값 ─────────────────────────────────────────────────────────── */

test('mergeProgress: 표현은 합집합(목록 순서), 단계는 최댓값 — 뒤로 가지 않는다', () => {
  assert.deepEqual(mergeProgress({ usedIds: ['e3'], stepIndex: 2 }, { usedIds: ['e1'], stepIndex: 1 }, EXPR), { usedIds: ['e1', 'e3'], stepIndex: 2 })
  assert.deepEqual(mergeProgress({ usedIds: ['e1'], stepIndex: null }, { usedIds: ['e1', 'e2'], stepIndex: null }, EXPR), { usedIds: ['e1', 'e2'], stepIndex: null })
  assert.deepEqual(mergeProgress({ usedIds: [], stepIndex: null }, { usedIds: [], stepIndex: 0 }, EXPR), { usedIds: [], stepIndex: 0 })
  assert.deepEqual(mergeProgress(null, undefined, EXPR), { usedIds: [], stepIndex: null })
  // 모르는 id·이상한 단계 값은 버린다
  assert.deepEqual(mergeProgress({ usedIds: ['zz', 'e2'], stepIndex: -1 }, { usedIds: ['e2'], stepIndex: 1.5 }, EXPR), { usedIds: ['e2'], stepIndex: null })
  // 다음 값이 비어도 앞 값 유지(✓ 를 지우지 않는다)
  assert.deepEqual(mergeProgress({ usedIds: ['e1', 'e2'], stepIndex: 3 }, { usedIds: [], stepIndex: null }, EXPR), { usedIds: ['e1', 'e2'], stepIndex: 3 })
})

test('progressNews: 새 ✓ 만, 단계는 앞으로 갈 때만', () => {
  const view = { keyExpressions: [{ id: 'e1', ja: 'いらっしゃいませ', ko: '' }, { id: 'e2', ja: 'お願いします', ko: '' }], steps: [{ ko: '인사' }, { ko: '주문' }] }
  assert.deepEqual(progressNews({ usedIds: ['e1'], stepIndex: null }, { usedIds: ['e1', 'e2'], stepIndex: null }, view), [ROOM.usedAnnounce('お願いします')])
  assert.deepEqual(progressNews({ usedIds: [], stepIndex: 0 }, { usedIds: [], stepIndex: 1 }, view), [ROOM.stepAnnounce('주문')])
  assert.deepEqual(progressNews({ usedIds: [], stepIndex: 1 }, { usedIds: [], stepIndex: 1 }, view), [])
  assert.deepEqual(progressNews({ usedIds: [], stepIndex: null }, { usedIds: [], stepIndex: 0 }, view), [ROOM.stepAnnounce('인사')])
})

test('learnerTurns · practiceTargetOf', () => {
  const ms = [
    { id: 'a', role: 'ASSISTANT' as const, status: 'DONE' as const },
    { id: 'u', role: 'USER' as const, status: 'DONE' as const },
  ]
  assert.equal(learnerTurns(ms), 1)
  assert.equal(learnerTurns([]), 0)
  assert.equal(practiceTargetOf(ms), null, '마지막이 내 말')
  assert.equal(practiceTargetOf(ms.slice(0, 1)), 'a', '첫마디만 있는 방')
  assert.equal(practiceTargetOf([{ id: 'p', role: 'ASSISTANT', status: 'PENDING' }]), null, '진행 중 답')
  assert.equal(practiceTargetOf([{ id: 'f', role: 'ASSISTANT', status: 'FAILED' }]), null)
  assert.equal(practiceTargetOf([{ id: 't', role: 'ASSISTANT', status: 'DONE', localStatus: 'SENDING' }]), null)
  assert.equal(practiceTargetOf([]), null)
})

test('shouldAutoCollapse: 첫 말 뒤 한 번, 직접 펼침·카드 안 초점이면 안 접음', () => {
  const base = { turns: 1, alreadyDone: false, userOpened: false, goalOpen: true, focusInside: false }
  assert.equal(shouldAutoCollapse(base), true)
  assert.equal(shouldAutoCollapse({ ...base, turns: 0 }), false)
  assert.equal(shouldAutoCollapse({ ...base, alreadyDone: true }), false)
  assert.equal(shouldAutoCollapse({ ...base, userOpened: true }), false)
  assert.equal(shouldAutoCollapse({ ...base, goalOpen: false }), false)
  assert.equal(shouldAutoCollapse({ ...base, focusInside: true }), false)
})

test('autoCollapseStep: 첫 말을 본 순간 딱 한 번만 판단한다', () => {
  const o = { active: true, turns: 0, userOpened: false, goalOpen: true, focusInside: false }
  // 말 0 → 판단 안 함
  assert.deepEqual(autoCollapseStep(false, o), { done: false, collapse: false })
  // 첫 말 → 접음, 이후 다시 펼쳐도(직접) 두 번째 말에서 다시 접지 않음
  const first = autoCollapseStep(false, { ...o, turns: 1 })
  assert.deepEqual(first, { done: true, collapse: true })
  assert.deepEqual(autoCollapseStep(first.done, { ...o, turns: 2 }), { done: true, collapse: false })
  // 첫 말 때 카드 안 초점이면 안 접고, 그 뒤에도 접지 않는다(한 번만)
  const kept = autoCollapseStep(false, { ...o, turns: 1, focusInside: true })
  assert.deepEqual(kept, { done: true, collapse: false })
  assert.deepEqual(autoCollapseStep(kept.done, { ...o, turns: 2 }), { done: true, collapse: false })
  // 다시 들어온 방(이미 말 ≥1, 카드 닫힘) — 첫 판단에서 끝
  assert.deepEqual(autoCollapseStep(false, { ...o, turns: 5, goalOpen: false }), { done: true, collapse: false })
  // 역할극이 아니면 아무 일도 없음
  assert.deepEqual(autoCollapseStep(false, { ...o, active: false, turns: 3 }), { done: false, collapse: false })
})

test('createSingleFlight: 도는 중 다시 부르면 무시 · 실패면 풀림 · 성공(hold)이면 잠긴 채', async () => {
  const f = createSingleFlight()
  let calls = 0
  let fail = true
  let release: () => void = () => {}
  const work = () =>
    new Promise<string>((res, rej) => {
      calls++
      release = () => (fail ? rej(new Error('x')) : res('ok'))
    })
  const a = f.run(work, true)
  const b = await f.run(work, true)
  assert.deepEqual(b, { ran: false }, '두 번째 누름은 요청 없음')
  assert.equal(calls, 1)
  assert.equal(f.isBusy(), true)
  release()
  const ra = await a
  assert.equal(ra.ran && !ra.ok, true, '실패')
  assert.equal(f.isBusy(), false, '실패하면 다시 시도할 수 있다')
  fail = false
  const c = f.run(work, true)
  release()
  assert.deepEqual(await c, { ran: true, ok: true, value: 'ok' })
  assert.equal(calls, 2)
  assert.equal(f.isBusy(), true, '성공(hold) 뒤에는 이동할 때까지 잠김')
  assert.deepEqual(await f.run(work, true), { ran: false })
  assert.equal(calls, 2, '기록 요청은 한 번')
  // hold=false 면 성공 뒤 풀린다
  const g = createSingleFlight()
  assert.deepEqual(await g.run(async () => 1, false), { ran: true, ok: true, value: 1 })
  assert.equal(g.isBusy(), false)
})

test('endBlockedReason: 준비 → 녹음 → 턴 순', () => {
  assert.equal(endBlockedReason({ ready: true, listening: false, turnBusy: false }), null)
  assert.equal(endBlockedReason({ ready: false, listening: true, turnBusy: true }), ROOM.endWhileLoading)
  assert.equal(endBlockedReason({ ready: true, listening: true, turnBusy: true }), ROOM.endWhileListening)
  assert.equal(endBlockedReason({ ready: true, listening: false, turnBusy: true }), ROOM.endWhileTurn)
})

test('finishFailureOf · isRolePlayEndedRejection', () => {
  assert.equal(finishFailureOf(err(409, { reason: 'NO_TURNS' })), 'noTurns')
  assert.equal(finishFailureOf(err(409, { reason: 'TURN_RUNNING' })), 'busy')
  assert.equal(finishFailureOf(err(409)), 'busy')
  assert.equal(finishFailureOf(err(0)), 'fail')
  assert.equal(finishFailureOf(err(502)), 'fail')
  assert.equal(finishFailureOf(err(429)), 'fail')
  assert.equal(finishFailureOf(err(400, { field: 'chatId', reason: 'not_scenario' })), 'fail')
  assert.equal(isRolePlayEndedRejection(409, { reason: 'ROLEPLAY_ENDED' }), true)
  assert.equal(isRolePlayEndedRejection(409, { reason: 'UTTERANCE_USED' }), false)
  assert.equal(isRolePlayEndedRejection(400, { reason: 'ROLEPLAY_ENDED' }), false)
  assert.equal(isRolePlayEndedRejection(409, null), false)
})
