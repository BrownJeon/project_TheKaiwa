import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EvaluationDetail, EvaluationItem, EvaluationListItem } from '@/types/evaluation'
import { isFocusRoute } from '@/components/shell/routes'
import { GRADE_LABEL, LEVEL } from '../evalCopy'
import {
  cardNeedsDetail,
  choiceIndex,
  clampIndex,
  clockText,
  countByKind,
  deriveEvalCard,
  evalView,
  firstOpenIndex,
  itemTone,
  koDuration,
  levelProposalView,
  levelRo,
  listenLeft,
  listenMode,
  missingIndexes,
  recordSaveOutcome,
  remainSecOf,
  resultMeta,
  sameSpot,
  spotBody,
  spotDraftFrom,
  spotFix,
  spotReady,
  startBlock,
  submitGate,
  timerTone,
  unsavedIndexes,
  type SaveRetry,
} from '../logic'
import { evalPath, startPath } from '../paths'

const TODAY = '2026-10-01'
const NOW = Date.parse('2026-10-01T05:00:00Z')

const li = (over: Partial<EvaluationListItem> = {}): EvaluationListItem => ({
  id: 'ev1', kind: 'TALK', level: 'N4', status: 'DONE', topic: null, totalScore: 83, grade: 'GOOD',
  startedAt: '2026-10-01T04:00:00Z', deadlineAt: '2026-10-01T04:10:00Z', submittedAt: '2026-10-01T04:08:00Z', completedAt: '2026-10-01T04:09:00Z', ...over,
})
const item = (over: Partial<EvaluationItem> = {}): EvaluationItem => ({
  id: 'i1', order: 0, kind: 'MEANING_CHOICE', prompt: {}, maxScore: 10, answered: false, answerText: null, answerOrder: null, answerSpot: null, inputSource: null, answeredAt: null,
  textRevealed: false, expected: null, score: null, correct: null, feedback: null, dims: null, ...over,
})
const detail = (over: Partial<EvaluationDetail> = {}): EvaluationDetail => ({
  id: 'ev1', kind: 'TALK', level: 'N4', status: 'IN_PROGRESS', topic: null, timeLimitSec: 600, startedAt: '2026-10-01T04:55:00Z', deadlineAt: '2026-10-01T05:05:00Z',
  submittedAt: null, completedAt: null, overtime: false, jobId: null, error: null, itemCount: 6, answeredCount: 3, items: [], result: null, ...over,
})

test('타이머: 서버 마감 기준 남은 초(지나면 음수)·1분 이하 경고·지남·표기', () => {
  assert.equal(remainSecOf('2026-10-01T05:10:00Z', NOW), 600)
  assert.equal(remainSecOf('2026-10-01T05:00:00.400Z', NOW), 1)
  assert.equal(remainSecOf('2026-10-01T04:59:59.500Z', NOW), -1)
  assert.equal(remainSecOf(null, NOW), null)
  assert.equal(remainSecOf('2026-10-01T05:10:00Z', 0), null, '첫 틱 전(0)은 모름')
  assert.equal(timerTone(61), 'normal')
  assert.equal(timerTone(60), 'warn')
  assert.equal(timerTone(0), 'warn')
  assert.equal(timerTone(-1), 'over')
  assert.equal(timerTone(null), 'normal')
  assert.equal(clockText(581), '9:41')
  assert.equal(clockText(-12), '+0:12')
  assert.equal(clockText(0), '0:00')
  assert.equal(koDuration(80), '1분 20초')
  assert.equal(koDuration(12), '12초')
  assert.equal(koDuration(185), '3분 05초')
})

test('화면 갈래: 상태별 · 채점 중인데 살아 있는 잡이 없으면 실패(다시 채점)', () => {
  assert.equal(evalView({ status: 'GENERATING', jobId: 'j' }), 'gen')
  assert.equal(evalView({ status: 'FAILED', jobId: null }), 'genfail')
  assert.equal(evalView({ status: 'READY', jobId: null }), 'ready')
  assert.equal(evalView({ status: 'IN_PROGRESS', jobId: null }), 'run')
  assert.equal(evalView({ status: 'GRADING', jobId: 'j2' }), 'grading')
  assert.equal(evalView({ status: 'GRADING', jobId: null }), 'gradefail')
  assert.equal(evalView({ status: 'DONE', jobId: null }), 'result')
})

