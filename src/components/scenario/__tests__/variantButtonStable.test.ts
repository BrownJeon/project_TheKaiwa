import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCENARIO_VARIANT_NO_AXES } from '@/types/scenarioVariant'
import { scenarioFailure } from '../failure'
import { holdFailure, isAboveAxesFailure, variantInputSig } from '../variantLogic'

// task-045 ui-e3-fix2(qa-045-ui-e3 결함 #2 와 같은 패턴 남은 두 곳). R2 「높이 변화는 누른 줄 아래에서만」:
//  (a) 검토 단계 [다시 만들기] — 만드는 중 표시·실패 상자가 버튼 앞에 끼면 누른 버튼이 밀린다.
//  (b) 선택 단계 재시도 — 실패 상자가 버튼 위에 있다가 다시 누르면 사라져 버튼이 올라간다.
// DOM 없이 레이아웃을 잴 수 없어 렌더 순서(소스)와 붙잡기 순수 함수를 고정한다. 실제 이동 0px 은 QA 실측(probe-focus).
const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const screen = strip(readFileSync(join(dir, 'VariantDraftScreen.tsx'), 'utf8'))

function part(from: string, to: string): string {
  const a = screen.indexOf(from)
  const b = to ? screen.indexOf(to, a + 1) : screen.length
  assert.ok(a >= 0 && b > a, `${from}·${to} 위치를 못 찾음`)
  return screen.slice(a, b)
}
const review = () => part('function Review(', '')
const pick = () => part('function Pick(', 'function Review(')

const REGEN_LABEL = '{gen ? VARIANT.cancel : VARIANT.regen}'

test('Review: 만드는 중 표시·실패 상자는 [다시 만들기] 버튼 뒤에 렌더된다 — 버튼은 시작·20초·성공·실패 전환에서 제자리', () => {
  const r = review()
  const btn = r.indexOf(REGEN_LABEL)
  const status = r.indexOf('<GenStatus')
  const fail = r.indexOf('<FailBox')
  assert.ok(btn >= 0, '[다시 만들기]↔[그만두기] 버튼을 못 찾음')
  assert.ok(status > btn, '만드는 중 표시가 [다시 만들기] 앞에 있다 — 표시 높이만큼 누른 버튼이 밀린다')
  assert.ok(fail > btn, '실패 상자가 [다시 만들기] 앞에 있다 — 상자가 사라지고 생길 때 버튼이 오르내린다')
  assert.equal([...r.matchAll(/<GenStatus\b/g)].length, 1, 'Review 의 GenStatus 는 하나')
  assert.equal([...r.matchAll(/<FailBox\b/g)].length, 1, 'Review 의 FailBox 는 하나')
  assert.ok(status < r.indexOf('DRAFT.discard'), '표시는 [버리기]보다 위(누른 버튼 바로 아래 줄)')
  assert.ok(fail < r.indexOf('DRAFT.discard'), '실패 상자도 [버리기]보다 위')
})

