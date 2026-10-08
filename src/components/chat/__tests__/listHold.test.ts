import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIST_HOLD_CAP_MS, shouldHoldCard, shouldHoldList } from '../listHold'

// task-046 T2b(IMP-0027): 교정 카드와 목록이 따로 나타나 서로를 밀지 않게 — 판단은 순수 함수, 연결은 원문 고정.
const root = join(__dirname, '..')
const read = (f: string) => readFileSync(join(root, f), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')

test('목록: 카드 요청이 끝나지 않았고 상한 전이면 자리표시를 유지한다', () => {
  assert.equal(shouldHoldList(false, false), true)
})

test('목록: 카드 요청이 끝나면(성공·0건·오류 모두 settled) 푼다', () => {
  assert.equal(shouldHoldList(true, false), false)
  assert.equal(shouldHoldList(true, true), false)
})

test('목록: 카드가 느려도 상한이 지나면 푼다 — 카드를 오래 기다리며 목록을 막지 않는다', () => {
  assert.equal(shouldHoldList(false, true), false)
})

test('상한은 1500ms', () => {
  assert.equal(LIST_HOLD_CAP_MS, 1500)
})

test('카드: 목록이 첫 결과(데이터·오류)를 받기 전에는 그리지 않고, 받으면 그린다', () => {
  assert.equal(shouldHoldCard(false), true)
  assert.equal(shouldHoldCard(true), false)
})

test('시간이 갈수록 true → false 로만 — 이미 그린 목록이 자리표시로 되돌아가지 않는다', () => {
  const seq = [
    [false, false],
    [true, false],
    [true, true],
  ] as const
  let prev = true
  for (const [settled, cap] of seq) {
    const held = shouldHoldList(settled, cap)
    assert.ok(!(held && !prev), '풀린 뒤 다시 잠기지 않는다')
    prev = held
  }
  // 상한 뒤 카드가 끝나도(늦은 도착) 목록은 그대로 풀린 상태.
  assert.equal(shouldHoldList(true, true), false)
})

test('StudyAiHome: 카드·목록 판단은 순수 함수와 상한 타이머로 연결되고, 상태는 탭 홈 단위 한 곳에서 쥔다', () => {
  const src = read('StudyAiHome.tsx')
  assert.match(src, /shouldHoldList\(cardSettled, capElapsed\)/)
  assert.match(src, /shouldHoldCard\(listSettled\)/)
  assert.match(src, /setTimeout\(\(\) => setCapElapsed\(true\), LIST_HOLD_CAP_MS\)/)
  assert.match(src, /clearTimeout/)
  assert.match(src, /onSettled=\{markCardSettled\}/)
  assert.match(src, /onSettled=\{markListSettled\}/)
  // 시나리오 탭은 이 판단과 무관하다.
  assert.match(src, /tab === 'scenario' \? \(\s*<ScenarioHome/)
})

test('PendingCorrectionsCard: 성공·실패 모두 settled 를 알리고(실패가 목록을 막지 않는다), hold 면 그리지 않는다', () => {
  const src = read('PendingCorrectionsCard.tsx')
  assert.ok((src.match(/settledRef\.current\?\.\(\)/g) ?? []).length >= 2, '성공(then)·실패(catch) 두 곳')
  assert.match(src, /\.then\(\(r\) => \{[\s\S]*?setData\(r\)[\s\S]*?settledRef\.current\?\.\(\)[\s\S]*?\}\)\s*\.catch/, '같은 틱에서 데이터와 함께 알린다')
  assert.match(src, /if \(hold \|\| rows\.length === 0\) return null/)
  assert.match(src, /cancelled = true\s*\}\s*\}, \[\]\)/, '요청 효과의 deps 는 비어 있다 — 콜백 정체성이 요청을 다시 돌리지 않는다')
})

test('ChatList: hold 는 자리표시만 연장하고 오류 상자·다시 시도 규칙은 건드리지 않는다', () => {
  const src = read('ChatList.tsx')
  assert.match(src, /if \(items === null \|\| hold\) \{/)
  assert.match(src, /items === null && error \?/, '오류 상자는 목록이 한 번도 안 왔을 때만 — hold 로 가려지지 않는다')
  assert.match(src, /retryFailHoldMs\(true, retryAt\.current, Date\.now\(\)\)/, 'T2 의 다시 시도 500ms 규칙 유지')
  // 첫 결과 3곳(성공·즉시 오류·유예 뒤 오류)에서 알린다.
  assert.equal((src.match(/settledRef\.current\?\.\(\)/g) ?? []).length, 3)
  assert.ok(!/scrollIntoView|scrollTo\(/.test(src), '스크롤 규칙')
})
