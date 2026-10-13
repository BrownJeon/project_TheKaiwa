import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChatSummary } from '@/types/chat'
import { POLL_FAST_MS, POLL_FAST_WINDOW_MS, POLL_MAX_MS, POLL_SLOW_MS } from '../../chat/useChatTurn'
import { readCode } from '../../__tests__/sourceCode'
import { ASK_COPY } from '../askCopy'
import { arrivedTransitions } from '../logic'
import {
  ASK_ROW_CLASS,
  askDraftCheck,
  askListPollDelay,
  askRowView,
  lastAnswerOk,
  settleArrivals,
  askActivityOf,
  askHistoryState,
  planArrivals,
} from '../homeLogic'
import AskHistoryButton from '../AskHistoryButton'
import AskListItem from '../AskListItem'
import { cleanupOf, calls, declOf, effectCallbacks, listenerCalls, parseCode, text } from './astCode'

// task-066 §26-13 ⑪⑫ — 지난 질문 읽기·폴링·도착 판정(task-064 askHome.test.ts 에서 옮김)·알약·지금 대화 제외.
const comp = join(__dirname, '..', '..')
const code = (...p: string[]) => readCode(join(comp, ...p))
const ok = (s: string | undefined): void => assert.ok(s)

const room = (o: Partial<ChatSummary> = {}): ChatSummary => ({
  id: 'r1',
  kind: 'ASK',
  title: '오늘 복습할 거 뭐 있어?',
  lastMessageAt: '2026-10-12T05:00:00.000Z',
  preview: '오늘은 「駅で」 복습이 있어요',
  messageCount: 2,
  reviewedAt: null,
  running: false,
  ...o,
})

// ── 입력 카드 ────────────────────────────────────────────────────────────────

test('askDraftCheck — 빈 글(공백만 포함) → empty, 1,000 코드포인트 초과 → tooLong, 이모지는 1자로 센다', () => {
  assert.equal(askDraftCheck(''), 'empty')
  assert.equal(askDraftCheck('  \n\t '), 'empty')
  assert.equal(askDraftCheck('가'.repeat(1000)), null)
  assert.equal(askDraftCheck('가'.repeat(1001)), 'tooLong')
  assert.equal(askDraftCheck('😀'.repeat(1000)), null, '서로게이트 쌍 1,000개 = 1,000자')
  assert.equal(askDraftCheck('😀'.repeat(1001)), 'tooLong')
})

test('task-067 — 「더 보기」 계산(appendRooms·mergeFirstPage)은 없다 · 알약 목록은 최근 20개를 그대로 바꿔 끼운다', () => {
  const hl = code('ask', 'homeLogic.ts')
  assert.ok(!/appendRooms|mergeFirstPage/.test(hl), '쓰는 곳이 없는 더 보기 계산 삭제')
  const h = code('ask', 'useAskActivity.ts')
  assert.match(h, /setList\(r\.items\)/, '줄어든 목록(지운 대화)이 옛 행으로 남지 않는다')
  assert.ok(!/\bmore\b|moreBusy|moreError|cursor/.test(h), '시트 「더 보기」용 more·moreBusy·moreError·cursor 삭제(§27-4 E)')
})

test('askListPollDelay — 2.5초(처음 30초) → 5초, 200초 넘으면 멈춤(useChatTurn 상수 재사용)', () => {
  assert.equal(askListPollDelay(1000, 1000), POLL_FAST_MS)
  assert.equal(askListPollDelay(0, POLL_FAST_WINDOW_MS - 1), POLL_FAST_MS)
  assert.equal(askListPollDelay(0, POLL_FAST_WINDOW_MS), POLL_SLOW_MS)
  assert.equal(askListPollDelay(0, POLL_MAX_MS), POLL_SLOW_MS)
  assert.equal(askListPollDelay(0, POLL_MAX_MS + 1), null)
  assert.equal(askListPollDelay(5000, 1000), POLL_FAST_MS, '시계가 거꾸로 가도 빠른 간격')
})

// ── 「새 답」 ────────────────────────────────────────────────────────────────

