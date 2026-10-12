import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChatMessageView } from '@/types/chat'
import { readCode } from '../../__tests__/sourceCode'
import MessageList from '../MessageList'
import type { ChatTurn } from '../useChatTurn'

// task-064 QA64-B2-1 · screens.md §25-5 J-5·J-6 — 공용 MessageList 에 얹은 answer-start 의 연결. 브라우저 없이 확인할 수 있는 것:
// ① 켜는 방은 질문 방뿐 ② 기본값이 지금 동작(렌더 결과가 한 글자도 다르지 않다) ③ 알약 글 ④ 리스너 정리·타이머 없음 ⑤ J-6 함정 순서·즉시 이동.

const LIST = readCode('src/components/chat/MessageList.tsx')
const ASK = readCode('src/components/ask/AskRoom.tsx')

// ── ① 켜는 방은 질문 방뿐 ────────────────────────────────────────────────────

function sourceFiles(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f) && !f.includes('__tests__'))
    .map((f) => join(dir, f))
}

test('① arrivalAlign·pillLabel 을 넘기는 곳은 AskRoom 하나뿐 — 회화·채팅·역할극 방은 넘기지 않는다', () => {
  const users = sourceFiles('src').filter((f) => /<MessageList\b/.test(readCode(f)))
  assert.ok(users.some((f) => f.endsWith('TalkRoom.tsx')) && users.some((f) => f.endsWith('ChatRoom.tsx')) && users.some((f) => f.endsWith('AskRoom.tsx')), `MessageList 쓰는 화면 ${users.join(', ')}`)
  const enabled = users.filter((f) => /\barrivalAlign\b|\bpillLabel\b/.test(readCode(f)))
  assert.deepEqual(enabled.map((f) => f.split('/').pop()), ['AskRoom.tsx'])
})

test('① AskRoom 은 answer-start 와 알약 글(ASK_COPY.newAnswer)을 켜고 followContent 와 함께 쓴다 — 보내기 쪽 scrollToBottom 은 그대로', () => {
  assert.match(ASK, /<MessageList[\s\S]*?\bfollowContent\b[\s\S]*?arrivalAlign="answer-start"[\s\S]*?pillLabel=\{ASK_COPY\.newAnswer\}/)
  // 보내기(doSend — 입력 바·되묻기 칩 공용) · 첫 질문 넘겨받기 두 곳 — 질문+대기 카드가 보이게 늘 맨 아래
  assert.equal((ASK.match(/listRef\.current\?\.scrollToBottom\(\)/g) ?? []).length, 2)
  assert.match(ASK, /const doSend = [\s\S]*?listRef\.current\?\.scrollToBottom\(\)[\s\S]*?void send\(p\.text, p\.opts\)/)
  assert.match(ASK, /handoffRef\.current = null\s*\n\s*listRef\.current\?\.scrollToBottom\(\)\s*\n\s*void send\(text\)/)
})

// ── ② 기본값 = 지금 동작 ─────────────────────────────────────────────────────

test('② 기본값 — arrivalAlign 은 \'bottom\', pillLabel 은 없음, answer-start 판정은 한 곳', () => {
  assert.match(LIST, /\barrivalAlign = 'bottom',/)
  assert.match(LIST, /\n\s+pillLabel,\n/)
  assert.doesNotMatch(LIST, /pillLabel = /)
  assert.match(LIST, /const alignAnswerStart = arrivalAlign === 'answer-start'/)
  assert.doesNotMatch(LIST, /arrivalAlign = 'answer-start'/)
})

const base: ChatMessageView[] = [
  { id: 'u1', role: 'USER', content: '질문이에요', status: 'DONE', createdAt: '2026-10-12T03:00:00.000Z' } as ChatMessageView,
  { id: 'a1', role: 'ASSISTANT', content: '답이에요', status: 'DONE', createdAt: '2026-10-12T03:00:10.000Z' } as ChatMessageView,
]
const noop = () => {}
const turn = {
  phase: 'idle',
  stage: null,
  startedAt: null,
  notice: null,
  failure: null,
  blockedUntil: null,
  endOfTopic: false,
  send: async () => {},
  resume: async () => {},
  attach: noop,
  markFailed: noop,
  clearNotice: noop,
  isBusy: () => false,
} as ChatTurn

