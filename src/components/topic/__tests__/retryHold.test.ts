import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { retryFailHoldMs, RETRY_MIN_BUSY_MS } from '../logic'

// task-045 s6-hint(REV-168 L-5): 관리 화면(S2)에만 있던 「오류 상자 [다시 시도] 의 자리표시 최소 표시 500ms」를 주제 보기(S6)·주제 고치기(S7)에도 같은 규칙으로 적용한다.
// 실패 반영만 미루고 성공은 기다리지 않는다. 훅은 DOM 없이 돌릴 수 없어 소스로 고정한다(`uiAFix.test.ts` 와 같은 방식). 실제 표시 시간은 QA 실측.
const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (name: string) => strip(readFileSync(join(dir, name), 'utf8'))

test('규칙 함수는 S2 와 같은 것을 쓴다 — 실패만 500ms 까지 기다리고 성공은 0', () => {
  assert.equal(retryFailHoldMs(true, 1000, 1000), RETRY_MIN_BUSY_MS)
  assert.equal(retryFailHoldMs(true, 1000, 1030), RETRY_MIN_BUSY_MS - 30)
  assert.equal(retryFailHoldMs(true, 1000, 1500), 0)
  assert.equal(retryFailHoldMs(false, 1000, 1030), 0)
})

test('useTopicDetail(S6): reload 만 누른 시각을 넘겨 실패 반영을 미룬다 — 처음 읽기·조용한 새로고침·#161 다시 시도는 미루지 않는다', () => {
  const hook = read('useTopicDetail.ts')
  assert.match(hook, /const reload = useCallback\(\(\) => \{\s*setState\(\{ forId: null, status: 'loading', raw: null \}\)\s*request\(id, false, undefined, Date\.now\(\)\)\s*\}, \[id, request\]\)/, '자리표시부터 + 누른 시각')
  assert.match(hook, /const failed = topics\.status === 'rejected' \|\| overrides\.status === 'rejected'/, '필수 두 요청만 실패로 본다(#161·#155 는 부분 허용)')
  assert.match(hook, /const hold = holdFrom === undefined \? 0 : retryFailHoldMs\(failed, holdFrom, Date\.now\(\)\)/)
  assert.match(hook, /if \(hold > 0\) \{[^}]*holdTimer\.current = setTimeout\(apply, hold\)[^}]*\} else apply\(\)/, '대기가 있으면 타이머로, 없으면 바로')
  assert.match(hook, /const apply = \(\) => \{\s*if \(my !== seq\.current\) return\s*setState/, '반영하는 순간 순번을 다시 확인 — 기다리는 사이 새 요청이 있으면 옛 결과를 버린다')
  const withClock = hook.split('\n').filter((l) => /\brequest\(/.test(l) && /Date\.now\(\)/.test(l))
  assert.equal(withClock.length, 1, '누른 시각을 넘기는 호출은 reload 하나뿐')
  assert.match(hook, /request\(id, false\)\s*\}, \[id, request\]\)/, '처음 읽기는 즉시 반영')
  assert.match(hook, /const refresh = useCallback\(\(\) => request\(id, true\), \[id, request\]\)/, '조용한 새로고침은 즉시 반영')
  assert.match(hook, /\(\) => \(\) => \{\s*if \(busyTimer\.current\) clearTimeout\(busyTimer\.current\)\s*if \(holdTimer\.current\) clearTimeout\(holdTimer\.current\)/, '화면을 떠나면 두 타이머 모두 정리')
  assert.match(hook, /onSettled\?\.\(\)/, '#161 다시 시도 표시 종료 호출은 그대로')
})

test('useTopicEdit(S7): reload 만 누른 시각을 넘기고, 실패 반영만 미룬다 — 성공 쪽에는 대기가 없다', () => {
  const hook = read('useTopicEdit.ts')
  assert.match(hook, /const reload = useCallback\(\(\) => \{\s*setStatus\('loading'\)\s*load\(Date\.now\(\)\)\s*\}, \[load\]\)/, '자리표시부터 + 누른 시각')
  const withClock = hook.split('\n').filter((l) => /\bload\(/.test(l) && /Date\.now\(\)/.test(l))
  assert.equal(withClock.length, 1, '누른 시각을 넘기는 호출은 reload 하나뿐')
  assert.match(hook, /useEffect\(\(\) => \{\s*load\(\)\s*return \(\) => \{\s*if \(holdTimer\.current\) clearTimeout\(holdTimer\.current\)\s*\}\s*\}, \[load\]\)/, '처음 읽기는 즉시 반영 + 떠나면 타이머 정리')
  const ok = hook.slice(hook.indexOf('([topics, overrides]) => {'), hook.indexOf('const apply = () => {'))
  assert.ok(ok.length > 100 && !/holdFrom|hold\b|holdTimer/.test(ok), '성공 쪽은 기다리지 않는다')
  const fail = hook.slice(hook.indexOf('const apply = () => {'), hook.indexOf('[id],\n  )'))
  assert.match(fail, /const apply = \(\) => \{\s*if \(my === seq\.current\) setStatus\('error'\)\s*\}/, '반영하는 순간 순번 확인')
  assert.match(fail, /const hold = holdFrom === undefined \? 0 : retryFailHoldMs\(true, holdFrom, Date\.now\(\)\)/)
  assert.match(fail, /if \(hold > 0\) \{[^}]*holdTimer\.current = setTimeout\(apply, hold\)[^}]*\} else apply\(\)/)
})

test('두 화면의 오류 상자 [다시 시도] 는 그 훅의 reload 를 쓴다 — 규칙이 한 곳에서 걸린다', () => {
  assert.match(read('TopicDetail.tsx'), /<ErrorBox title=\{MANAGE\.loadFail\} body=\{MANAGE\.loadFailBody\} retryLabel=\{MANAGE\.retry\} onRetry=\{d\.reload\} \/>/)
  assert.match(read('TopicEditScreen.tsx'), /<ErrorBox title=\{MANAGE\.loadFail\} body=\{MANAGE\.loadFailBody\} retryLabel=\{MANAGE\.retry\} onRetry=\{m\.reload\} \/>/)
})
