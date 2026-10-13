import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AppBar from '../../shell/AppBar'
import { ASK_COPY } from '../askCopy'
import AskHeadTitle from '../AskHeadTitle'

// task-067 §27-10 T18·T19 — 공용 머리 `AppBar heading`(다른 탭 불변)과 질문 머리 제목 블록 3상태. 변이: 각 줄 끝 주석.

// heading 을 넣기 전 AppBar 출력(2026-10-13 지금 코드를 렌더해 적은 값) — 회화·공부·계획표·단어장 머리는 한 글자도 바뀌면 안 된다.
const AVATAR =
  '<a aria-label="설정" class="grid h-11 w-11 flex-none place-items-center rounded-full" href="/settings"><span class="grid h-8 w-8 place-items-center rounded-full bg-good text-[13px] font-semibold text-white">나</span></a></header>'
const HEADER = '<header class="sticky top-0 z-10 mb-2.5 flex h-[52px] flex-none items-center gap-2 bg-surface pl-4 pr-3">'
const OLD_PLAIN = `${HEADER}<h1 class="min-w-0 flex-1 truncate text-xl font-bold">단어장</h1>${AVATAR}`
const OLD_SUB = `${HEADER}<h1 class="min-w-0 flex-1 truncate text-xl font-bold">계획표<span class="ml-2 text-sm font-light text-ink3">10월</span></h1><button type="button">R</button>${AVATAR}`

const bar = (p: Parameters<typeof AppBar>[0]) => renderToStaticMarkup(createElement(AppBar, p))
const head = (p: Parameters<typeof AskHeadTitle>[0]) => renderToStaticMarkup(createElement(AskHeadTitle, p))
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length

test('T18 AppBar — heading 없으면 지금과 같은 문자열(제목만·부제+오른쪽), 있으면 h1 1개 안에 단추·title/subtitle 은 안 그림', () => {
  assert.equal(bar({ title: '단어장' }), OLD_PLAIN)
  assert.equal(bar({ title: '계획표', subtitle: '10월', right: createElement('button', { type: 'button' }, 'R') }), OLD_SUB)
  const h = bar({ title: ASK_COPY.title, subtitle: '숨김', heading: createElement(AskHeadTitle, { state: 'ready', title: '大丈夫 쓰임', onRename: () => {} }) })
  assert.equal(count(h, /<h1\b/g), 1)
  assert.match(h, /<h1 class="flex min-w-0 flex-1"><button\b[^]*<\/button><\/h1>/) // 단추가 h1 을 대신하면 실패
  assert.ok(!h.includes('숨김') && !h.includes('truncate text-xl font-bold">질문</h1>'))
  assert.ok(h.startsWith(HEADER) && h.endsWith(AVATAR), '머리 높이·여백·아바타 그대로')
})

test('T19 AskHeadTitle new — 단추 0 · 「질문」 + 「새 질문」 두 줄', () => {
  const h = head({ state: 'new' })
  assert.equal(count(h, /<button\b/g), 0)
  assert.ok(h.includes(`>${ASK_COPY.title}</span>`) && h.includes(`>${ASK_COPY.head.newConv}</span>`))
  assert.ok(h.includes('h-11') && h.includes('text-[12.5px]'))
})

test('T19 AskHeadTitle loading — 단추 0(불러오는 중엔 못 누름) · 힌트가 있으면 그 제목(일본어 lang=ja), 없으면 회색 막대(aria-hidden)', () => {
  const hint = head({ state: 'loading', title: '駅で 내리다', onRename: () => {} })
  assert.equal(count(hint, /<button\b/g), 0) // 불러오는 중에도 누를 수 있게 하면 실패
  assert.ok(hint.includes('lang="ja"') && hint.includes('駅で') && !hint.includes('bg-surface2'))
  const none = head({ state: 'loading', title: null })
  assert.equal(count(none, /<button\b/g), 0)
  assert.match(none, /<span aria-hidden="true" class="block h-3 w-24 rounded bg-surface2"><\/span>/)
})

test('T19 AskHeadTitle ready — 단추 1 · 이름 「질문 · 지금 대화 「…」 — 눌러서 제목 바꾸기」 · 둘째 줄 truncate · 연필 aria-hidden · 누름 표시', () => {
  const h = head({ state: 'ready', title: 'お疲れ様 인사', onRename: () => {} })
  assert.equal(count(h, /<button\b/g), 1)
  assert.ok(h.includes(`aria-label="질문 · 지금 대화 「お疲れ様 인사」 — 눌러서 제목 바꾸기"`))
  assert.match(h, /<span class="min-w-0 truncate"><span[^>]*lang="ja"[^>]*>お疲れ様/)
  assert.match(h, /<svg [^>]*aria-hidden="true"/)
  assert.ok(h.includes('active:bg-surface2') && h.includes('active:shadow-[inset_0_0_0_2px_var(--color-accent)]'))
})

test('T19 AskHeadTitle ready — 단추를 누르면 onRename 이 불린다(연결이 끊기면 눌러도 아무 일 없는 단추), 단추 아닌 상태는 onRename 을 달지 않는다 [REV-067B-4]', () => {
  // 훅이 없는 함수 컴포넌트라 직접 불러 요소 트리의 핸들러를 본다(DOM 시험 도구가 없다).
  let renamed = 0
  const onRename = () => {
    renamed++
  }
  const el = AskHeadTitle({ state: 'ready', title: '駅で', onRename }) as ReactElement<{ onClick?: () => void }>
  assert.equal(el.type, 'button')
  assert.equal(el.props.onClick, onRename) // onClick={onRename} 을 지우면 실패
  el.props.onClick?.()
  assert.equal(renamed, 1)
  for (const state of ['new', 'loading'] as const) {
    const other = AskHeadTitle({ state, title: '駅で', onRename }) as ReactElement
    assert.notEqual(other.type, 'button', `${state}: 단추가 아니다`)
  }
})