test('오늘 홈 카드: 로딩·오류·처음·진행 중 각 상태·오늘 결과·지난 결과(시작 전)', () => {
  assert.equal(deriveEvalCard('loading', null, null, TODAY, NOW).kind, 'loading')
  assert.equal(deriveEvalCard('error', null, null, TODAY, NOW).kind, 'error')
  assert.equal(deriveEvalCard('ready', null, null, TODAY, NOW).kind, 'first')
  const gen = deriveEvalCard('ready', li({ status: 'GENERATING' }), detail({ status: 'GENERATING', jobId: 'jg' }), TODAY, NOW)
  assert.deepEqual(gen.kind === 'gen' && gen.jobId, 'jg')
  const ready = deriveEvalCard('ready', li({ status: 'READY', kind: 'WORDS' }), null, TODAY, NOW)
  assert.ok(ready.kind === 'ready' && ready.itemCount === 10)
  const prog = deriveEvalCard('ready', li({ status: 'IN_PROGRESS' }), detail(), TODAY, NOW)
  assert.ok(prog.kind === 'progress' && prog.answered === 3 && prog.remain === 300)
  const over = deriveEvalCard('ready', li({ status: 'IN_PROGRESS' }), detail({ deadlineAt: '2026-10-01T04:58:40Z' }), TODAY, NOW)
  assert.ok(over.kind === 'over' && over.remain === -80)
  assert.equal(deriveEvalCard('ready', li({ status: 'GRADING' }), detail({ status: 'GRADING', jobId: 'jr' }), TODAY, NOW).kind, 'grading')
  assert.equal(deriveEvalCard('ready', li({ status: 'GRADING' }), detail({ status: 'GRADING', jobId: null, error: 'X' }), TODAY, NOW).kind, 'gradefail')
  const done = deriveEvalCard('ready', li(), detail({ status: 'DONE', result: { totalScore: 83, grade: 'GOOD', rubric: null, comment: '', nextFocus: ['に'], studyLogId: null, completedAt: null, overtime: false, durationSec: 400, levelProposal: null } }), TODAY, NOW)
  assert.ok(done.kind === 'done' && done.focus === 'に')
  const past = deriveEvalCard('ready', li({ completedAt: '2026-09-26T04:00:00Z' }), null, TODAY, NOW)
  assert.ok(past.kind === 'start' && past.last?.id === 'ev1')
  assert.equal(cardNeedsDetail(li({ completedAt: '2026-09-26T04:00:00Z' }), TODAY), false)
  assert.equal(cardNeedsDetail(li(), TODAY), true)
  assert.equal(cardNeedsDetail(li({ status: 'IN_PROGRESS' }), TODAY), true)
  assert.equal(cardNeedsDetail(null, TODAY), false)
})

test('시작 막기(b=B): 자막만이면 회화만 막고 · 단어 부족은 종류별 기준(단어 6·회화 4)', () => {
  assert.equal(startBlock('TALK', true, 50), 'TTS')
  assert.equal(startBlock('WORDS', true, 50), null)
  assert.equal(startBlock('WORDS', false, 5), 'FEW')
  assert.equal(startBlock('WORDS', false, 6), null)
  assert.equal(startBlock('TALK', false, 3), 'FEW')
  assert.equal(startBlock('TALK', false, 4), null)
  assert.equal(startBlock('WORDS', false, null), null, '단어 수를 모르면 막지 않고 서버 400 을 따른다')
})

test('번호 이동(a=B)·안 푼 문항·처음 열 문항·보기 복원', () => {
  const items = [item({ answered: true }), item({ id: 'i2' }), item({ id: 'i3', answered: true }), item({ id: 'i4' })]
  assert.deepEqual(missingIndexes(items), [1, 3])
  assert.equal(firstOpenIndex(items), 1)
  assert.equal(firstOpenIndex(items.map((i) => ({ ...i, answered: true }))), 3)
  assert.equal(clampIndex(-1, 4), 0)
  assert.equal(clampIndex(9, 4), 3)
  assert.equal(clampIndex(2.7, 4), 2)
  assert.equal(choiceIndex(['연습', '준비'], '준비'), 1)
  assert.equal(choiceIndex(['연습', '준비'], null), null)
  assert.equal(choiceIndex(['연습', '준비'], '없음'), null)
  assert.deepEqual(countByKind([item({ kind: 'LISTEN_RESPOND' }), item({ kind: 'LISTEN_RESPOND' }), item({ kind: 'ASSEMBLE' })]), [
    { kind: 'LISTEN_RESPOND', n: 2 },
    { kind: 'ASSEMBLE', n: 1 },
  ])
})

test('듣고 답하기(e=B 2번·b=B 끊기면 글자로 보기): 모드·남은 횟수', () => {
  assert.equal(listenMode({ revealed: true, textOnly: true, audioErr: true }), 'revealed')
  assert.equal(listenMode({ revealed: false, textOnly: true, audioErr: false }), 'cut')
  assert.equal(listenMode({ revealed: false, textOnly: false, audioErr: true }), 'audioErr')
  assert.equal(listenMode({ revealed: false, textOnly: false, audioErr: false }), 'normal')
  assert.deepEqual(listenLeft(0), { left: 2, text: 'twice' })
  assert.deepEqual(listenLeft(1), { left: 1, text: 'once' })
  assert.deepEqual(listenLeft(2), { left: 0, text: 'none' })
  assert.deepEqual(listenLeft(5), { left: 0, text: 'none' })
})

