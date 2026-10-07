import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCENARIO_VARIANT_NO_AXES } from '@/types/scenarioVariant'
import { scenarioFailure } from '../failure'
import { holdFailure, variantInputSig } from '../variantLogic'

// task-045 s6-hint(REV-168 L-1): 붙잡은 축 위 실패 상자(`role="alert"`)는 요청이 시작돼도 DOM 에 그대로 남아, 같은 실패가 되풀이돼도 스크린리더가 다시 읽지 않는다.
// 새 실패마다 일련번호를 올려 상자의 `key` 로 쓰면 상자가 다시 만들어진다 — 위치·높이·초점은 그대로. 낭독 자체는 사람 확인(QA)이고, 여기서는 번호 규칙과 연결을 고정한다.
const unfitFailure = () => scenarioFailure('variantDraft', { status: 422, message: '서버 문구', code: null, details: { reason: 'NOT_A_VARIANT' }, retryAfterSec: null })
const noChangeFailure = () => scenarioFailure('variantDraft', { status: 422, message: '서버 문구', code: null, details: { reason: 'NO_VARIATION' }, retryAfterSec: null })
const networkFailure = () => scenarioFailure('variantDraft', { status: 502, message: '서버 문구', code: null, details: {}, retryAfterSec: null })
const sig = variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, persona: 'kind' }, '')

test('holdFailure 일련번호: 새 실패 객체마다 하나씩 늘고, 같은 실패·요청 중(null)에는 그대로 — 같은 입력으로 같은 실패가 되풀이돼도 번호가 달라진다', () => {
  const f1 = unfitFailure()
  const h1 = holdFailure(null, f1, sig)
  assert.equal(h1?.n, 1, '처음 붙잡을 때 1')
  assert.equal(holdFailure(h1, f1, sig), h1, '같은 실패 객체는 같은 값(번호 그대로 — 렌더 중 상태 보정이 되풀이되지 않는다)')
  assert.equal(holdFailure(h1, null, sig), h1, '다시 만드는 동안(failure=null)에는 번호 그대로 — 상자를 놓지 않는다')
  // 같은 입력으로 다시 눌러 같은 종류의 실패가 새로 도착(새 객체).
  const f2 = unfitFailure()
  assert.notEqual(f2, f1)
  const h2 = holdFailure(h1, f2, sig)
  assert.equal(h2?.n, 2, '같은 종류·같은 입력의 새 실패 → 번호가 올라 상자가 다시 만들어진다(재낭독)')
  assert.deepEqual({ ...h2, failure: undefined }, { failure: undefined, sig, n: 2 })
  assert.equal(h2?.failure, f2)
  // 한 번 더, 그리고 다른 축 위 실패로 바뀔 때도 올라간다.
  const h3 = holdFailure(holdFailure(h2, null, sig), noChangeFailure(), sig)
  assert.equal(h3?.n, 3)
})

test('holdFailure: 입력이 바뀌거나 버튼 아래 상자가 될 실패가 오면 놓고(null), 놓은 뒤 새 실패는 1부터 — 그때는 상자가 이미 사라졌다가 새로 생기는 것이라 재낭독된다', () => {
  const h1 = holdFailure(null, unfitFailure(), sig)
  assert.equal(holdFailure(h1, null, variantInputSig({ ...SCENARIO_VARIANT_NO_AXES, persona: 'kind' }, '직접 적은 글')), null)
  assert.equal(holdFailure(h1, networkFailure(), sig), null)
  assert.equal(holdFailure(null, unfitFailure(), sig)?.n, 1)
})

test('Pick: 축 위 실패 상자(붙잡은 값)에만 일련번호 key — 위치(축 앞 한 자리)·버튼 아래 상자는 그대로', () => {
  const src = readFileSync(join(__dirname, '..', 'VariantDraftScreen.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const pick = src.slice(src.indexOf('function Pick('), src.indexOf('function Review('))
  assert.match(pick, /<FailBox key=\{nextHeld\?\.n \?\? 0\} f=\{above\} onRetry=\{m\.generate\} \/>/, '붙잡은 상자는 일련번호로 다시 만든다')
  assert.equal([...pick.matchAll(/<FailBox\b[^>]*\bkey=/g)].length, 1, 'key 는 붙잡은 상자 하나뿐')
  assert.match(pick, /<FailBox f=\{below\} onRetry=\{m\.generate\} \/>/, '버튼 아래 상자는 요청이 시작되면 사라졌다 다시 생기므로 key 가 필요 없다')
  const axes = pick.indexOf('<VariantAxes')
  assert.ok(pick.indexOf('<FailBox key=') < axes, '축 앞 자리 그대로')
  // 번호가 바뀌어도 상자의 높이·위치를 바꾸는 스타일 변경은 없다 — FailBox 모양은 f 만 따른다.
  assert.match(src, /function FailBox\(\{ f, onRetry \}: \{ f: ScenarioFailure \| null; onRetry: \(\) => void \}\) \{\s*if \(!f\) return null/)
})
