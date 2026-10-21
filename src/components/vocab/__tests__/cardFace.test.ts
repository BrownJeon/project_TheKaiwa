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
import { NONE, OFF } from '@/components/common/japanese/annotations'
import VocabCardFace, { hangulOnOwnLine, nextDropLevel, overflowsBody, pickDropLevel, type DropLevel } from '../VocabCardFace'
import type { DeckCard } from '../useVocabDeck'
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
  assert.equal(pickDropLevel([false, true, true]), 0, '0단계에서 안 넘치면 뒤 측정값은 보지 않는다 — 인라인이라 자리를 안 쓰는 짧은 표제어는 2단계에 가지 않는다')
})

test('단계 선택(task-082 r3): 2단계는 1단계 뒤에도 넘치고 표제어 한글이 아래 줄일 때만 — 인라인이면 1에서 멈춘다', () => {
  assert.equal(pickDropLevel([true, true, true], [false, false, false]), 1, '좁은 카드 — 넘치지만 표제어 한글은 한 줄(인라인) → 1')
  assert.equal(pickDropLevel([true, true, true], [false, true, false]), 2, '1단계 뒤에도 넘치고 표제어 한글이 아래 줄 → 2')
  assert.equal(pickDropLevel([true, true, false], [true, true, true]), 2)
  assert.equal(pickDropLevel([true, false, true], [true, true, true]), 1, '1단계에서 안 넘치면 거기서 멈춘다')
  assert.equal(pickDropLevel([true, true, true], [true, false, true]), 1, '0단계 때 아래 줄이었어도 1단계 측정값(인라인)이 기준이다')
  assert.equal(pickDropLevel([false, true, true], [true, true, true]), 0)
  assert.equal(pickDropLevel([true, true, true], []), 2, 'wrappedAt 생략 = 아래 줄(기존 호출 의미 보존)')
})

test('단계는 올라가기만 한다 — 0→1→2, 덜 넘쳐도 내리지 않고 2 에서 멈춘다(되돌림 없음)', () => {
  assert.equal(nextDropLevel(0, true), 1)
  assert.equal(nextDropLevel(1, true), 2)
  assert.equal(nextDropLevel(2, true), 2)
  for (const l of [0, 1, 2] as DropLevel[]) {
    for (const w of [true, false]) {
      assert.ok(nextDropLevel(l, false, w) === l, `넘치지 않으면 ${l} 유지(아래 줄 ${w})`)
      assert.ok(nextDropLevel(l, true, w) >= l, `${l} 에서 내려가지 않는다(아래 줄 ${w})`)
    }
  }
})

test('nextDropLevel 세 번째 인자(task-082 r3): 0→1 은 넘침만, 1→2 는 넘침 + 아래 줄, 2 는 어느 쪽이든 2', () => {
  assert.equal(nextDropLevel(1, true, false), 1, '인라인이면 빼도 높이가 안 준다 → 1 유지')
  assert.equal(nextDropLevel(1, true, true), 2)
  assert.equal(nextDropLevel(1, false, true), 1)
  assert.equal(nextDropLevel(0, true, false), 1, '0→1 은 아래 줄 여부와 무관')
  assert.equal(nextDropLevel(0, true, true), 1)
  assert.equal(nextDropLevel(0, false, true), 0)
  assert.equal(nextDropLevel(2, true, false), 2)
  assert.equal(nextDropLevel(2, true, true), 2)
})

test('hangulOnOwnLine(task-082 r4, offset 좌표): 윗변이 표제어 아랫변에서 1 이내 위까지는 아래 줄, 그보다 위(같은 줄 baseline 정렬)는 아님', () => {
  assert.equal(hangulOnOwnLine(100, 100), true, '딱 붙어 다음 줄(윗변 == 아랫변)')
  assert.equal(hangulOnOwnLine(100, 99), true, '경계 아랫변 - 1 은 아래 줄')
  assert.equal(hangulOnOwnLine(100, 98.99), false, '아랫변 - 1.01 은 같은 줄')
  assert.equal(hangulOnOwnLine(100, 98), false, '정수 offset 으로 1 보다 더 위 — 같은 줄')
  assert.equal(hangulOnOwnLine(100, 112), true, 'gap 이 있어도 아래 줄')
  assert.equal(hangulOnOwnLine(100, 90), false, '같은 줄 — 한글 윗변이 표제어 안쪽')
  assert.equal(hangulOnOwnLine(100, 60), false)
  assert.equal(hangulOnOwnLine(44, 44), true, '표제어 offsetTop 0·offsetHeight 44 바로 아래 줄')
  assert.equal(hangulOnOwnLine(44, 12), false, '인라인(baseline 정렬 — 작은 한글 윗변이 표제어 윗변 쪽)')
})

test('2단계 규칙 정적 경계(task-082 r2): 1단계 = 예문 [한글], 2단계 = 표제어 [한글](최후 수단), 효과 의존성은 키·단계뿐(드래그에 걸지 않음)', () => {
  const src = read('VocabCardFace.tsx')
  assert.match(src, /dropLevel >= 1 \? null : <HangulLine state=\{exampleAnn\}/)
  assert.match(src, /export type DropLevel = 0 \| 1 \| 2\n/)
  assert.match(src, /\}, \[measureKey, dropLevel\]\)/)
  assert.match(src, /wantMeasure && drop\.key === measureKey \? drop\.level : 0/)
})

