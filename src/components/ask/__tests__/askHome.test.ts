import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChatSummary } from '@/types/chat'
import { POLL_FAST_MS, POLL_FAST_WINDOW_MS, POLL_MAX_MS, POLL_SLOW_MS } from '../../chat/useChatTurn'
import { isFocusRoute } from '../../shell/routes'
import { readCode } from '../../__tests__/sourceCode'
import { ASK_COPY } from '../askCopy'
import { arrivedTransitions } from '../logic'
import {
  ASK_LIST_LIMIT,
  ASK_ROW_CLASS,
  askCountLine,
  askDraftCheck,
  askExamplesMode,
  askHomeView,
  askListPollDelay,
  askRowView,
  isEnterSubmit,
  lastAnswerOk,
  mergeFirstPage,
  appendRooms,
  settleArrivals,
} from '../homeLogic'
import AskComposerCard from '../AskComposerCard'
import AskExamples from '../AskExamples'
import AskListItem from '../AskListItem'

// task-064 dev-U3 — 질문 목록 `/ask`(screens.md §25-4·25-7·25-11 ⑪⑫⑰⑱).
const comp = join(__dirname, '..', '..')
const app = join(comp, '..', 'app', '(app)')
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

test('askCountLine — 900자부터 보이고 1,000 초과면 경고 머리 + over (Composer 와 같은 규칙)', () => {
  assert.equal(askCountLine(0), null)
  assert.equal(askCountLine(899), null)
  assert.deepEqual(askCountLine(900), { text: '900/1,000', over: false })
  assert.deepEqual(askCountLine(1000), { text: '1,000/1,000', over: false })
  assert.deepEqual(askCountLine(1001), { text: '1,000자까지 보낼 수 있어요 · 1,001/1,000', over: true })
})

test('isEnterSubmit — 정밀 포인터에서만, Shift·IME 조합(isComposing·229) 이면 보내지 않음', () => {
  const k = { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 }
  assert.equal(isEnterSubmit(k, true), true)
  assert.equal(isEnterSubmit(k, false), false, '모바일 Enter = 줄바꿈')
  assert.equal(isEnterSubmit({ ...k, shiftKey: true }, true), false)
  assert.equal(isEnterSubmit({ ...k, isComposing: true }, true), false)
  assert.equal(isEnterSubmit({ ...k, keyCode: 229 }, true), false)
  assert.equal(isEnterSubmit({ ...k, key: 'a' }, true), false)
})

// ── 목록 상태 ────────────────────────────────────────────────────────────────

test('askHomeView·askExamplesMode — 첫 응답 전 loading · 첫 쪽 실패 error · 0개 empty(wrap) · 그 밖 list(row)', () => {
  assert.equal(askHomeView(null, false), 'loading')
  assert.equal(askHomeView(null, true), 'error')
  assert.equal(askHomeView([], false), 'empty')
  assert.equal(askHomeView([room()], false), 'list')
  assert.equal(askHomeView([room()], true), 'list', '받은 행이 있으면 오류 상자 대신 행')
  assert.equal(askExamplesMode('empty'), 'wrap')
  for (const v of ['loading', 'error', 'list'] as const) assert.equal(askExamplesMode(v), 'row')
  assert.equal(ASK_LIST_LIMIT, 20)
})

test('appendRooms — 더 보기는 이미 받은 id 를 빼고 뒤에 붙인다', () => {
  const a = room({ id: 'a' })
  const b = room({ id: 'b' })
  const c = room({ id: 'c' })
  assert.deepEqual(appendRooms([a, b], [b, c]).map((x) => x.id), ['a', 'b', 'c'])
  assert.deepEqual(appendRooms(null, [c]).map((x) => x.id), ['c'])
})