test('Review: 버튼 앞(저장 안내·[저장]·오류 줄)에는 상태 표시·실패 상자가 없고 [저장]은 [다시 만들기] 위 — 요청이 [저장] 위치를 못 건드린다', () => {
  const r = review()
  const save = r.indexOf('VARIANT.save}')
  const btn = r.indexOf(REGEN_LABEL)
  assert.ok(save >= 0 && btn > save, '[저장]은 [다시 만들기] 위')
  const before = r.slice(0, btn)
  assert.ok(!/<GenStatus\b/.test(before) && !/<FailBox\b/.test(before), '버튼 앞에 GenStatus·FailBox 가 있다')
  assert.match(r, /<GenStatus long=\{m\.flight\.long\} \/>/, '20초 안내(long) 연결 유지')
  assert.match(screen, /function GenStatus\([^)]*\) \{\s*return \(\s*<div role="status"/, '표시는 role=status')
  assert.match(r, /aria-disabled=\{\(gen \? !m\.flight\.cancelable : m\.saving\) \|\| undefined\} onClick=\{regen\}/, '800ms 취소 잠금 연결 유지')
})

test('Pick: 실패 상자는 [변형 초안 만들기] 버튼 뒤(그 밖의 실패) · 축 위 한 자리(축 위 실패) — 버튼 위 줄에서 사라지지 않는다', () => {
  const p = pick()
  const btn = p.indexOf('{gen ? VARIANT.cancel : VARIANT.submit}')
  const axes = p.indexOf('<VariantAxes')
  const boxes = [...p.matchAll(/<FailBox\b/g)].map((x) => x.index!)
  assert.ok(btn >= 0 && axes >= 0, '버튼·축을 못 찾음')
  assert.equal(boxes.length, 2, 'Pick 의 FailBox 는 축 위 하나·버튼 아래 하나')
  assert.ok(boxes[0] < axes, '축 위 실패 자리가 축 앞에 있다')
  assert.ok(boxes[1] > btn, '그 밖의 실패 상자가 버튼 앞에 있다 — 다시 누르면 사라지며 버튼이 올라간다')
  // 축과 버튼 사이(직접 적기 칸 포함)에는 실패 상자가 없다.
  assert.ok(!/<FailBox\b/.test(p.slice(axes, btn)), '축~버튼 사이에 실패 상자가 끼었다')
  assert.ok(boxes[1] < p.indexOf('VARIANT.saveNote'), '버튼 아래 상자는 저장 안내보다 위')
})

test('Pick: 축 위 실패는 붙잡는 함수로 거른 값만 그린다(요청이 시작돼도 상자를 놓지 않는다)', () => {
  const p = pick()
  assert.match(p, /holdFailure\(held, m\.failure, variantInputSig\(m\.axes, m\.note\)\)/, '붙잡기 연결')
  assert.match(p, /const above = nextHeld\?\.failure \?\? null/, '축 위 상자는 붙잡은 값')
  assert.match(p, /<FailBox f=\{above\} onRetry=\{m\.generate\} \/>/, '축 위 자리는 붙잡은 값을 그린다')
  assert.match(p, /const below = isAboveAxesFailure\(m\.failure\) \? null : m\.failure/, '축 위 실패는 아래 상자에서 뺀다(두 번 그리지 않음)')
  assert.match(p, /<FailBox f=\{below\} onRetry=\{m\.generate\} \/>/, '아래 상자는 축 위 실패가 아닌 것만')
})

test('isAboveAxesFailure: 바꿀 점 없음·만들기 어려움만 축 위(guide §16-7), 나머지는 버튼 아래', () => {
  const f = (status: number, details: Record<string, unknown> = {}) => scenarioFailure('variantDraft', { status, message: '서버 문구', code: null, details, retryAfterSec: null })
  assert.equal(isAboveAxesFailure(f(422, { reason: 'NO_VARIATION' })), true)
  assert.equal(isAboveAxesFailure(f(422, { reason: 'NOT_A_VARIANT' })), true)
  assert.equal(isAboveAxesFailure(f(502)), false)
  assert.equal(isAboveAxesFailure(f(409, { reason: 'DRAFT_BUSY' })), false)
  assert.equal(isAboveAxesFailure(null), false)
})

test('holdFailure: 요청 중·취소 뒤(입력 그대로)에는 축 위 상자를 붙잡고, 입력이 바뀌거나 다른 실패가 오면 놓는다', () => {
  const unfit = scenarioFailure('variantDraft', { status: 422, message: '서버 문구', code: null, details: { reason: 'NOT_A_VARIANT' }, retryAfterSec: null })
  const noChange = scenarioFailure('variantDraft', { status: 422, message: '서버 문구', code: null, details: { reason: 'NO_VARIATION' }, retryAfterSec: null })
  const network = scenarioFailure('variantDraft', { status: 502, message: '서버 문구', code: null, details: {}, retryAfterSec: null })
  const sig = variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, persona: 'kind' }, '')

  const first = holdFailure(null, unfit, sig)
  assert.deepEqual(first, { failure: unfit, sig }, '축 위 실패가 오면 붙잡는다')
  assert.equal(holdFailure(first, unfit, sig), first, '같은 값이면 같은 객체 — 렌더 중 상태 보정이 되풀이되지 않는다')
  assert.equal(holdFailure(first, null, sig), first, '다시 만드는 동안(failure=null)에도 입력이 그대로면 붙잡는다 — 상자가 사라져 버튼이 올라가지 않는다')
  assert.equal(holdFailure(first, null, variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, persona: 'kind' }, '')), first, '서명은 값 비교(취소해 돌아와도 같은 입력)')
  assert.equal(holdFailure(first, null, variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, persona: 'kind' }, '직접 적은 글')), null, '직접 적은 글이 바뀌면 놓는다')
  assert.equal(holdFailure(first, null, variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, twist: 'unavailable' }, '')), null, '고른 축이 바뀌면 놓는다')
  assert.deepEqual(holdFailure(first, noChange, sig), { failure: noChange, sig }, '다른 축 위 실패가 오면 새 값으로 바꾼다')
  assert.equal(holdFailure(first, network, sig), null, '버튼 아래 상자가 될 실패가 오면 축 위 상자는 놓는다')
  assert.equal(holdFailure(null, null, sig), null, '잡을 것이 없으면 null')
  assert.notEqual(variantInputSig(SCENARIO_VARIANT_NO_AXES, ''), variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, flow: 'suggest' }, ''), '축마다 서명이 다르다')
})
