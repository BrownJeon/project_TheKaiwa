import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import { createAskRoom, type CreateRoomDeps } from '../homeLogic'
import { ASK_KEYS, askTitleOf, scopeSheetRestoreText } from '../logic'
import { useScopeNoticeGate } from '../useScopeNoticeGate'

// task-064 REV-064-U1 M-2 — 감사가 변이로 살아남은 것을 확인한 행동 중 값이 큰 것: 방 중복 생성 방지 · 보내는 범위 관문의 첫 렌더 ·
// 시트 취소 후 입력 복원 · 경과 초 비낭독 · 칩 뒤 초점 · 근거 카드 돌아오기 기록. 렌더 시험 환경이 없으므로 순수 함수 + 주석을 걷은 소스 구조로 잠근다.

// ── 방 중복 생성 방지(§25-12 B 4) ─────────────────────────────────────────────

function fakeDeps(over: Partial<CreateRoomDeps> = {}) {
  const log: string[] = []
  let n = 0
  const deps: CreateRoomDeps = {
    lock: { current: false },
    createChat: async (title) => {
      log.push(`create:${title}`)
      await Promise.resolve()
      return { id: `room${++n}` }
    },
    handOff: (id, text) => log.push(`handOff:${id}:${text}`),
    go: (id) => log.push(`go:${id}`),
    setBusy: (b) => log.push(`busy:${b}`),
    onError: () => log.push('error'),
    ...over,
  }
  return { deps, log }
}

test('M-2 방 만들기 — 연타(동시에 두 번)해도 방은 하나, 질문은 이동 전에 넘기고, 성공 뒤에도 잠금은 유지', async () => {
  const { deps, log } = fakeDeps()
  await Promise.all([createAskRoom(deps, '「は」と「が」の違い？'), createAskRoom(deps, '「は」と「が」の違い？')])
  assert.deepEqual(log, [`busy:true`, `create:${askTitleOf('「は」と「が」の違い？')}`, 'handOff:room1:「は」と「が」の違い？', 'go:room1'])
  assert.equal(deps.lock.current, true, '이동이 끝날 때까지(돌아와 화면이 새로 올라올 때까지) 잠금을 풀지 않는다')
  await createAskRoom(deps, '또 눌렀어요')
  assert.equal(log.filter((x) => x.startsWith('create:')).length, 1)
  assert.equal(log.filter((x) => x.startsWith('go:')).length, 1)
})

test('M-2 방 만들기 — 잠금이 이미 잡혀 있으면 화면 상태(바쁨)도 건드리지 않는다', async () => {
  const { deps, log } = fakeDeps({ lock: { current: true } })
  await createAskRoom(deps, '질문')
  assert.deepEqual(log, [])
})

test('M-2 방 만들기 — 실패하면 잠금·바쁨을 풀고 오류를 알린다(이동·넘기기 없음) → 같은 글로 다시 만들 수 있다', async () => {
  let fail = true
  const { deps, log } = fakeDeps({
    createChat: async (title) => {
      log0.push(`create:${title}`)
      if (fail) throw new Error('network')
      return { id: 'room9' }
    },
  })
  const log0 = log
  await createAskRoom(deps, '질문 하나')
  assert.deepEqual(log, ['busy:true', `create:${askTitleOf('질문 하나')}`, 'busy:false', 'error'])
  assert.equal(deps.lock.current, false)
  fail = false
  log.length = 0
  await createAskRoom(deps, '질문 하나')
  assert.deepEqual(log, ['busy:true', `create:${askTitleOf('질문 하나')}`, 'handOff:room9:질문 하나', 'go:room9'])
})