test('mergeFirstPage — 첫 쪽만 받았으면 바꿔 끼움, 더 보기로 늘었으면 뒤쪽 행·커서를 지킨다(위로 올라온 행은 한 번만)', () => {
  const page = (ids: string[], nextCursor: string | null) => ({ items: ids.map((id) => room({ id })), nextCursor })
  assert.deepEqual(mergeFirstPage(null, page(['a', 'b'], 'cur1')), { items: page(['a', 'b'], null).items, cursor: 'cur1' })
  const two = { items: page(['a', 'b'], null).items, cursor: 'cur1' }
  assert.deepEqual(mergeFirstPage(two, page(['c', 'a'], 'cur2')).items.map((x) => x.id), ['c', 'a'])
  assert.equal(mergeFirstPage(two, page(['c', 'a'], 'cur2')).cursor, 'cur2')
  const grown = { items: page(['a', 'b', 'c', 'd'], null).items, cursor: 'cur9' }
  const m = mergeFirstPage(grown, page(['d', 'a'], 'cur1'))
  assert.deepEqual(m.items.map((x) => x.id), ['d', 'a', 'b', 'c'])
  assert.equal(m.cursor, 'cur9', '더 보기로 받은 쪽의 커서를 잃지 않는다')
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

test('AskListItem — 행 전체 링크(/ask/{id} 인코딩) · 상태 뱃지 · 미리보기에 lang="ja" 통째로 달지 않음', () => {
  const now = new Date('2026-10-12T06:00:00.000Z')
  const html = renderToStaticMarkup(createElement(AskListItem, { chat: room({ id: 'a b' }), isNew: false, now }))
  assert.match(html, /href="\/ask\/a%20b"/)
  assert.ok(!/<span lang="ja" class="min-w-0 flex-1 truncate/.test(html))
  const running = renderToStaticMarkup(createElement(AskListItem, { chat: room({ running: true }), isNew: false, now }))
  assert.match(running, />답 만드는 중</)
  assert.match(running, /선생님이 답을 만드는 중이에요/)
  assert.match(running, /motion-safe:animate-pulse/)
  const fresh = renderToStaticMarkup(createElement(AskListItem, { chat: room(), isNew: true, now }))
  assert.match(fresh, />새 답</)
  assert.match(fresh, /bg-accent-soft/)
  assert.ok(!/text-accent[^-]/.test(fresh), '「새 답」 글자는 ink(accent 글자 금지)')
})

// ── 입력 카드·예시 ───────────────────────────────────────────────────────────

test('AskComposerCard — label↔textarea · lang 없음 · rows 3 · 16px · 빈 글이면 aria-disabled · 900자 줄 · 범위 링크 44px', () => {
  const noop = () => {}
  const html = renderToStaticMarkup(createElement(AskComposerCard, { value: '', busy: false, onChange: noop, onSubmit: noop, onScopeInfo: noop }))
  const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1]
  ok(id)
  assert.match(html, new RegExp(`<textarea[^>]*id="${id}"`))
  assert.ok(!/<textarea[^>]*lang=/.test(html), '입력창은 한국어 — lang 없음')
  assert.match(html, /<textarea[^>]*rows="3"/)
  assert.match(html, /text-\[16px\]/)
  assert.match(html, /aria-disabled="true"[^>]*>물어보기</)
  assert.match(html, /선생님에게 보내는 범위/)
  assert.match(html, /min-h-11/)
  assert.ok(!/maxLength|maxlength/.test(html), '글자 수는 코드포인트로 따로 센다')
  assert.ok(!/\/1,000/.test(html))
  const long = renderToStaticMarkup(createElement(AskComposerCard, { value: '가'.repeat(1001), busy: false, onChange: noop, onSubmit: noop, onScopeInfo: noop }))
  assert.match(long, /1,000자까지 보낼 수 있어요 · 1,001\/1,000/)
  assert.match(long, /text-bad/)
  const busy = renderToStaticMarkup(createElement(AskComposerCard, { value: '질문', busy: true, onChange: noop, onSubmit: noop, onScopeInfo: noop }))
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, />보내는 중…</)
})

test('AskExamples — wrap = 제목·설명(굵게 「근거와 함께」)·줄바꿈 / row = 「예시」·가로 한 줄 · 칩 4개 버튼 min-h-11', () => {
  const wrap = renderToStaticMarkup(createElement(AskExamples, { mode: 'wrap', onPick: () => {} }))
  assert.match(wrap, /이렇게 물어볼 수 있어요/)
  assert.match(wrap, /<span class="font-semibold text-ink">근거와 함께<\/span>/)
  assert.match(wrap, /flex flex-wrap gap-2/)
  const row = renderToStaticMarkup(createElement(AskExamples, { mode: 'row', onPick: () => {} }))
  assert.match(row, />예시</)
  assert.match(row, /no-scrollbar -mr-4 mt-2 flex gap-2 overflow-x-auto pr-4/)
  assert.ok(!/이렇게 물어볼 수 있어요/.test(row))
  for (const html of [wrap, row]) {
    assert.equal((html.match(/<button type="button"/g) ?? []).length, 4)
    assert.equal((html.match(/min-h-11/g) ?? []).length, 4)
    for (const e of ASK_COPY.examples) assert.ok(html.includes(e.tag))
  }
  assert.ok(!/말로 물어볼 때/.test(wrap + row), '2단계 상자 없음(D13)')
})

test('예시 칩은 입력창을 채우기만 한다 — AskExamples 는 onPick 만, AskHome 은 칩에서 보내기 함수를 부르지 않는다', () => {
  const ex = code('ask', 'AskExamples.tsx')
  assert.match(ex, /onPick\(e\.q\)/)
  assert.ok(!/submit|apiPost|fetch\(/.test(ex))
  const home = code('ask', 'AskHome.tsx')
  const pick = /onPick=\{([^}]*\}?)\}/.exec(home)?.[1] ?? ''
  ok(pick)
  assert.ok(!/submit|create|send/i.test(pick), `칩 처리기에 보내기 없음: ${pick}`)
})

// ── 생성 흐름·범위 ───────────────────────────────────────────────────────────