function render(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(MessageList, {
      chatId: 'q1',
      messages: base,
      proposals: [],
      teacherName: '사쿠라',
      turn,
      hasOlder: false,
      loadingOlder: false,
      onLoadOlder: noop,
      onPick: noop,
      onProposalChange: noop,
      onToast: noop,
      handleRef: { current: null },
      annotate: false,
      renderUser: () => createElement('span', null, 'Q'),
      renderTutor: () => createElement('span', null, 'A'),
      ...extra,
    }),
  )
}

test('② 기본 렌더 — arrivalAlign 을 안 넘기나 \'bottom\' 을 넘기나 마크업이 같고, 행 표지(data-mid)가 없다', () => {
  const plain = render()
  assert.equal(render({ arrivalAlign: 'bottom' }), plain)
  assert.doesNotMatch(plain, /data-mid/)
  assert.equal((plain.match(/<li\b/g) ?? []).length, 3, '날짜 구분선 1 + 메시지 행 2')
})

test('② answer-start 렌더 — 차이는 메시지 행의 data-mid 표지뿐(순서·구조·클래스 그대로)', () => {
  const plain = render()
  const ask = render({ arrivalAlign: 'answer-start', pillLabel: '새 답' })
  assert.match(ask, /<li data-mid="u1"/)
  assert.match(ask, /<li data-mid="a1"/)
  assert.equal(ask.replace(/ data-mid="[^"]*"/g, ''), plain)
})

test('② 기본 모드의 바닥 붙임 규칙 4곳이 그대로 — 첫 로드·앞붙임 보정·바닥이면 따라감·진행 말풍선 효과', () => {
  assert.match(LIST, /\} else if \(p\.count === 0 && messages\.length > 0\) \{\s*\n\s*el\.scrollTop = el\.scrollHeight\s*\n\s*\} else if \(firstId !== p\.first && lastId === p\.last && messages\.length > p\.count\) \{\s*\n\s*el\.scrollTop \+= el\.scrollHeight - p\.scrollHeight\s*\n\s*\} else if \(atBottomRef\.current\) \{\s*\n\s*el\.scrollTop = el\.scrollHeight/)
  assert.match(LIST, /if \(el && atBottomRef\.current\) el\.scrollTop = el\.scrollHeight\s*\n\s*\}, \[pendingVisible, turn\.phase\]\)/)
  // 기본 알약 조건과 글은 기본 모드에 남는다
  assert.match(LIST, /alignAnswerStart \? pillId !== null : !atBottom && lastId !== null && leftAtLastId !== null && lastId !== leftAtLastId/)
  assert.match(LIST, /onClick=\{alignAnswerStart \? onArrivalPill : scrollToBottom\}/)
  assert.match(LIST, /\) : \(\s*'새 메시지 ↓'\s*\)\}/)
})

// ── ③ 알약 글 ────────────────────────────────────────────────────────────────

