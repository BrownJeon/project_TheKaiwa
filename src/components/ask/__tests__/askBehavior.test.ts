import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../../__tests__/sourceCode'
import { createAskConversation, type CreateConversationDeps } from '../homeLogic'
import { askTitleOf } from '../logic'
import type { CreatedChat } from '@/types/chat'

// task-064 REV-064-U1 M-2 → task-066 §26-13 ④ — 감사가 변이로 살아남은 것을 확인한 행동 중 값이 큰 것: 대화 중복 생성 방지 ·
// 경과 초 비낭독 · 칩 뒤 초점 · 근거 카드 돌아오기 기록. 렌더 시험 환경이 없으므로 순수 함수 + 주석을 걷은 소스 구조로 잠근다.
// (보내는 범위 확인 관문 시험은 관문이 없어져 askChatTab.test.ts ① 로 대체.)

// ── 대화 중복 생성 방지(§26-13 ④) ─────────────────────────────────────────────

function created(id: string): CreatedChat {
  return { id, kind: 'ASK', title: 't', messageCount: 0, running: false, createdAt: '2026-10-13T00:00:00Z' }
}

function fakeDeps(over: Partial<CreateConversationDeps> = {}) {
  const log: string[] = []
  let n = 0
  const deps: CreateConversationDeps = {
    lock: { current: false },
    createChat: async (title) => {
      log.push(`create:${title}`)
      await Promise.resolve()
      return created(`room${++n}`)
    },
    setBusy: (b) => log.push(`busy:${b}`),
    onCreated: (c, text, via) => log.push(`created:${c.id}:${text}:${via}`),
    onError: (_e, text, via) => log.push(`error:${text}:${via}`),
    ...over,
  }
  return { deps, log }
}

test('④ 대화 만들기 — 연타(동시에 두 번)해도 방은 하나, 성공 뒤에도 잠금 유지(화면이 AskRoom 으로 바뀐다)', async () => {
  const { deps, log } = fakeDeps()
  await Promise.all([createAskConversation(deps, '「は」と「が」の違い？', 'text'), createAskConversation(deps, '「は」と「が」の違い？', 'text')])
  assert.deepEqual(log, [`busy:true`, `create:${askTitleOf('「は」と「が」の違い？')}`, 'created:room1:「は」と「が」の違い？:text'])
  assert.equal(deps.lock.current, true)
  await createAskConversation(deps, '또 눌렀어요', 'voice')
  assert.equal(log.filter((x) => x.startsWith('create:')).length, 1)
})

test('④ 대화 만들기 — 잠금이 이미 잡혀 있으면 화면 상태(바쁨)도 건드리지 않는다', async () => {
  const { deps, log } = fakeDeps({ lock: { current: true } })
  await createAskConversation(deps, '질문', 'text')
  assert.deepEqual(log, [])
})

test('④ 대화 만들기 — 실패하면 잠금·바쁨을 풀고 글·경로를 돌려준다(onCreated 0) → 같은 글로 다시 만들 수 있다', async () => {
  let fail = true
  const log: string[] = []
  const { deps } = fakeDeps({
    createChat: async (title) => {
      log.push(`create:${title}`)
      if (fail) throw new Error('network')
      return created('room9')
    },
    setBusy: (b) => log.push(`busy:${b}`),
    onCreated: (c, text, via) => log.push(`created:${c.id}:${text}:${via}`),
    onError: (_e, text, via) => log.push(`error:${text}:${via}`),
  })
  await createAskConversation(deps, '大丈夫', 'voice')
  assert.deepEqual(log, ['busy:true', `create:${askTitleOf('大丈夫')}`, 'busy:false', 'error:大丈夫:voice'])
  assert.equal(deps.lock.current, false)
  fail = false
  log.length = 0
  await createAskConversation(deps, '大丈夫', 'voice')
  assert.deepEqual(log, ['busy:true', `create:${askTitleOf('大丈夫')}`, 'created:room9:大丈夫:voice'])
})

test('④ 잠금 줄 — 잠금을 먼저 보고 바로 잡는다(이 줄을 빼면 연타 시험이 실패)', () => {
  const logic = readCode('src/components/ask/homeLogic.ts')
  assert.match(logic, /if \(deps\.lock\.current\) return\s*deps\.lock\.current = true/)
})

// ── 경과 초 비낭독 · 칩 뒤 초점 · 근거 카드 돌아오기 기록 ───────────────────────

test('M-2 대기 카드 — 단계 목록과 경과 초는 aria-hidden(상태 문장만 읽힘)', () => {
  const p = readCode('src/components/ask/AskPending.tsx')
  assert.match(p, /<ol aria-hidden="true"/)
  assert.match(p, /\{showSec \? \(\s*<span aria-hidden="true" className="[^"]*tabular-nums[^"]*">\s*\{ASK_COPY\.secSuffix\(sec\)\}\s*<\/span>\s*\) : null\}/)
  assert.match(p, /<p role="status"/)
  assert.ok(!/role="timer"|aria-live="(?:polite|assertive)">\s*\{ASK_COPY\.secSuffix/.test(p), '경과 초를 라이브 영역에 두지 않는다')
})

test('M-2 칩으로 보낸 뒤 — 실제로 보냈을 때만 목록 상자로 초점(안내 칩·되묻기 칩, §26-5 D·11-D)', () => {
  const room = readCode('src/components/ask/AskRoom.tsx')
  assert.match(room, /if \(input\.sendChip\(q\)\) afterCommit\(\(\) => listRef\.current\?\.focusList\(\)\)/)
  assert.match(room, /doSend\(o\.label, 'text', \{ scope: \{ key: o\.key \} \}\)\s*afterCommit\(\(\) => listRef\.current\?\.focusList\(\)\)/)
})

test('M-2 근거 카드 — 돌아오기 기록은 집중 화면 유형(수업·평가·역할극)에서만, 눌렀을 때 호출', () => {
  const s = readCode('src/components/ask/SourceList.tsx')
  // task-067 §27-7 B: 돌아올 주소는 늘 탭 화면의 그 대화(`askChatHref`) — 옛 `/ask/<id>` 대체값·`back` 인자 삭제(U2, 이 블록만 고침)
  assert.match(s, /function rememberIfFocusTarget\(chatId: string, s: AskSource, href: string\) \{\s*if \(!isAskFocusTarget\(s\.type\)\) return\s*rememberAskReturn\(askChatHref\(chatId\),/)
  assert.match(s, /<Link href=\{href\} onClick=\{\(\) => rememberIfFocusTarget\(chatId, s, href\)\}/)
})
