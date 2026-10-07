import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-045 ui-e3-fix(qa-045-ui-e3 결함 #2). 변형 「만드는 중」 표시가 [변형 초안 만들기] 버튼 위에 끼면 누른 버튼([그만두기])이
// 표시 높이만큼 밀려 내려가 접힌 영역 밖으로 나간다 — R1~R6 「누른 줄은 안 움직이고 높이 변화는 누른 줄 아래에만」.
// DOM 없이 레이아웃을 잴 수 없어 렌더 순서를 소스로 고정한다(`variant.test.ts` 소스 가드와 같은 방식). 실제 이동 0px 은 QA 실측.
const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const screen = strip(readFileSync(join(dir, 'VariantDraftScreen.tsx'), 'utf8'))

function pickBody(): string {
  const from = screen.indexOf('function Pick(')
  const to = screen.indexOf('function Review(')
  assert.ok(from >= 0 && to > from, 'Pick·Review 위치를 못 찾음')
  return screen.slice(from, to)
}

test('Pick: 만드는 중 표시(GenStatus)는 만들기/그만두기 버튼 뒤에 렌더된다 — 버튼은 시작 전후 같은 자리', () => {
  const pick = pickBody()
  const btnLabel = pick.indexOf('{gen ? VARIANT.cancel : VARIANT.submit}')
  const status = pick.indexOf('<GenStatus')
  assert.ok(btnLabel >= 0, '버튼(만들기↔그만두기)을 못 찾음')
  assert.ok(status >= 0, 'GenStatus 를 못 찾음')
  assert.ok(status > btnLabel, '만드는 중 표시가 버튼 앞에 있다 — 표시 높이만큼 누른 버튼이 밀려 내려간다')
  // 「바로 아래」: 버튼과 표시 사이에 다른 보이는 줄을 끼우지 않는다(이유 줄·저장 안내는 표시 뒤).
  const between = pick.slice(btnLabel, status)
  assert.ok(!/<p\b/.test(between), `버튼과 표시 사이에 문단이 끼었다: ${between.trim().slice(0, 90)}`)
  assert.ok(status < pick.indexOf('VARIANT.saveNote'), '표시는 저장 안내 줄보다 위(버튼 바로 아래)')
})

test('Pick: 표시 앞(버튼 위)에는 GenStatus 가 없고 한 곳에서만 렌더된다 · role=status·aria-busy 규칙은 그대로', () => {
  const pick = pickBody()
  assert.equal([...pick.matchAll(/<GenStatus\b/g)].length, 1, 'Pick 의 GenStatus 는 하나')
  assert.match(pick, /<GenStatus long=\{m\.flight\.long\} \/>/, '20초 안내(long) 연결 유지')
  assert.match(pick, /aria-busy=\{gen \|\| undefined\}/, '만드는 동안 영역 aria-busy 유지')
  assert.match(screen, /function GenStatus\([^)]*\) \{\s*return \(\s*<div role="status"/, '표시는 role=status')
  assert.match(pick, /onClick=\{\(\) => \(gen \? m\.cancel\(\) : !blocked && m\.generate\(\)\)\}/, '같은 버튼이 취소로 바뀌는 연결 유지')
})
