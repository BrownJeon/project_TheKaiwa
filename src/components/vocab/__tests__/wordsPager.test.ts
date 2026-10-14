import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ChunkChips, { chunkChipsFor } from '../ChunkChips'
import WordsPager, { PAGER_BTN } from '../WordsPager'
import { WordsJumpBody } from '../WordsJumpSheet'
import { jumpDecision, parseJumpPage, wordsPagerView } from '../wordsPaging'

// task-068 §28-9 T4(렌더) · T10 · J11 — 쪽 줄 · 쪽으로 이동 시트 본문 · 조각 칩 variant.

const noop = () => {}
const pager = (page: number, status: 'ready' | 'paging' | 'pageError' = 'ready', pages = 1109, total = 7758) =>
  renderToStaticMarkup(createElement(WordsPager, { view: wordsPagerView({ page, pages, total, status }), onPrev: noop, onNext: noop, onJump: noop }))
const buttons = (html: string) => html.match(/<button[^>]*>/g) ?? []

test('T4 쪽 줄 렌더 — nav 이름 · 가운데 단추 이름 · status 한 줄 · 흐림은 aria-disabled 이고 disabled 속성 0', () => {
  const mid = pager(2)
  assert.match(mid, /<nav aria-label="단어 목록 쪽"/)
  assert.match(mid, /aria-label="3 \/ 1,109 — 쪽으로 이동"/)
  assert.match(mid, /<p role="status" class="sr-only">1,109쪽 중 3쪽 · 모두 7,758개<\/p>/)
  assert.match(mid, />3 \/ 1,109</)
  assert.match(mid, />모두 7,758개</)
  assert.equal(buttons(mid).length, 3)
  assert.ok(buttons(mid).every((b) => !/aria-disabled="/.test(b)), '중간 쪽은 셋 다 쓸 수 있다')

  const first = buttons(pager(0))
  assert.match(first[0] ?? '', /aria-disabled="true"/)
  assert.doesNotMatch(first[2] ?? '', /aria-disabled="/)
  const last = buttons(pager(1108))
  assert.match(last[2] ?? '', /aria-disabled="true"/)
  const busy = pager(3, 'paging')
  assert.ok(buttons(busy).every((b) => /aria-disabled="true"/.test(b)), 'paging — 세 단추 모두 흐림')
  assert.match(busy, /4쪽을 불러오고 있어요/)
  const err = buttons(pager(2, 'pageError'))
  assert.deepEqual(err.map((b) => /aria-disabled="true"/.test(b)), [false, false, true])
  for (const html of [mid, pager(0), pager(1108), busy, pager(2, 'pageError')]) assert.doesNotMatch(html, /\sdisabled(=|\s|>)/, 'disabled 속성은 쓰지 않는다')
})

test('PAGER_BTN 은 질문 탭 AskPager 의 문자열과 같다(ask/ 를 import 하지 않고 따로 둔 값)', () => {
  const ask = readFileSync(join(__dirname, '..', '..', 'ask', 'AskPager.tsx'), 'utf8')
  const m = /const PAGER_BTN =\s*'([^']+)'/.exec(ask)
  assert.ok(m)
  assert.equal(PAGER_BTN, m[1])
  assert.doesNotMatch(readFileSync(join(__dirname, '..', 'WordsPager.tsx'), 'utf8'), /from '[^']*ask\//)
})

test('J11 쪽으로 이동 — 잘못된 번호는 오류 · 같은 쪽은 닫기만 · 다른 쪽은 그 쪽 · 처음/마지막 쪽', () => {
  assert.deepEqual(jumpDecision(parseJumpPage('2000', 1109), 3), { kind: 'invalid' })
  assert.deepEqual(jumpDecision(parseJumpPage('0', 1109), 3), { kind: 'invalid' })
  assert.deepEqual(jumpDecision(parseJumpPage('', 1109), 3), { kind: 'invalid' })
  assert.deepEqual(jumpDecision(parseJumpPage('4', 1109), 3), { kind: 'stay' })
  assert.deepEqual(jumpDecision(parseJumpPage('512', 1109), 3), { kind: 'go', page: 511 })
  assert.deepEqual(jumpDecision(0, 3), { kind: 'go', page: 0 })
  assert.deepEqual(jumpDecision(1108, 1108), { kind: 'stay' })
})

test('J11 쪽으로 이동 본문 — 지금 쪽 · 숫자 칸(numeric·go·placeholder) · 오류면 aria-invalid + 안내 연결 · 처음/마지막/이동', () => {
  const base = { page: 2, pages: 1109, value: '', onValue: noop, onSubmit: noop, onFirst: noop, onLast: noop }
  const ok = renderToStaticMarkup(createElement(WordsJumpBody, { ...base, error: false }))
  assert.match(ok, /지금 3쪽 · 모두 1,109쪽/)
  assert.match(ok, /<label for="wjump"[^>]*>쪽 번호<\/label>/)
  assert.match(ok, /<input id="wjump" inputMode="numeric" enterKeyHint="go" autoComplete="off" placeholder="1–1,109"/)
  assert.doesNotMatch(ok, /aria-invalid|role="alert"/)
  assert.match(ok, /border-line/)
  for (const t of ['처음 쪽', '마지막 쪽', '이동']) assert.match(ok, new RegExp(`>${t}</button>`))
  const bad = renderToStaticMarkup(createElement(WordsJumpBody, { ...base, value: '2000', error: true }))
  assert.match(bad, /aria-invalid="true" aria-describedby="wjump_err"/)
  assert.match(bad, /<p id="wjump_err" role="alert"[^>]*>1부터 1,109 사이 숫자를 적어 주세요<\/p>/)
  assert.match(bad, /border-bad/)
  assert.doesNotMatch(ok + bad, /\slang=/, '숫자 칸에는 lang 이 없다')
})

test('T10 조각 칩 — 단어장(기본) 전체·이름·액션·느낌·꾸밈·표현 · 「없음」 0 · 교정 모음 4개', () => {
  const words = renderToStaticMarkup(createElement(ChunkChips, { value: null, onChange: noop }))
  const labels = [...words.matchAll(/role="radio"[^>]*>([^<]+)</g)].map((m) => m[1])
  assert.deepEqual(labels, ['전체', '이름', '액션', '느낌', '꾸밈', '표현'])
  assert.ok(!words.includes('없음'))
  assert.match(words, />표현<span class="sr-only"> 조각<\/span>/)
  const corr = renderToStaticMarkup(createElement(ChunkChips, { value: null, onChange: noop, variant: 'corrections' }))
  assert.deepEqual([...corr.matchAll(/role="radio"[^>]*>([^<]+)</g)].map((m) => m[1]), ['전체', '이름', '액션', '느낌', '꾸밈'])
  assert.ok(!corr.includes('표현'))
  assert.deepEqual(chunkChipsFor('corrections').map((c) => c.value), ['NAME', 'ACTION', 'FEELING', 'MODIFIER'])
  assert.deepEqual(chunkChipsFor().map((c) => c.value), ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'])
})