test('틀린 곳 찾기(f=A 조각 고르기 · 조각 없는 옛 문항은 고쳐 쓰기): 초안·준비·본문·같은 답', () => {
  const seg = item({ kind: 'CORRECTION_SPOT', prompt: { sentenceJa: '昨日、行きます。', segments: ['昨日、', '行きます。'] }, answered: true, answerText: '行きました', answerSpot: 1 })
  const d = spotDraftFrom(seg)
  assert.deepEqual(d, { seg: 1, text: '行きました', fixed: '', why: '' })
  assert.equal(spotReady(true, d, ''), true)
  assert.equal(spotReady(true, { ...d, seg: null }, ''), false)
  assert.equal(spotReady(true, { ...d, text: '  ' }, ''), false)
  assert.deepEqual(spotBody(true, d), { answerText: '行きました', spotIndex: 1 })
  assert.equal(sameSpot(true, d, seg), true)
  assert.equal(sameSpot(true, { ...d, seg: 0 }, seg), false)

  const old = item({ kind: 'CORRECTION_SPOT', prompt: { sentenceJa: '昨日、行きます。' } })
  const o = spotDraftFrom(old)
  assert.deepEqual(o, { seg: null, text: '', fixed: '昨日、行きます。', why: '' }, '원문이 든 입력칸')
  assert.equal(spotReady(false, o, '昨日、行きます。'), false, '고치지 않으면 저장 불가')
  const fixed = { ...o, fixed: '昨日、行きました。', why: '과거' }
  assert.equal(spotReady(false, fixed, '昨日、行きます。'), true)
  const body = spotBody(false, fixed)
  assert.deepEqual(body, { answerText: '昨日、行きました。\n(이유) 과거' })
  const back = spotDraftFrom({ ...old, answerText: body.answerText ?? null })
  assert.deepEqual(back, { seg: null, text: '', fixed: '昨日、行きました。', why: '과거' }, '다시 들어오면 고친 문장·이유가 되살아남')
})

test('결과: 문항 표시 톤·고친 말 추출·레벨 제안 근거·시간 초과·조사', () => {
  assert.equal(itemTone(10, 10), 'full')
  assert.equal(itemTone(0, 10), 'zero')
  assert.equal(itemTone(null, 10), 'zero')
  assert.equal(itemTone(5, 10), 'part')
  assert.deepEqual(spotFix('昨日、友だちと映画を見に行きます。', '行きます', '昨日、友だちと映画を見に行きました。'), { before: '昨日、友だちと映画を見に', wrong: '行きます', after: '。', fix: '行きました' })
  assert.equal(spotFix('abc', 'x', 'abd'), null)
  assert.equal(spotFix('昨日行きます', '行きます', '今日は行きました')?.fix, null, '앞뒤가 달라 뽑을 수 없으면 고친 문장 전체를 보인다')
  const v = levelProposalView({ id: 'p1', kind: 'SET_LEVEL', status: 'PROPOSED', payload: { level: 'N3', fromLevel: 'N4', basis: [{ evaluationId: 'a', kind: 'TALK', totalScore: 92, date: '2026-09-26' }, { evaluationId: 'b', kind: 'WORDS', totalScore: 90, date: TODAY }, { bad: 1 }] } })
  assert.deepEqual(v, { id: 'p1', status: 'PROPOSED', from: 'N4', to: 'N3', basis: [{ date: '2026-09-26', kind: 'TALK', score: 92 }, { date: TODAY, kind: 'WORDS', score: 90 }] })
  assert.equal(levelProposalView({ id: 'p', kind: 'ADD_WORD', status: 'PROPOSED', payload: {} }), null)
  assert.equal(levelProposalView(null), null)
  const m = resultMeta(detail({ items: [item({ answered: true }), item({ id: 'i2' })], startedAt: '2026-10-01T04:00:00Z', submittedAt: '2026-10-01T04:11:20Z', result: { totalScore: 50, grade: 'NEEDS_WORK', rubric: null, comment: null, nextFocus: [], studyLogId: null, completedAt: null, overtime: true, durationSec: 680, levelProposal: null } }))
  assert.deepEqual(m, { n: 2, answered: 1, usedSec: 680, overSec: 80 })
  assert.equal(levelRo('N3'), 'N3으로')
  assert.equal(levelRo('N4'), 'N4로')
  assert.equal(levelRo('N1'), 'N1로')
  assert.equal(LEVEL.accept(levelRo('N3')), 'N3으로 올리기')
  assert.equal(GRADE_LABEL.EXCELLENT, '이 레벨은 충분해요', '결정 c=B 레벨 기준형')
})

