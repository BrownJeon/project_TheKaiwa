import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { retryBusyRemainingMs, retryFailHoldMs, RETRY_MIN_BUSY_MS } from '../logic'

// task-045 ui-a-fix(qa-045-ui-a 결함 #1·#4). 훅·화면은 DOM 없이 돌릴 수 없어 순수 함수는 값으로, 훅·화면은 소스 문자열로 고정한다
// (`draftHookGuard.test.ts`·`removalA11y.test.ts` 와 같은 방식 — 주석은 제외하고 본다). 실제 표시 시간·줄바꿈은 QA 실측.
const COMPONENTS = join(__dirname, '..', '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (...p: string[]) => strip(readFileSync(join(COMPONENTS, ...p), 'utf8'))

// ── 결함 #1 — 필수 요청(#56·#179) 실패 뒤 [다시 시도] 의 자리표시 최소 표시 ─────────────────────────

test('retryFailHoldMs — 실패만 최소 표시 시간(500ms)까지 기다리고, 성공은 기다리지 않는다 · 시계가 뒤로 가도 최소 시간을 넘지 않는다', () => {
  assert.equal(retryFailHoldMs(true, 1000, 1000), RETRY_MIN_BUSY_MS, '누르자마자 바로 실패 → 500ms 유지')
  assert.equal(retryFailHoldMs(true, 1000, 1030), RETRY_MIN_BUSY_MS - 30, '실제 측정값: 30ms 만에 실패 → 470ms 더')
  assert.equal(retryFailHoldMs(true, 1000, 1500), 0)
  assert.equal(retryFailHoldMs(true, 1000, 9000), 0, '이미 오래 걸렸으면 바로 오류 상자')
  assert.equal(retryFailHoldMs(false, 1000, 1030), 0, '성공은 기다리게 하지 않는다')
  assert.equal(retryFailHoldMs(true, 1000, 900), RETRY_MIN_BUSY_MS)
  assert.equal(retryFailHoldMs(true, 1000, 1200), retryBusyRemainingMs(1000, 1200), '#161 [다시 시도] 와 같은 계산')
})

test('useManageData — reload 만 실패 반영을 미룬다(holdFrom): 처음 읽기·조용한 새로고침·#161 다시 시도는 미루지 않는다', () => {
  const hook = read('topic', 'useManageData.ts')
  assert.match(hook, /const reload = useCallback\(\(\) => \{\s*setState\(\{ status: 'loading', data: null \}\)\s*request\(false, undefined, Date\.now\(\)\)\s*\}, \[request\]\)/, '자리표시부터 다시 + 누른 시각을 넘김')
  assert.match(hook, /const hold = holdFrom === undefined \? 0 : retryFailHoldMs\(failed, holdFrom, Date\.now\(\)\)/, '누른 시각이 있을 때만 실패 대기 계산')
  assert.match(hook, /if \(hold > 0\) \{[^}]*holdTimer\.current = setTimeout\(apply, hold\)[^}]*\} else apply\(\)/, '대기가 있으면 타이머로, 없으면 바로 반영')
  // 반영(apply) 안에서 순번을 확인한다 — 기다리는 사이 새 요청이 시작됐다면 옛 결과를 버린다.
  assert.match(hook, /const apply = \(\) => \{\s*if \(id !== seq\.current\) return\s*setState/, '반영하는 순간 순번 확인')
  assert.match(hook, /const failed = topics\.status === 'rejected' \|\| overrides\.status === 'rejected'/, '필수 두 요청만 실패로 본다(#161·#155 는 부분 허용)')
  const withClock = hook.split('\n').filter((l) => /\brequest\(/.test(l) && /Date\.now\(\)/.test(l))
  assert.equal(withClock.length, 1, '누른 시각을 넘기는 호출은 reload 하나뿐')
  assert.match(withClock[0], /request\(false, undefined, Date\.now\(\)\)/)
  assert.match(hook, /return \(\) => \{\s*if \(busyTimer\.current\) clearTimeout\(busyTimer\.current\)\s*if \(holdTimer\.current\) clearTimeout\(holdTimer\.current\)/, '화면을 떠나면 두 타이머 모두 정리')
  assert.match(hook, /onSettled\?\.\(\)/, '#161 다시 시도 표시 종료 호출은 그대로')
})

// ── 결함 #4 — 사용자가 입력한 긴 글의 break-keep 에는 넘칠 때만 꺾는 안전장치 ──────────────────────

/** `break-keep` 이 붙은 태그 중 `needle`(그 줄의 사용자 입력 식) 이 들어 있는 줄은 전부 `[overflow-wrap:anywhere]` 도 갖는다 — 못 찾으면 시험이 실패한다. */
function guarded(file: string[], needle: string | RegExp, min = 1): number {
  const src = read(...file)
  const lines = src.split('\n').filter((l) => (typeof needle === 'string' ? l.includes(needle) : needle.test(l)))
  assert.ok(lines.length >= min, `${file.join('/')}: ${String(needle)} 줄을 ${min}개 이상 찾지 못함(${lines.length})`)
  for (const l of lines) {
    assert.match(l, /break-keep/, `${file.join('/')}: break-keep 이 없다 — 한글은 낱말 단위로 줄바꿈하는 규칙을 유지: ${l.trim().slice(0, 90)}`)
    assert.match(l, /\[overflow-wrap:anywhere\]/, `${file.join('/')}: 넘칠 때만 꺾는 안전장치가 없다: ${l.trim().slice(0, 90)}`)
  }
  return lines.length
}

test('S6 주제 보기: 설명·표현 뜻·챌린지 문장(제목이 들어감) 의 break-keep 은 [overflow-wrap:anywhere] 와 함께 쓴다', () => {
  guarded(['topic', 'TopicDetail.tsx'], '{t.description}')
  guarded(['topic', 'TopicDetail.tsx'], '{c.meaningKo}')
  guarded(['topic', 'TopicDetail.tsx'], '{TOPIC.challenge(')
})

test('S6 일본어 블록(제목 일본어 이름·표현 일본어·읽기)에는 break-keep 이 없다 — 일본어는 낱말 단위 줄바꿈이 없어 keep-all 이 글자 사이를 막는다', () => {
  const src = read('topic', 'TopicDetail.tsx')
  const ja = src.split('\n').filter((l) => /lang="ja"/.test(l))
  assert.ok(ja.length >= 3, `일본어 줄을 못 찾음(${ja.length})`)
  for (const l of ja) assert.ok(!/break-keep/.test(l), `일본어에 break-keep: ${l.trim().slice(0, 90)}`)
  for (const l of ja) assert.match(l, /break-words/, `일본어 줄에 break-words: ${l.trim().slice(0, 90)}`)
})

test('S8·S9 확인 시트: 챌린지 제목이 들어가는 경고 문장도 같은 안전장치(경고 상자·안내 상자 둘 다)', () => {
  const src = read('topic', 'TopicRemovalSheet.tsx')
  const bad = src.split('\n').filter((l) => l.includes('{view.warn.text}'))
  assert.equal(bad.length, 2, '경고 문장을 보이는 곳은 둘(경고 상자·안내 상자)')
  for (const l of bad) assert.match(l, /\[overflow-wrap:anywhere\]/, l.trim().slice(0, 90))
})

test('이미 안전장치가 있는 곳은 그대로 — ChunkEditor 뜻·ScenarioDraftCards 제목·목표·열기·부분 저장 줄·주제 만들기 보관 안내·변형 기준 줄', () => {
  guarded(['topic', 'ChunkEditor.tsx'], '{c.meaningKo}')
  guarded(['topic', 'ScenarioDraftCards.tsx'], '{title}</p>')
  guarded(['topic', 'ScenarioDraftCards.tsx'], '${DRAFT.fLearner}')
  guarded(['topic', 'ScenarioDraftCards.tsx'], 'SCDRAFT.noOpening')
  guarded(['topic', 'ScenarioDraftCards.tsx'], '<li key={l.key}')
  guarded(['topic', 'TopicCreateScreen.tsx'], 'CREATE.resumeBody(')
  guarded(['scenario', 'VariantDraftScreen.tsx'], 'VARIANT.baseMeta(')
})

test('상황 초안 편집기(scenario)의 표현 뜻({e.ko})도 같은 안전장치', () => {
  guarded(['scenario', 'ExpressionEditor.tsx'], '{e.ko}')
})

test('TopicRow 는 사용자가 입력한 제목·일본어 이름을 말줄임(truncate)으로 보인다 — break-keep 을 쓰지 않는다', () => {
  const src = read('topic', 'TopicRow.tsx')
  assert.ok(!/break-keep/.test(src))
  assert.match(src, /min-w-0 flex-1 truncate text-\[15px\] font-semibold">\{row\.title\}/)
  assert.match(src, /lang="ja" className="block min-w-0 truncate text-\[13px\] text-ink2">/)
})