test('⑫ settleArrivals — 확인된 성공 답만 새 답 · 토스트는 폴링 전환이 하나라도 있으면 한 번 · waiting 에서 온 것은 토스트 없음', () => {
  const t = arrivedTransitions(new Set(['p1', 'p2']), [
    { id: 'p1', running: false },
    { id: 'p2', running: false },
    { id: 'w1', running: false },
    { id: 'r', running: true },
  ], new Set(['w1', 'r']))
  assert.deepEqual(settleArrivals(t, new Set(['p1', 'p2', 'w1'])), { newIds: ['w1', 'p1', 'p2'], toast: true, leftWaiting: ['w1'] })
  assert.deepEqual(settleArrivals(t, new Set(['w1'])), { newIds: ['w1'], toast: false, leftWaiting: ['w1'] }, '실패한 답(L-8)은 새 답·토스트 없음')
  assert.deepEqual(settleArrivals(t, new Set()), { newIds: [], toast: false, leftWaiting: ['w1'] }, '실패해도 waiting 에서는 뺀다')
  const first = arrivedTransitions(null, [{ id: 'p1', running: false }], new Set())
  assert.deepEqual(settleArrivals(first, new Set(['p1'])), { newIds: [], toast: false, leftWaiting: [] }, '첫 읽기 = 토스트·새 답 없음')
})

test('lastAnswerOk — 마지막 메시지가 DONE 인 선생님 답일 때만 성공', () => {
  assert.equal(lastAnswerOk([{ role: 'USER', status: 'DONE' }, { role: 'ASSISTANT', status: 'DONE' }]), true)
  assert.equal(lastAnswerOk([{ role: 'USER', status: 'DONE' }, { role: 'ASSISTANT', status: 'FAILED' }]), false)
  assert.equal(lastAnswerOk([{ role: 'USER', status: 'DONE' }]), false)
  assert.equal(lastAnswerOk([{ role: 'ASSISTANT', status: 'PENDING' }]), false)
  assert.equal(lastAnswerOk([]), false)
})

// ── 목록 행 ──────────────────────────────────────────────────────────────────

test('askRowView — 둘째 줄(running > preview > 「아직 메시지가 없어요」) · 상태(running 이 새 답보다 먼저) · 링크 이름', () => {
  const now = new Date('2026-10-12T06:00:00.000Z')
  const v = askRowView(room(), { isNew: false, now })
  assert.equal(v.second, '오늘은 「駅で」 복습이 있어요')
  assert.equal(v.status, null)
  assert.equal(v.label, `오늘 복습할 거 뭐 있어?, ${v.time}`)
  ok(v.time)
  const r = askRowView(room({ running: true }), { isNew: true, now })
  assert.equal(r.second, ASK_COPY.runningLine)
  assert.equal(r.status, 'running')
  assert.equal(r.label, `오늘 복습할 거 뭐 있어?, ${r.time}, 답 만드는 중`)
  const n = askRowView(room(), { isNew: true, now })
  assert.equal(n.status, 'new')
  assert.ok(n.label.endsWith(', 새 답 도착'))
  assert.equal(askRowView(room({ preview: null }), { isNew: false, now }).second, ASK_COPY.noMessages)
  assert.equal(askRowView(room({ preview: '' }), { isNew: false, now }).second, ASK_COPY.noMessages)
  const noTime = askRowView(room({ lastMessageAt: null }), { isNew: false, now: null })
  assert.equal(noTime.label, '오늘 복습할 거 뭐 있어?', '시각을 모르면 이름에 빈 쉼표 없음')
})

const noop = () => {}