test('경로: 평가 화면 전부 하단 탭 숨김(집중 화면) · 오늘 홈은 아님', () => {
  assert.equal(evalPath('ev 1'), '/study/today/eval/ev%201')
  assert.equal(startPath('TALK'), '/study/today/eval/new?kind=TALK')
  assert.ok(isFocusRoute('/study/today/eval/ev1'))
  assert.ok(isFocusRoute('/study/today/eval/new'))
  assert.ok(isFocusRoute('/study/today/eval/history'))
  assert.ok(!isFocusRoute('/study/today'))
})

/* ── REV-051 저장하지 못한 답 ─────────────────────────────────────── */

const NONE: ReadonlyMap<string, SaveRetry> = new Map()

test('저장 실패(REV-051): 이미 답한 문항의 수정 실패도 미저장으로 잡힌다(서버 answered 와 따로)', () => {
  const items = [item({ id: 'a', answered: true, answerText: '연습' }), item({ id: 'b' }), item({ id: 'c', answered: true })]
  const u = recordSaveOutcome(NONE, 'a', 'FAIL', { body: { answerText: '준비' } })
  assert.deepEqual(missingIndexes(items), [1], '서버 기준 안 푼 문항에는 a 가 없다')
  assert.deepEqual(unsavedIndexes(items, u), [0], '그래도 미저장 목록에는 있다')
  const u2 = recordSaveOutcome(u, 'b', 'FAIL', { body: { answerText: '연습' } })
  assert.deepEqual(unsavedIndexes(items, u2), [0, 1], '미답 문항의 첫 저장 실패도 같은 목록')
  assert.equal(NONE.size, 0, '이전 목록은 바꾸지 않는다')
})

test('저장 실패 뒤 성공하면 빠지고 · 409(제출·채점 끝)도 빠진다', () => {
  const failed = recordSaveOutcome(NONE, 'a', 'FAIL', { body: { answerText: '준비' } })
  assert.equal(recordSaveOutcome(failed, 'a', 'OK').has('a'), false)
  assert.equal(recordSaveOutcome(failed, 'a', 'CONFLICT').has('a'), false, '409 는 화면을 다시 읽으니 미저장으로 남기지 않는다')
  assert.equal(recordSaveOutcome(NONE, 'z', 'OK').size, 0, '없던 문항의 성공은 그대로')
  assert.equal(recordSaveOutcome(failed, 'a', 'FAIL').get('a')?.body.answerText, '준비', '다시 보낼 본문 없는 실패는 목록을 그대로 둔다')
})

test('부분 성공: 둘 실패 뒤 하나만 성공하면 나머지만 남고 번호는 화면 순서', () => {
  const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' }), item({ id: 'd' })]
  let u = recordSaveOutcome(NONE, 'd', 'FAIL', { body: { answerText: 'x' } })
  u = recordSaveOutcome(u, 'b', 'FAIL', { body: { answerText: 'y' } })
  assert.deepEqual(unsavedIndexes(items, u), [1, 3])
  u = recordSaveOutcome(u, 'd', 'OK')
  assert.deepEqual(unsavedIndexes(items, u), [1])
  assert.deepEqual(unsavedIndexes(items, new Set(['c', 'gone'])), [2], 'Set 도 받고 · 목록에 없는 id 는 무시')
})

test('실패 기록은 다시 보낼 본문과 글자 대체(음성 답)를 보존하고 · 같은 문항은 나중 실패가 이긴다', () => {
  const voice: SaveRetry = { body: { inputSource: 'REALTIME_STT', utteranceId: 'u1' }, textFallback: '駅で待ちます' }
  const u = recordSaveOutcome(NONE, 'a', 'FAIL', voice)
  assert.deepEqual(u.get('a'), voice)
  const spot = recordSaveOutcome(u, 'b', 'FAIL', { body: { answerText: '行きました', spotIndex: 1 }, textFallback: undefined })
  assert.deepEqual(spot.get('b'), { body: { answerText: '行きました', spotIndex: 1 } }, '글자 대체가 없으면 키도 없다')
  const later = recordSaveOutcome(spot, 'a', 'FAIL', { body: { answerText: '駅で待つ', inputSource: 'TEXT' } })
  assert.deepEqual(later.get('a'), { body: { answerText: '駅で待つ', inputSource: 'TEXT' } })
})

test('제출 가능 여부: 미저장이 비어 있어야만 #68 을 보낸다', () => {
  assert.equal(submitGate(NONE), 'GO')
  assert.equal(submitGate(new Set()), 'GO')
  const u = recordSaveOutcome(NONE, 'a', 'FAIL', { body: { answerText: '준비' } })
  assert.equal(submitGate(u), 'BLOCK')
  assert.equal(submitGate(recordSaveOutcome(u, 'a', 'OK')), 'GO', '다시 저장에 성공하면 제출할 수 있다')
})