test('M-2 방 만들기 배선 — AskHome.create 는 createAskRoom 에 같은 ref 를 잠금으로 주고, 방은 pending 키로 넘긴다', () => {
  const home = readCode('src/components/ask/AskHome.tsx')
  assert.match(home, /createAskRoom\(\s*\{\s*lock: creatingRef,/)
  assert.match(home, /writeStore\('session', ASK_KEYS\.pending\(id\), q\)/)
  assert.match(home, /router\.push\(`\/ask\/\$\{encodeURIComponent\(id\)\}`\)/)
  assert.match(home, /if \(creatingRef\.current\) return/, 'submit 도 잠금을 먼저 본다')
  const logic = readCode('src/components/ask/homeLogic.ts')
  assert.match(logic, /if \(deps\.lock\.current\) return\s*deps\.lock\.current = true/)
  assert.ok(ASK_KEYS.pending('x').endsWith('.x'))
})

// ── 보내는 범위 관문의 첫 렌더(§25-12 B 9) ────────────────────────────────────

test('M-2 관문 — 서버 렌더·첫 수화의 acknowledged 는 null(= 아직 모름)이고, 부르는 쪽은 true 일 때만 보낸다', () => {
  // 첫 렌더는 서버 스냅샷이다. null 이 아니라 true 가 되면 수화 전에 보내기가 열려 시트를 건너뛴다.
  function Probe() {
    const g = useScopeNoticeGate()
    return createElement('i', { 'data-ack': String(g.acknowledged), 'data-ack-fn': typeof g.ack })
  }
  const html = renderToStaticMarkup(createElement(Probe))
  assert.match(html, /data-ack="null"/)
  assert.match(html, /data-ack-fn="function"/)
  // null·false 는 시트, true 만 통과 — 목록은 `!== true` 로 막고 방은 `=== true` 일 때만 바로 보낸다.
  assert.match(readCode('src/components/ask/AskHome.tsx'), /if \(gate\.acknowledged !== true\) \{\s*heldRef\.current = draft\s*setSheetMode\('first'\)\s*setSheetOpen\(true\)\s*return\s*\}/)
  assert.match(readCode('src/components/ask/AskRoom.tsx'), /if \(gate\.acknowledged === true\) \{\s*doSend\(p\)\s*return\s*\}\s*pendingSendRef\.current = p\s*setScopeSheet\('first'\)/)
})

// ── 시트 취소 후 입력 복원 ─────────────────────────────────────────────────────

test('M-2 시트 닫기 — 입력 바에서 보낸 글만 돌려주고(칩 질문·대기 없음은 null), 닫기는 세 길(취소·Esc·배경)이 같은 함수', () => {
  assert.equal(scopeSheetRestoreText({ text: '이번 주 얼마나 했어?', fromComposer: true }), '이번 주 얼마나 했어?')
  assert.equal(scopeSheetRestoreText({ text: '이번 주', fromComposer: false }), null)
  assert.equal(scopeSheetRestoreText(null), null)
  assert.equal(scopeSheetRestoreText({ text: '', fromComposer: true }), '', '빈 글도 그대로(복원은 입력 바가 비어 있을 때만 덮는다)')
  const room = readCode('src/components/ask/AskRoom.tsx')
  assert.match(room, /const closeScopeSheet = \(\) => \{\s*const restore = scopeSheetRestoreText\(pendingSendRef\.current\)\s*pendingSendRef\.current = null\s*setScopeSheet\(null\)\s*if \(restore !== null\) composerRef\.current\?\.restore\(restore\)\s*\}/)
  assert.match(room, /onClose=\{closeScopeSheet\}/)
  // 시트 [알겠어요, 보내기] 는 들고 있던 보내기를 잇는다(복원 없음)
  assert.match(room, /gate\.ack\(\)\s*const p = pendingSendRef\.current\s*pendingSendRef\.current = null\s*setScopeSheet\(null\)\s*if \(p\) doSend\(p\)/)
})

// ── 경과 초 비낭독 · 칩 뒤 초점 · 근거 카드 돌아오기 기록 ───────────────────────

test('M-2 대기 카드 — 단계 목록과 경과 초는 aria-hidden(상태 문장만 읽힘)', () => {
  const p = readCode('src/components/ask/AskPending.tsx')
  assert.match(p, /<ol aria-hidden="true"/)
  assert.match(p, /\{showSec \? \(\s*<span aria-hidden="true" className="[^"]*tabular-nums[^"]*">\s*\{ASK_COPY\.secSuffix\(sec\)\}\s*<\/span>\s*\) : null\}/)
  assert.match(p, /<p role="status"/)
  assert.ok(!/role="timer"|aria-live="(?:polite|assertive)">\s*\{ASK_COPY\.secSuffix/.test(p), '경과 초를 라이브 영역에 두지 않는다')
})

test('M-2 칩으로 보낸 뒤 — 사라지는 칩 대신 목록 상자로 초점(입력 바에서 보낸 글은 제외)', () => {
  const room = readCode('src/components/ask/AskRoom.tsx')
  assert.match(room, /void send\(p\.text, p\.opts\)\s*if \(!p\.fromComposer\) afterCommit\(\(\) => listRef\.current\?\.focusList\(\)\)/)
})

test('M-2 근거 카드 — 돌아오기 기록은 집중 화면 유형(수업·평가·역할극)에서만, 눌렀을 때 호출', () => {
  const s = readCode('src/components/ask/SourceList.tsx')
  assert.match(s, /function rememberIfFocusTarget\(chatId: string, s: AskSource, href: string\) \{\s*if \(!isAskFocusTarget\(s\.type\)\) return\s*rememberAskReturn\(/)
  assert.match(s, /<Link href=\{href\} onClick=\{\(\) => rememberIfFocusTarget\(chatId, s, href\)\}/)
})