test('T14 AskListItem — 행은 단추(링크·/ask/ 0) + 형제 ⋯ 단추(단추 안에 단추 없음) · ⋯ 이름 「‘제목’ 메뉴」 · 상태 뱃지 · lang="ja" 통째로 안 닮', () => {
  const now = new Date('2026-10-12T06:00:00.000Z')
  const li = (o: Partial<Parameters<typeof AskListItem>[0]> = {}) =>
    renderToStaticMarkup(createElement('ul', null, createElement(AskListItem, { chat: room({ id: 'a b' }), isNew: false, now, onOpen: noop, onMore: noop, ...o })))
  const html = li()
  assert.ok(!html.includes('<a ') && !html.includes('href='), '링크 0')
  assert.ok(!html.includes('/ask/'), '/ask/<id> 0')
  assert.equal((html.match(/<button /g) ?? []).length, 2, '행 단추 + ⋯ 단추')
  assert.match(html, /^<ul><li class="relative min-w-0"><button [^>]*>[\s\S]*?<\/button><button /, '⋯ 는 행 단추의 형제(행 단추가 닫힌 뒤 시작)')
  const first = html.slice(html.indexOf('<button '), html.indexOf('</button>'))
  assert.ok(!first.slice(1).includes('<button'), '단추 안에 단추 없음')
  assert.ok(html.includes('aria-label="‘오늘 복습할 거 뭐 있어?’ 메뉴"'))
  assert.ok(html.includes('data-ask-row-more="a b"'))
  assert.match(html, /grid h-11 w-11/, '⋯ 터치 44')
  assert.match(html, /pr-\[52px\]/, '제목·뱃지가 ⋯ 와 겹치지 않게 오른쪽 52px')
  assert.ok(!/<span lang="ja" class="min-w-0 flex-1 truncate/.test(html))
  const running = li({ chat: room({ running: true }) })
  assert.match(running, />답 만드는 중</)
  assert.match(running, /선생님이 답을 만드는 중이에요/)
  assert.match(running, /motion-safe:animate-pulse/)
  const fresh = li({ isNew: true })
  assert.match(fresh, />새 답</)
  assert.match(fresh, /bg-accent-soft/)
  assert.ok(!/text-accent[^-]/.test(fresh), '「새 답」 글자는 ink(accent 글자 금지)')
})

test('T13 AskListItem running 덮어쓰기 — 쪽 값 false + 덮어쓴 값 true → 뱃지 · 반대면 뱃지 없음', () => {
  const li = (chat: ChatSummary, running?: boolean) =>
    renderToStaticMarkup(createElement('ul', null, createElement(AskListItem, { chat, isNew: false, now: null, running, onOpen: noop, onMore: noop })))
  assert.match(li(room({ running: false }), true), />답 만드는 중</)
  assert.ok(!li(room({ running: true }), false).includes('>답 만드는 중<'))
  assert.match(li(room({ running: true })), />답 만드는 중</, '덮어쓴 값이 없으면 쪽 값')
})

// ── 입력 카드·예시 ───────────────────────────────────────────────────────────

test('⑰ AskListItem 바깥 클래스 = ChatListItem 바깥 클래스(CHAT_SKELETON 높이가 그대로 맞는다) · 목록 줄 간격 gap-2', () => {
  const chatItem = code('chat', 'ChatListItem.tsx')
  assert.ok(chatItem.includes(`className="${ASK_ROW_CLASS}"`), 'ChatListItem 의 Link 클래스와 같다')
  assert.match(code('ask', 'AskListItem.tsx'), /className=\{`\$\{ASK_ROW_CLASS\} w-full /, '행 단추 바깥 클래스 = ASK_ROW_CLASS(+ 폭·⋯ 자리)')
  assert.match(code('ask', 'AskHistorySheet.tsx'), /<ul className="flex min-w-0 flex-col gap-2"/)
})

test('⑪ askActivityOf — 지금 대화는 running·newCount 에서 뺀다(세면 대화 중인 화면에서 늘 「답 만드는 중」)', () => {
  const items = [room({ id: 'a', running: true }), room({ id: 'b', running: false }), room({ id: 'c', running: false })]
  const newIds = new Set(['b', 'c'])
  assert.deepEqual(askActivityOf(items, 'a', newIds), { running: false, newCount: 2 })
  assert.deepEqual(askActivityOf(items, 'b', newIds), { running: true, newCount: 1 })
  assert.deepEqual(askActivityOf(items, null, newIds), { running: true, newCount: 2 })
  assert.deepEqual(askActivityOf([], null, new Set()), { running: false, newCount: 0 })
  assert.deepEqual(askActivityOf(items, 'x', new Set(['zz'])), { running: true, newCount: 0 }, '목록에 없는 새 답 id 는 세지 않는다')
})

test('⑪ askHistoryState — running > 새 답 > 기본, 접근 이름 3갈래', () => {
  assert.equal(askHistoryState({ running: true, newCount: 3 }), 'running')
  assert.equal(askHistoryState({ running: false, newCount: 1 }), 'new')
  assert.equal(askHistoryState({ running: false, newCount: 0 }), 'idle')
  const html = (running: boolean, newCount: number) => renderToStaticMarkup(createElement(AskHistoryButton, { running, newCount }))
  assert.match(html(false, 0), /aria-label="지난 질문"[^>]*>지난 질문<\/button>/)
  const r = html(true, 2)
  assert.ok(r.includes('aria-label="지난 질문 — 답 만드는 중"') && r.includes('답 만드는 중') && r.includes('motion-safe:animate-pulse'))
  const n = html(false, 2)
  assert.ok(n.includes('aria-label="지난 질문 — 새 답 도착"') && n.includes('새 답 도착') && n.includes('bg-accent-soft'))
  for (const h of [html(false, 0), r, n]) {
    assert.ok(h.includes('h-9') && h.includes('before:h-11') && h.includes('whitespace-nowrap') && h.includes('flex-none'), '보이는 36 · 터치 44 · 줄바꿈 없음')
    assert.ok(!h.includes('aria-live') && !h.includes('role="status"'), '알약은 라이브 영역이 아니다')
  }
})

test('⑪ AskListItem current — 지금 대화도 같은 단추 + 「지금 대화」 뱃지 · 이름에 「, 지금 대화」', () => {
  const cur = renderToStaticMarkup(createElement('ul', null, createElement(AskListItem, { chat: room({ id: 'c1' }), isNew: false, now: null, current: true, onOpen: noop, onMore: noop })))
  assert.ok(cur.includes('<button type="button"') && !cur.includes('href='))
  assert.ok(cur.includes(ASK_COPY.history.current))
  assert.ok(cur.includes(`aria-label="오늘 복습할 거 뭐 있어?, ${ASK_COPY.history.current}"`))
  const other = renderToStaticMarkup(createElement('ul', null, createElement(AskListItem, { chat: room({ id: 'c1' }), isNew: false, now: null, onOpen: noop, onMore: noop })))
  assert.ok(!other.includes('href=') && !other.includes(ASK_COPY.history.current))
})

test('⑫ useAskActivity — 옮긴 판정 배선: 성공 확인(#29 limit=2) 뒤에만 새 답, 토스트는 settleArrivals 가 정할 때만, 지금 대화 제외', () => {
  const h = code('ask', 'useAskActivity.ts')
  assert.match(h, /apiGet<ChatDetail>\(`\/api\/v1\/chats\/\$\{encodeURIComponent\(id\)\}\?limit=2`\)/)
  assert.match(h, /if \(lastAnswerOk\(d\.messages\)\) okIds\.add\(id\)/)
  assert.match(h, /if \(r\.toast\) toastRef\.current\(ASK_COPY\.arrivedToast\)/)
  assert.match(h, /askActivityOf\(items, currentChatId, newIds\)/)
  assert.match(h, /`\/api\/v1\/chats\?kind=ASK&limit=\$\{ASK_LIST_LIMIT\}`/)
  assert.match(h, /\}, \[reloadKey, currentChatId\]\)/, '지금 대화가 바뀌면 다시 읽는다')
  assert.ok(!/apiPost|POST/.test(h), '읽기만 한다')
})

// ── F2 — 도착 판정도 지금 대화를 뺀다 ──────────────────────────────────────────────

test('F2 planArrivals — 지금 대화는 도착 판정(새 답 기록·토스트)에서 뺀다, 다른 대화는 그대로', () => {
  const done = (id: string) => ({ id, running: false })
  const run = (id: string) => ({ id, running: true })
  // 지금 대화(cur)만 running → done: 토스트·새 답 0
  const own = planArrivals(new Set(['cur']), [done('cur')], new Set(), 'cur')
  assert.deepEqual(own, { fromWaiting: [], fromPolling: [], running: [] })
  assert.deepEqual(settleArrivals(own, new Set(['cur'])), { newIds: [], toast: false, leftWaiting: [] })
  // 지금 대화와 다른 대화가 함께 끝남: 다른 대화만 새 답 + 토스트
  const both = planArrivals(new Set(['cur', 'o']), [done('cur'), done('o'), run('r')], new Set(['cur', 'w']), 'cur')
  assert.deepEqual(both, { fromWaiting: [], fromPolling: ['o'], running: ['r'] })
  assert.deepEqual(settleArrivals(both, new Set(['cur', 'o'])), { newIds: ['o'], toast: true, leftWaiting: [] })
  // 지금 대화가 기다리던 방(waiting)이었어도 새 답에 올리지 않는다
  assert.deepEqual(planArrivals(null, [done('cur')], new Set(['cur']), 'cur').fromWaiting, [])
  // 지금 대화가 running 이어도 running 목록(prevRunning 다음 값)에서 빠진다 — 나중에 지금 대화를 떠나 첫 읽기에서 다시 들어온다
  assert.deepEqual(planArrivals(null, [run('cur'), run('o')], new Set(), 'cur').running, ['o'])
  // 지금 대화가 없으면(빈 대화) 아무것도 빼지 않는다
  assert.deepEqual(planArrivals(new Set(['a']), [done('a')], new Set(['w']), null).fromPolling, ['a'])
  // 알약 개수와 같은 기준: askActivityOf 가 세지 않는 대화는 도착 판정에도 안 들어온다
  const items = [run('cur'), done('o')]
  assert.equal(askActivityOf(items, 'cur', new Set(['cur'])).newCount, 0)
})

test('F2 배선 — useAskActivity.settle 은 planArrivals(…, currentChatId) 로 판정하고 arrivedTransitions 를 직접 부르지 않는다', () => {
  const sf = parseCode(join(comp, 'ask', 'useAskActivity.ts'))
  const pa = calls(sf, (c) => c === 'planArrivals')
  assert.equal(pa.length, 1)
  assert.equal(pa[0].arguments.length, 4)
  assert.equal(text(pa[0].arguments[3]), 'currentChatId', '넷째 인자 = 지금 대화')
  assert.equal(calls(sf, (c) => c === 'arrivedTransitions').length, 0)
})

// ── 정리(M11) — 폴링·가시성 구독이 새지 않는다 ──────────────────────────────────────

test('폴링 정리 — 효과의 정리 함수가 취소 표지·타이머·가시성 구독을 모두 푼다, 구독 쌍이 맞다', () => {
  const sf = parseCode(join(comp, 'ask', 'useAskActivity.ts'))
  const poll = effectCallbacks(sf).find((cb) => /const stop = \(\) =>/.test(text(cb)))
  assert.ok(poll, '폴링 효과를 찾지 못했다')
  const cleanup = cleanupOf(poll)
  assert.ok(cleanup, '정리 함수가 없다')
  const body = text(cleanup)
  assert.match(body, /cancelled = true/, '늦게 온 응답을 버린다')
  assert.ok(calls(cleanup, (c) => c === 'stop').length === 1, '폴링 타이머(stop) 정리')
  assert.ok(calls(cleanup, (c) => c === 'clearTimeout').some((c) => text(c.arguments[0]) === 'holdTimer'), '첫 실패 보류 타이머 정리')
  const rm = listenerCalls(cleanup)
  assert.deepEqual(rm.map((l) => [l.kind, l.target, l.event, l.handler]), [['remove', 'document', "'visibilitychange'", 'onVis']])
  // 효과 본문의 구독 = 정리의 해제 (짝)
  const add = listenerCalls(poll).filter((l) => l.kind === 'add')
  assert.deepEqual(add.map((l) => [l.target, l.event, l.handler]), [['document', "'visibilitychange'", 'onVis']])
  // 파일 전체에서도 add/remove 가 대칭
  const all = listenerCalls(sf)
  assert.equal(all.filter((l) => l.kind === 'add').length, all.filter((l) => l.kind === 'remove').length)
  // 화면이 가려지면 멈추고 다시 보이면 읽는다
  const onVis = text(declOf(sf, 'onVis'))
  assert.match(onVis, /visible[\s\S]*void read\(\)[\s\S]*else stop\(\)/)
})