test('⑱ 3a 범위 — 목록 파일에 마이크·녹음 import 0 · 생성 본문은 kind ASK + title 만(inputSource 없음) · 목록에서 턴 시작 없음', () => {
  for (const f of ['AskHome.tsx', 'AskComposerCard.tsx', 'AskExamples.tsx', 'AskListItem.tsx', 'AskHomeSkeleton.tsx', 'homeLogic.ts']) {
    const s = code('ask', f)
    assert.ok(!/getUserMedia|useRealtimeStt|PushToTalk|speech\/stt|🎤/.test(s), f)
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|DOMParser/.test(s), f)
    assert.ok(!/claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx/i.test(s), f)
    assert.ok(!/나가서 기다리기/.test(s), f)
  }
  const home = code('ask', 'AskHome.tsx')
  assert.match(home, /apiPost<CreatedChat>\('\/api\/v1\/chats', \{ kind: 'ASK', title \}\)/)
  assert.match(code('ask', 'homeLogic.ts'), /createChat\(askTitleOf\(text\)\)/)
  assert.ok(!/inputSource/.test(home))
  assert.ok(!/\/turns/.test(home), '목록은 턴을 시작하지 않는다(§25-4 E)')
  assert.match(home, /ASK_KEYS\.pending\(/)
  assert.match(home, /creatingRef/)
  assert.match(home, /useScopeNoticeGate\(\)/)
  assert.match(home, /acknowledged !== true/)
})

// ── 구조 ⑰ ───────────────────────────────────────────────────────────────────

test('⑰ 라우트 — ask/(tab)/{page,loading} 있음 · ask/page·ask/loading·ask/[chatId]/loading 없음 · /ask 는 탭 화면', () => {
  assert.ok(existsSync(join(app, 'ask', '(tab)', 'page.tsx')))
  assert.ok(existsSync(join(app, 'ask', '(tab)', 'loading.tsx')))
  assert.ok(!existsSync(join(app, 'ask', 'page.tsx')), '같은 주소 두 파일이면 빌드 실패')
  assert.ok(!existsSync(join(app, 'ask', 'loading.tsx')), '질문 방 진입 때 목록 자리표시가 뜨지 않게')
  assert.ok(!existsSync(join(app, 'ask', '[chatId]', 'loading.tsx')))
  assert.deepEqual(readdirSync(join(app, 'ask', '(tab)')).sort(), ['loading.tsx', 'page.tsx'])
  assert.equal(isFocusRoute('/ask'), false)
  assert.equal(isFocusRoute('/ask/abc'), true)
  const page = readCode(join(app, 'ask', '(tab)', 'page.tsx'))
  assert.match(page, /<AppBar title="질문" \/>/)
  assert.match(page, /<AskHome \/>/)
  assert.ok(!/ComingSoon/.test(page))
  assert.match(readCode(join(app, 'ask', '(tab)', 'loading.tsx')), /<AskHomeSkeleton \/>/)
})

test('⑰ AskHomeSkeleton — 데이터 요청 없음 · 입력 카드·예시는 실제 부품(inert) · 행은 ChatRowsSkeleton · 「불러오는 중」 글자 없음', () => {
  const s = code('ask', 'AskHomeSkeleton.tsx')
  assert.ok(!/apiGet|apiPost|fetch\(|useEffect/.test(s))
  assert.match(s, /<div inert>\s*<AskComposerCard/)
  assert.match(s, /<div inert>\s*<AskExamples mode="row"/)
  assert.match(s, /<ChatRowsSkeleton \/>/)
  assert.match(s, /<AppBar title="질문" \/>/)
  assert.ok(!/불러오는 중/.test(s))
  // 진짜 화면과 같은 바깥 틀·머리(점프 ≤ 8px — §25-7 B)
  const home = code('ask', 'AskHome.tsx')
  const wrap = 'flex min-w-0 flex-col gap-[18px] px-4 pb-8'
  assert.ok(s.includes(wrap) && home.includes(wrap))
  assert.ok(s.includes('mb-2.5 text-[15px] font-bold') && code('ask', 'AskHome.tsx').includes('mb-2.5 text-[15px] font-bold'))
  assert.match(home, /<ChatRowsSkeleton \/>/, '첫 응답 전 진짜 화면도 같은 배치')
})

test('⑰ AskListItem 바깥 클래스 = ChatListItem 바깥 클래스(CHAT_SKELETON 높이가 그대로 맞는다) · 목록 줄 간격 gap-2', () => {
  const chatItem = code('chat', 'ChatListItem.tsx')
  assert.ok(chatItem.includes(`className="${ASK_ROW_CLASS}"`), 'ChatListItem 의 Link 클래스와 같다')
  assert.match(code('ask', 'AskListItem.tsx'), /className=\{ASK_ROW_CLASS\}/)
  assert.match(code('ask', 'AskHome.tsx'), /<ul className="flex min-w-0 flex-col gap-2">/)
})
