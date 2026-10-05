/**
 * task-033 B — 카드 뒷면·세트 결과 목록의 일본어 표시 층(§15-11-3). 화면 파일 정적 경계 + 순수 판정 + 서버 렌더 한 번.
 * 실 화면(360/390/412 × 780/892)은 개발 서버에서 따로 본다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { nextDropLevel, overflowsBody, pickDropLevel, type DropLevel } from '../VocabCardFace'
import WordResultList from '../WordResultList'
import type { VocabCard } from '@/types/vocab'

const ROOT = join(process.cwd(), 'src', 'components', 'vocab')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')

test('overflowsBody: 0.5px 이하는 넘침 아님, 그 위는 넘침, 자식 하나라도 넘으면 넘침', () => {
  assert.equal(overflowsBody(300, []), false)
  assert.equal(overflowsBody(300, [250, 300.5]), false)
  assert.equal(overflowsBody(300, [250, 300.6]), true)
  assert.equal(overflowsBody(300, [310, 120]), true)
})

test('단계 선택: 안 넘치면 0, 0단계만 넘치면 1, 1단계도 넘치면 2, 2단계 뒤에도 넘쳐도 더 빼지 않는다', () => {
  assert.equal(pickDropLevel([false]), 0)
  assert.equal(pickDropLevel([]), 0)
  assert.equal(pickDropLevel([true, false]), 1)
  assert.equal(pickDropLevel([true, true, false]), 2)
  assert.equal(pickDropLevel([true, true, true]), 2)
  assert.equal(pickDropLevel([true, true, true, true]), 2)
})

test('단계는 올라가기만 한다 — 0→1→2, 덜 넘쳐도 내리지 않고 2 에서 멈춘다(되돌림 없음)', () => {
  assert.equal(nextDropLevel(0, true), 1)
  assert.equal(nextDropLevel(1, true), 2)
  assert.equal(nextDropLevel(2, true), 2)
  for (const l of [0, 1, 2] as DropLevel[]) {
    assert.ok(nextDropLevel(l, false) === l, `넘치지 않으면 ${l} 유지`)
    assert.ok(nextDropLevel(l, true) >= l, `${l} 에서 내려가지 않는다`)
  }
})

test('2단계 규칙 정적 경계: 1단계 = 예문 [한글], 2단계 = 표제어 [한글], 효과 의존성은 키·단계뿐(드래그에 걸지 않음)', () => {
  const src = read('VocabCardFace.tsx')
  assert.match(src, /dropLevel >= 1 \? null : <HangulLine state=\{exampleAnn\}/)
  assert.match(src, /dropLevel >= 2 \? null : <HangulLine state=\{backHangul\}/)
  assert.match(src, /\}, \[measureKey, dropLevel\]\)/)
  assert.match(src, /wantMeasure && drop\.key === measureKey \? drop\.level : 0/)
})

test('뒷면: 표제어는 rubyAlways(C1-A)·옆 읽기 칸 없음·예문 [한글] 1줄 말줄임', () => {
  const src = read('VocabCardFace.tsx')
  assert.match(src, /rubyAlways\s+leading=\{2\}\s+rt=\{11\}/)
  assert.ok(!/\{card\.reading\}/.test(src), '옆 읽기 칸')
  assert.match(src, /<HangulLine state=\{exampleAnn\} size=\{13\} className="line-clamp-1!"/)
  assert.match(src, /leading=\{2\.15\}/)
})

test('뒷면 측정: 드래그 이벤트에 걸지 않는다 — 키(카드·면·예문·분석 상태·카드 상자 크기)에만 한 번', () => {
  const src = read('VocabCardFace.tsx')
  assert.ok(!/pointermove|touchmove|scroll|onDrag/.test(src))
  assert.match(src, /new ResizeObserver/)
  assert.ok(!/\bkanaToHangul\b|\bpronLine\b/.test(src + read('WordResultList.tsx') + read('VocabDeck.tsx')))
})

test('덱: 한글은 카드 [읽기]와 무관하게 늘 받고(훅은 한글 끔이면 요청 안 함), 예문은 한 번에 받아 면에 넘긴다', () => {
  const src = read('VocabDeck.tsx')
  assert.match(src, /useWordLayersList\(cards\.map/)
  assert.ok(!/deck\.showReading \? cards\.map/.test(src))
  assert.match(src, /useAnnotations\(cards\.map\(\(c\) => c\.example \?\? ''\)\)/)
  assert.match(src, /backHangul=\{backHangul\}/)
  assert.match(src, /exampleAnn=\{exampleAnn\}/)
})

const card = (over: Partial<VocabCard>): VocabCard =>
  ({ order: 0, wordId: 'w1', surface: '注文', reading: 'ちゅうもん', meaning: '주문', correctText: '주문', answer: 'WRONG', chosenText: '배달', flagged: false, ...over }) as VocabCard

test('세트 결과 목록: 옆 읽기 칸 없이 표제어 + 정답·내 답 줄(설정 로드 전에는 본문만)', () => {
  const html = renderToStaticMarkup(
    createElement(WordResultList, {
      title: '틀린 단어 2',
      showResult: false,
      cards: [card({}), card({ order: 1, wordId: null, surface: 'ありがとう', reading: null, answer: 'CORRECT', chosenText: null })],
    }),
  )
  assert.match(html, /注文/)
  assert.ok(!html.includes('ちゅうもん'), '옆 읽기 칸이 남아 있다')
  assert.match(html, /정답 주문 · 내 답 배달/)
  assert.match(html, /지운 단어/)
  assert.equal(renderToStaticMarkup(createElement(WordResultList, { cards: [], showResult: true })), '')
})