test('③ 알약 — pillLabel 이 있으면 글 + aria-hidden ↓ (이름은 「새 답」), 없으면 「새 메시지 ↓」', () => {
  assert.match(LIST, /\{pillLabel \? \(\s*<>\s*\{pillLabel\}\s*<span aria-hidden="true"> ↓<\/span>\s*<\/>\s*\) : \(/)
  assert.match(ASK, /pillLabel=\{ASK_COPY\.newAnswer\}/)
})

test('③ 알약 글 상수 — ASK_COPY.newAnswer 는 「새 답」 한 곳(목록 뱃지와 같은 말)', async () => {
  const { ASK_COPY } = await import('@/components/ask/askCopy')
  assert.equal(ASK_COPY.newAnswer, '새 답')
})

// ── ④ 정리 ───────────────────────────────────────────────────────────────────

test('④ 정리 — 목록 만짐 리스너 5종은 같은 이름으로 해제하고, 관찰자는 모두 disconnect, 타이머는 없다', () => {
  assert.match(LIST, /const events = \['pointerdown', 'touchstart', 'wheel', 'keydown', 'click'\] as const/)
  assert.match(LIST, /for \(const name of events\) el\.addEventListener\(name, touched, \{ passive: true \}\)/)
  assert.match(LIST, /return \(\) => \{\s*\n\s*for \(const name of events\) el\.removeEventListener\(name, touched\)\s*\n\s*\}/)
  assert.equal((LIST.match(/new ResizeObserver/g) ?? []).length, 2)
  assert.equal((LIST.match(/ro\.disconnect\(\)/g) ?? []).length, 2)
  // 2초 창은 시간 비교(`performance.now()`)만 — 지연 타이머가 없으니 언마운트 뒤 남는 것이 없다
  assert.doesNotMatch(LIST, /setTimeout|setInterval|requestAnimationFrame/)
})

test('④ REV-SCROLL-4 만짐 판정에 click 이 있다 — 접근성 클릭(TalkBack)은 포인터·터치 없이 click 만 내므로 빠지면 2초 창 안 [n개 더 보기]가 사용자를 끌어올린다', () => {
  // 만짐 효과 한 덩어리(events 선언을 품은 useEffect 부터 showPill 계산 직전까지)만 본다 — 다른 곳의 'click'(알약 onClick 등)이 단언을 대신 통과시키지 못하게.
  // LIST 는 주석을 걷은 소스라 주석 속 'click' 도 세지 않는다.
  const start = LIST.lastIndexOf('useEffect(', LIST.indexOf('const events = ['))
  const end = LIST.indexOf('const showPill = ')
  assert.ok(start > 0 && end > start, '만짐 효과 구간을 찾지 못했다')
  const effect = LIST.slice(start, end)
  const m = effect.match(/const events = \[([^\]]*)\] as const/)
  assert.ok(m, 'events 배열 선언')
  const names = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
  assert.ok(names.includes('click'), `만짐 이벤트 ${names.join('/')} 에 click 이 없다`)
  assert.deepEqual([...names].sort(), ['click', 'keydown', 'pointerdown', 'touchstart', 'wheel'], '의도 밖 이벤트가 끼지 않았다')
  // 등록과 해제는 같은 배열(events)을 도는 반복문 하나씩 — 따로 붙인 리스너(`addEventListener('click', …)` 같은 것)가 해제 없이 남지 않는다
  assert.equal((effect.match(/addEventListener\(/g) ?? []).length, 1, '등록 호출은 반복문 하나뿐')
  assert.equal((effect.match(/removeEventListener\(/g) ?? []).length, 1, '해제 호출은 반복문 하나뿐')
  assert.match(effect, /for \(const name of events\) el\.addEventListener\(name, touched, \{ passive: true \}\)/)
  assert.match(effect, /return \(\) => \{\s*\n\s*for \(const name of events\) el\.removeEventListener\(name, touched\)\s*\n\s*\}/)
  // 기본 'bottom' 방은 등록 전에 빠져나간다 — 이 효과는 answer-start 일 때만 일한다(현재 보장 유지)
  const guard = effect.indexOf('if (!alignAnswerStart || !el) return')
  assert.ok(guard > 0 && guard < effect.indexOf('addEventListener'), "alignAnswerStart 가 아니면 등록 전에 return")
  assert.match(effect, /\}, \[alignAnswerStart\]\)\s*$/)
})

// ── ⑤ J-4·J-6 ────────────────────────────────────────────────────────────────

test('⑤ J-4 이동은 모두 즉시 — behavior·scrollIntoView·scrollTo 없음, 초점은 알약을 누를 때만(preventScroll)', () => {
  assert.doesNotMatch(LIST, /behavior\s*:|scrollIntoView|\.scrollTo\(|\.scrollBy\(/)
  assert.match(LIST, /const onArrivalPill = \(\) => \{[\s\S]*?alignAndWatch\(id\)[\s\S]*?focusList\(\)\s*\n\s*\}/)
  assert.match(LIST, /const focusList = \(\) => \{\s*\n\s*if \(focusable\) scrollRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  // 도착(레이아웃 효과) 쪽에서는 초점을 옮기지 않는다
  const layout = LIST.slice(LIST.indexOf('const p = prev.current'), LIST.indexOf('prev.current = {'))
  assert.doesNotMatch(layout, /focus/)
})

test('⑤ J-6 ① 정렬 직후 「바닥에 붙음」 판정을 새 위치로 바로 다시 잰다 — 같은 커밋의 진행 말풍선 효과·내용 따라가기가 되돌리지 않게', () => {
  assert.match(LIST, /el\.scrollTop = target\s*\n\s*settleBottom\(el\)\s*\n\s*return true/)
  assert.match(LIST, /const settleBottom = useCallback\(\(el: HTMLDivElement\) => \{\s*\n\s*const near = el\.scrollHeight - el\.scrollTop - el\.clientHeight < BOTTOM_SLACK_PX\s*\n\s*atBottomRef\.current = near\s*\n\s*setAtBottom\(near\)/)
})

test('⑤ J-6 ② 알약은 「도착한 답 id」(pillId)로 든다 — 기본 조건(leftAtLastId)을 쓰지 않고, 보내기(scrollToBottom)가 알약과 2초 창을 끝낸다', () => {
  assert.match(LIST, /const showPill = alignAnswerStart \? pillId !== null :/)
  assert.match(LIST, /const scrollToBottom = \(\) => \{[\s\S]*?setAtBottom\(true\)\s*\n\s*if \(alignAnswerStart\) \{\s*\n\s*alignRef\.current = null\s*\n\s*setPill\(null\)\s*\n\s*\}\s*\n\s*\}/)
  // 알약은 바닥 도달·답 윗면이 보임 때 사라진다(스크롤마다 한 번 재서)
  assert.match(LIST, /if \(near \|\| aTop === null \|\| isTopInView\(aTop, el\.scrollTop, el\.clientHeight\)\) setPill\(null\)/)
})

test('⑤ J-6 ③④ 도착 정렬은 레이아웃 효과(그리기 전)에서, 정렬한 커밋은 바닥 붙임 규칙을 건너뛴다 — 대기 행 생김은 default', () => {
  assert.match(LIST, /useLayoutEffect\(\(\) => \{\s*\n\s*const el = scrollRef\.current\s*\n\s*if \(!el\) return\s*\n\s*const p = prev\.current\s*\n\s*let handled = false/)
  assert.match(LIST, /if \(plan === 'align' && last\) \{\s*\n\s*handled = alignAndWatch\(last\.id\)/)
  assert.match(LIST, /firstLoad: p\.count === 0 && messages\.length > 0,/)
  assert.match(LIST, /prevStatus: last \? statusRef\.current\.get\(last\.id\) : undefined,/)
  assert.match(LIST, /if \(handled\) \{\s*\n\s*\} else if \(p\.count === 0/)
})

test('⑤ J-3 내용이 늘면 창 안에서는 같은 식으로 다시 맞춘다 — 기본 방은 기존 contentGrowthAction 그대로', () => {
  assert.match(LIST, /const action = alignAnswerStart\s*\n\s*\? windowGrowthAction\(\{[^}]*touched: win \? win\.touched : false[^}]*\}\)\s*\n\s*: contentGrowthAction\(now, holdUntilRef\.current, atBottomRef\.current\)/)
  assert.match(LIST, /if \(action === 'realign'\) \{\s*\n\s*if \(win\) alignTo\(win\.answerId\)\s*\n\s*\} else if \(action === 'hold'\)/)
})