test('아래 줄 판정 → 2단계 연결(task-082 r4): 표제어 행 ref 의 자식 [표제어, 한글] 이 둘일 때만 offset 좌표로 판정하고 측정 효과가 nextDropLevel 세 번째 인자로 넘긴다', () => {
  const src = read('VocabCardFace.tsx')
  const effect = src.slice(src.indexOf('useLayoutEffect(() => {\n    if (!measureKey) return'), src.indexOf('const shell = '))
  assert.ok(effect.length > 100, '측정 효과 슬라이스를 찾았다')
  assert.match(src, /<div ref=\{headRef\} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">/, '표제어 행 컨테이너에 ref')
  assert.match(effect, /const kids = headRef\.current\?\.children/)
  assert.match(effect, /const first = kids && kids\.length >= 2 \? kids\[0\] : null/, '자식이 둘 미만이면(한글 없음 = 대기·끔·2단계) 아래 줄 아님')
  assert.match(effect, /const last = kids && kids\.length >= 2 \? kids\[kids\.length - 1\] : null/)
  assert.match(
    effect,
    /const headwordWrapped =\s*first instanceof HTMLElement && last instanceof HTMLElement && hangulOnOwnLine\(first\.offsetTop \+ first\.offsetHeight, last\.offsetTop\)/,
    'offsetTop·offsetHeight 로 읽어 hangulOnOwnLine 에 넘긴다',
  )
  assert.match(effect, /nextDropLevel\(dropLevel, overflowsBody\(body\.getBoundingClientRect\(\)\.bottom, bottoms\), headwordWrapped\)/, '세 번째 인자 연결')
  assert.equal((effect.match(/nextDropLevel\(/g) ?? []).length, 1, '효과 안 nextDropLevel 호출은 한 곳')
  assert.match(effect, /\}, \[measureKey, dropLevel\]\)/, '효과 의존성에 드래그 값이 없다')
  // 회전(카드 래퍼 transform) 중에는 getBoundingClientRect 외접 사각형이 겹쳐 줄바꿈된 한글을 놓친다 — 아래 줄 판정은 변환에 둔감한 offset 만 쓴다.
  assert.ok(!/(?:kids|first|last)\b[^\n;]*getBoundingClientRect/.test(effect), '아래 줄 판정(kids/first/last)에 getBoundingClientRect 를 쓰지 않는다')
  assert.equal((effect.match(/offsetTop/g) ?? []).length, 2, 'offsetTop 은 표제어·한글 두 곳')
  assert.equal((effect.match(/offsetHeight/g) ?? []).length, 1, 'offsetHeight 는 표제어 아랫변 계산 한 곳')
})

test('뒷면 표제어 [한글](task-082 r2): 표제어와 같은 줄에 inline 으로 두고 2단계(최후 수단)에서만 가린다 — 표제어는 max-w-full truncate 유지', () => {
  const src = read('VocabCardFace.tsx')
  const back = src.slice(src.indexOf('const band = card.answer'))
  assert.match(
    back,
    /<div ref=\{headRef\} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">\s*<JaText[\s\S]*?className="block max-w-full truncate text-\[22px\] font-semibold"\s*\/>\s*\{dropLevel >= 2 \? null : <HangulLine state=\{backHangul\} size=\{13\} inline \/>\}\s*<\/div>/,
  )
  const lines = src.split('\n').filter((l) => l.includes('backHangul') && l.includes('<HangulLine'))
  assert.equal(lines.length, 1, '표제어 [한글] 줄은 한 곳')
  assert.ok(lines[0].includes('dropLevel >= 2 ? null'), '표제어 [한글] 은 2단계에서만 뺀다(1단계에서 빼지 않는다)')
  assert.ok(!/dropLevel >= 1 \? null : <HangulLine state=\{backHangul\}/.test(src), '표제어 [한글] 이 1단계에서 빠진다(예문 다음이어야 한다)')
  assert.ok(!/<HangulLine state=\{backHangul\} size=\{13\} \/>/.test(src), '옛 블록(세로) 표제어 [한글] 이 남아 있다')
})

test('뒷면 렌더(task-082): 표제어 줄 래퍼는 flex-wrap 한 줄이고 표제어는 truncate(설정 로드 전 [한글] 줄은 SSR 로 볼 수 없다 — 실화면 몫)', () => {
  const html = renderToStaticMarkup(
    createElement(VocabCardFace, {
      card: { order: 0, wordId: 'w1', surface: '来ました', reading: 'きました', meaning: '왔어요', example: '去年 日本に来ました。', exampleKo: '작년에 일본에 왔어요.', answer: 'WRONG', flagged: false } as DeckCard,
      side: 'back',
      mode: 'CHOICE',
      showReading: true,
      peekable: false,
      ruby: null,
      hangul: OFF,
      backHangul: NONE,
      exampleAnn: NONE,
    }),
  )
  assert.match(html, /<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2"><span lang="ja" class="block max-w-full truncate text-\[22px\] font-semibold">/)
  assert.match(html, /来ました/)
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
