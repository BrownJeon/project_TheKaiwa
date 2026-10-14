/**
 * task-055 Developer B — 교정 모음의 밑바탕 부품(screens.md §21-2·21-3 A·21-9): 분절 `DrawerSwitch`, 문구 `correctionsCopy`,
 * 공용 부품 prop(`ChunkChips variant`(task-068 — 옛 `withNone`)·`WordSearchBar label/placeholder/commitWhileTyping`)과 단어장 두 파일의 분절 한 줄.
 * 공용 부품은 **기본값이면 DOM 이 한 글자도 안 바뀐다** — 착수 시점 렌더 문자열을 그대로 박아 두고 비교한다.
 */
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import ChunkChips from '@/components/vocab/ChunkChips'
import WordSearchBar, { typingCommit } from '@/components/vocab/WordSearchBar'
import { CORRECTIONS_COPY as C, conditionText, kindLabel } from '../correctionsCopy'
import DrawerSwitch, { DRAWER_FOCUS_TTL_MS, markDrawerFocus, takeDrawerFocus } from '../DrawerSwitch'

const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
const noop = () => {}
const root = join(__dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')

// 변경 전(2026-10-11, task-055 착수 시점) 렌더 문자열. task-068 로 단어장 기본값은 「없음」 → 「표현」 칩만 바뀌고,
// 교정 모음(`variant="corrections"`)은 task-055 의 `withNone={false}` 출력(= 이 문자열에서 「없음」 칩만 뺀 것)과 한 글자도 같아야 한다.
const PRE_CHUNK_NULL =
  "<div class=\"-mr-4 flex min-w-0 items-center gap-2\"><span id=\"_R_0_\" class=\"w-[30px] flex-none text-[12px] font-semibold text-ink2\">조각</span><div role=\"radiogroup\" aria-labelledby=\"_R_0_\" class=\"no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4\"><button type=\"button\" role=\"radio\" aria-checked=\"true\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-accent bg-accent font-semibold text-on-accent\">전체<span class=\"sr-only\"> (모든 조각)</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">이름<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">액션<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">느낌<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">꾸밈<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">없음<span class=\"sr-only\"> (조각이 정해지지 않은 단어)</span></button></div></div>"
const PRE_CHUNK_NONE =
  "<div class=\"-mr-4 flex min-w-0 items-center gap-2\"><span id=\"_R_0_\" class=\"w-[30px] flex-none text-[12px] font-semibold text-ink2\">조각</span><div role=\"radiogroup\" aria-labelledby=\"_R_0_\" class=\"no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4\"><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">전체<span class=\"sr-only\"> (모든 조각)</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">이름<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">액션<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">느낌<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">꾸밈<span class=\"sr-only\"> 조각</span></button><button type=\"button\" role=\"radio\" aria-checked=\"true\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-accent bg-accent font-semibold text-on-accent\">없음<span class=\"sr-only\"> (조각이 정해지지 않은 단어)</span></button></div></div>"
const PRE_SEARCH_EMPTY =
  "<div><form role=\"search\" class=\"relative\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\" class=\"pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink2\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-3.5-3.5\"></path></svg><input type=\"search\" enterKeyHint=\"search\" aria-label=\"단어 검색\" placeholder=\"표현·읽기·뜻으로 검색\" class=\"h-11 w-full min-w-0 rounded-xl border bg-surface pl-10 pr-11 text-[16px] text-ink placeholder:text-ink3 [&amp;::-webkit-search-cancel-button]:hidden border-line\" value=\"\"/></form></div>"
const PRE_SEARCH_ERR =
  "<div><form role=\"search\" class=\"relative\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\" class=\"pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink2\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-3.5-3.5\"></path></svg><input type=\"search\" enterKeyHint=\"search\" aria-label=\"단어 검색\" placeholder=\"표현·읽기·뜻으로 검색\" aria-invalid=\"true\" aria-describedby=\"wordSearchErr\" class=\"h-11 w-full min-w-0 rounded-xl border bg-surface pl-10 pr-11 text-[16px] text-ink placeholder:text-ink3 [&amp;::-webkit-search-cancel-button]:hidden border-bad\" value=\"abc\"/><button type=\"button\" aria-label=\"검색어 지우기\" class=\"absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-ink2\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button></form><p id=\"wordSearchErr\" role=\"alert\" class=\"mt-1 text-[12px] text-bad break-keep\">검색어는 40자까지예요</p></div>"

// ── 공용 부품: 기본값 DOM 불변 ─────────────────────────────────────────────────

const NONE_CHIP = /<button type="button" role="radio" aria-checked="(?:false|true)" class="[^"]*">없음<span class="sr-only"> \(조각이 정해지지 않은 단어\)<\/span><\/button>/
const EXPR_CHIP =
  "<button type=\"button\" role=\"radio\" aria-checked=\"false\" class=\"relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[&#x27;&#x27;] border-line bg-surface text-ink\">표현<span class=\"sr-only\"> 조각</span></button>"

test('ChunkChips 기본값(variant 생략·words) = 착수 시점 DOM 에서 「없음」 칩 자리에 「표현」 칩만(task-068 T10)', () => {
  assert.match(PRE_CHUNK_NULL, NONE_CHIP)
  assert.equal(render(createElement(ChunkChips, { value: null, onChange: noop })), PRE_CHUNK_NULL.replace(NONE_CHIP, EXPR_CHIP))
  assert.equal(render(createElement(ChunkChips, { value: null, onChange: noop, variant: 'words' })), PRE_CHUNK_NULL.replace(NONE_CHIP, EXPR_CHIP), '명시 words 도 같다')
  assert.ok(!render(createElement(ChunkChips, { value: null, onChange: noop })).includes('없음'))
  const picked = render(createElement(ChunkChips, { value: 'EXPRESSION', onChange: noop }))
  assert.match(picked, /aria-checked="true" class="[^"]*border-accent[^"]*">표현</)
  assert.match(PRE_CHUNK_NONE, NONE_CHIP, '옛 「없음」 고름 문자열은 기록으로만 남긴다')
})

test('ChunkChips variant="corrections": task-055 withNone={false} 출력과 한 글자도 같다(전체+4종, J12)', () => {
  const html = render(createElement(ChunkChips, { value: null, onChange: noop, variant: 'corrections' }))
  assert.equal(html, PRE_CHUNK_NULL.replace(NONE_CHIP, ''))
  assert.equal((html.match(/role="radio"/g) ?? []).length, 5)
  assert.ok(!html.includes('없음'))
  assert.ok(!html.includes('표현'))
  const picked = render(createElement(ChunkChips, { value: 'ACTION', onChange: noop, variant: 'corrections' }))
  assert.match(picked, /aria-checked="true" class="[^"]*border-accent[^"]*">액션</)
})

test('WordSearchBar 기본값 = 착수 시점 DOM 그대로(「단어 검색」·「표현·읽기·뜻으로 검색」)', () => {
  const base = { onInput: noop, onCommit: noop, onClear: noop }
  assert.equal(render(createElement(WordSearchBar, { ...base, value: '', error: null })), PRE_SEARCH_EMPTY)
  assert.equal(render(createElement(WordSearchBar, { ...base, value: 'abc', error: '검색어는 40자까지예요' })), PRE_SEARCH_ERR)
  assert.equal(render(createElement(WordSearchBar, { ...base, value: '', error: null, commitWhileTyping: true })), PRE_SEARCH_EMPTY)
})

test('WordSearchBar 교정 모음 쓰임새: 이름·안내만 바뀌고 commitWhileTyping=false 는 DOM 을 바꾸지 않는다', () => {
  const base = { onInput: noop, onCommit: noop, onClear: noop }
  const html = render(createElement(WordSearchBar, { ...base, value: '', error: null, label: C.search, placeholder: C.search, commitWhileTyping: false }))
  assert.equal(html, PRE_SEARCH_EMPTY.replace('aria-label="단어 검색" placeholder="표현·읽기·뜻으로 검색"', `aria-label="${C.search}" placeholder="${C.search}"`))
  assert.ok(html.includes('aria-label="문장이나 설명으로 찾기" placeholder="문장이나 설명으로 찾기"'))
})

test('WordSearchBar 입력 중 확정: 기본은 디바운스, false 면 빈 칸일 때만 바로 확정(그 밖은 Enter 까지 안 보냄)', () => {
  assert.equal(typingCommit('ab', true), 'debounce')
  assert.equal(typingCommit('', true), 'debounce', '단어장은 지금처럼 빈 칸도 디바운스')
  assert.equal(typingCommit('ab', false), 'none')
  assert.equal(typingCommit(' ', false), 'none', '공백만은 빈 칸이 아니다(확정 때 trim)')
  assert.equal(typingCommit('', false), 'now')
  const src = read('vocab', 'WordSearchBar.tsx')
  assert.match(src, /const act = typingCommit\(v, commitWhileTyping\)/, 'onChange·조합 끝 모두 schedule → typingCommit 경유')
  assert.match(src, /onCompositionEnd=\{\(e\) => \{\s*composing\.current = false\s*schedule\(e\.currentTarget\.value\)/)
  assert.match(src, /if \(!composing\.current\) schedule\(e\.target\.value\)/)
})

test('WordSearchBar 기본 동작 = 입력 중 300ms 디바운스(REV-184 R1) — 컴포넌트 기본값이 typingCommit 에 그대로 들어가고, 단어장은 기본값을 쓴다', () => {
  const src = read('vocab', 'WordSearchBar.tsx')
  const decl = src.match(/\bcommitWhileTyping = (true|false),/)
  assert.ok(decl, '기본값 선언이 있어야 한다')
  assert.equal(decl[1], 'true', '기본값이 false 면 단어장 검색이 입력 중 조회를 멈추고 Enter 로만 동작한다(DOM 은 같아 렌더 시험이 못 잡음)')
  const dflt = decl[1] === 'true'
  assert.equal(typingCommit('駅', dflt), 'debounce')
  assert.equal(typingCommit('', dflt), 'debounce', '기본값에서는 빈 칸도 디바운스(변경 전 단어장 그대로)')
  assert.match(src, /const DEBOUNCE_MS = 300\n/)
  assert.match(src, /else if \(act === 'debounce'\) timer\.current = setTimeout\(\(\) => onCommit\(v\), DEBOUNCE_MS\)/)
  for (const f of ['WordsScreen.tsx', 'WordsSkeleton.tsx']) assert.ok(!/commitWhileTyping/.test(read('vocab', f)), `${f} 는 기본값을 쓴다`)
})

// ── 분절 DrawerSwitch ──────────────────────────────────────────────────────────

afterEach(() => {
  takeDrawerFocus('words', 0)
  takeDrawerFocus('corrections', 0)
})

test('DrawerSwitch: nav「단어장 보기」 + 링크 둘, 현재 항목만 aria-current="page" · Segmented md 와 같은 칸 클래스', () => {
  const words = render(createElement(DrawerSwitch, { current: 'words' }))
  assert.match(words, /^<nav aria-label="단어장 보기" class="mb-2\.5 flex gap-\[3px\] rounded-xl bg-surface2 p-\[3px\]">/)
  assert.equal((words.match(/<a /g) ?? []).length, 2)
  assert.match(words, /<a aria-current="page" class="[^"]*bg-surface font-semibold text-ink shadow-sm" href="\/drawer\/words"><span class="block truncate">단어<\/span><\/a>/)
  assert.match(words, /<a class="[^"]*font-medium text-ink2" href="\/drawer\/corrections"><span class="block truncate">채택한 교정<\/span><\/a>/)
  assert.ok(!words.includes('inert'))
  const corr = render(createElement(DrawerSwitch, { current: 'corrections' }))
  assert.match(corr, /<a aria-current="page" class="[^"]*" href="\/drawer\/corrections">/)
  assert.match(corr, /<a class="[^"]*" href="\/drawer\/words">/)
  for (const cls of ['relative', 'grid', 'h-9', 'min-w-0', 'flex-1', 'place-items-center', 'rounded-[9px]', 'px-1', 'text-[13.5px]', 'before:inset-x-0', 'before:h-11']) {
    assert.ok(words.includes(cls), cls)
  }
  assert.ok(!/<a [^>]*class="[^"]*truncate/.test(words), 'truncate 는 링크가 아니라 안쪽 span 에(::before 히트영역 보존)')
})

test('DrawerSwitch placeholder: 같은 마크업에 inert 만 더한다(자리표시와 화면 높이 같음)', () => {
  const real = render(createElement(DrawerSwitch, { current: 'words' }))
  const ph = render(createElement(DrawerSwitch, { current: 'words', placeholder: true }))
  assert.equal(ph, real.replace('<nav aria-label="단어장 보기"', '<nav aria-label="단어장 보기" inert=""'))
})

test('DrawerSwitch 초점 기록: 누른 대상의 새 분절이 한 번만 받는다 · 다른 대상·오래된 기록은 받지 않는다', () => {
  const t = 1_000_000
  assert.equal(takeDrawerFocus('corrections', t), false, '기록 없음')
  markDrawerFocus('corrections', t)
  assert.equal(takeDrawerFocus('words', t + 10), false, '다른 분절은 받지 않고 기록도 남긴다')
  assert.equal(takeDrawerFocus('corrections', t + 20), true)
  assert.equal(takeDrawerFocus('corrections', t + 30), false, '한 번만')
  markDrawerFocus('words', t)
  assert.equal(takeDrawerFocus('words', t + DRAWER_FOCUS_TTL_MS + 1), false, '취소된 이동의 오래된 기록은 버린다')
  assert.equal(takeDrawerFocus('words', t + 5), false, '버린 뒤에는 없음')
})

test('DrawerSwitch 배선: Link replace · 현재 항목 누름은 preventDefault · placeholder 는 초점 효과·기록 없음 · 화면 모듈 import 없음', () => {
  const src = read('drawer', 'DrawerSwitch.tsx')
  assert.match(src, /<Link\s+key=\{it\.view\}\s+href=\{it\.href\}\s+replace\s/)
  assert.match(src, /if \(on\) \{\s*e\.preventDefault\(\)\s*return\s*\}\s*markDrawerFocus\(it\.view\)/)
  assert.match(src, /if \(placeholder\) return\s*if \(takeDrawerFocus\(current\)\) currentRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(src, /onClick=\{\s*placeholder\s*\?\s*undefined/)
  const imports = src.match(/^import .*$/gm) ?? []
  assert.deepEqual(imports, ["import Link from 'next/link'", "import { useEffect, useRef } from 'react'", "import { CORRECTIONS_COPY } from './correctionsCopy'"])
})

test('단어장 두 파일에 분절 한 줄 — 화면은 진짜, 자리표시는 placeholder(같은 자리: 검색 바로 위)', () => {
  const screen = read('vocab', 'WordsScreen.tsx')
  const skel = read('vocab', 'WordsSkeleton.tsx')
  assert.match(screen, /<div className="px-4 pb-8">\s*<DrawerSwitch current="words" \/>\s*<WordSearchBar/)
  assert.match(skel, /<div className="px-4 pb-8">\s*<DrawerSwitch current="words" placeholder \/>\s*<div inert>\s*<WordSearchBar/)
  assert.equal((screen.match(/<DrawerSwitch/g) ?? []).length, 1)
  assert.equal((skel.match(/<DrawerSwitch/g) ?? []).length, 1)
})

// ── 문구(§21-9 — 데모 v1 원문) ───────────────────────────────────────────────

test('문구: 데모 v1 원문 그대로', () => {
  assert.deepEqual(
    [C.switchNav, C.switchWords, C.switchCorrections, C.docTitle, C.search, C.searchTooLong, C.typeLabel, C.typeAllSr, C.typeCountSr, C.listLabel],
    ['단어장 보기', '단어', '채택한 교정', '채택한 교정 · 단어장', '문장이나 설명으로 찾기', '검색어는 40자까지예요', '유형', ' (모든 유형)', '개', '채택한 교정 목록'],
  )
  assert.equal(C.head(2), '채택한 교정 2개')
  assert.equal(C.head(1234), '채택한 교정 1,234개')
  assert.equal(C.headSearch('に', 3), '‘に’ 검색 결과 3개')
  assert.equal(`${C.quoteOpen}に${C.quoteClose}${C.headSearchTail(3)}`, C.headSearch('に', 3), '조각을 이으면 전체 문구')
  assert.equal(`${C.head(2)}${C.condSep}${conditionText('CONJUGATION', 'ACTION')}`, '채택한 교정 2개 · 활용 · 액션 조각')
  assert.deepEqual([C.acceptedOnSr, C.mineSr, C.fixSr, C.major], ['채택한 날 ', '내 문장: ', '고친 문장: ', '중요'])
  assert.deepEqual([kindLabel('TALK'), kindLabel('CHAT'), kindLabel('ASK')], ['회화', '채팅', '채팅'])
  assert.equal(C.goChat, '원래 대화 보기 ›')
  assert.equal(C.goChatAria('회화', '카페에서'), '회화 ‘카페에서’에서 이 교정 보기')
  assert.equal(C.goWord('駅'), '단어 駅 보기 ›')
  assert.equal(`${C.goWordLead} 駅 ${C.goWordTail}`, C.goWord('駅'))
  assert.deepEqual([C.more, C.moreBusy, C.moreError], ['교정 더 보기', '불러오는 중…', '교정을 더 불러오지 못했어요. 다시 눌러 주세요.'])
  assert.equal(C.end(21), '채택한 교정을 모두 봤어요 · 21개')
  assert.deepEqual([C.loadErrorNetwork, C.loadError, C.retry], ['교정을 불러오지 못했어요. 네트워크를 확인해 주세요.', '교정을 불러오지 못했어요.', '다시 시도'])
  assert.equal(C.emptyFirstTitle, '아직 채택한 교정이 없어요')
  assert.equal(
    C.emptyFirstBody.join(''),
    '회화나 채팅에서 선생님이 고쳐 준 문장 아래 [채택]을 누르면 여기에 모여요. 모아 둔 문장은 언제든 다시 읽고, 원래 대화로 돌아가 볼 수 있어요.',
  )
  assert.equal(C.emptyFirstBody[1], '[채택]', '굵게 그리는 조각')
  const pic = C.emptyFirstPic
  assert.deepEqual(
    [pic.mine, `${pic.head}${pic.removed}${pic.tail}`, pic.fix, `${pic.head}${pic.added}${pic.tail}`, pic.accept, pic.reject],
    ['내 문장', '駅に降りて…', '이렇게 고쳐요', '駅で降りて…', '채택', '무시'],
  )
  assert.deepEqual([C.goTalk, C.goChatList], ['회화하러 가기', '채팅하러 가기'])
  assert.equal(`${C.emptyFilterTitle}|${conditionText('PARTICLE', null)}${C.emptyFilterBodyTail}|${C.clearFilter}`, '조건에 맞는 교정이 없어요|조사 — 다른 조건을 골라 보세요.|조건 풀기')
  assert.equal(C.emptySearchTitle('존댓말'), '‘존댓말’와 맞는 교정이 없어요')
  assert.equal(`${C.quoteOpen}존댓말${C.quoteClose}${C.emptySearchTitleTail}`, C.emptySearchTitle('존댓말'))
  assert.equal(`${C.emptySearchBody}${C.emptySearchWithCond}`, '내 문장·고친 문장·설명에서 찾았어요. 유형·조각 조건도 함께 걸려 있어요.')
  assert.equal(C.clearSearch, '검색 지우기')
  assert.equal(C.wordRemoved, '삭제했어요 · 지난 기록은 그대로 남아요')
})

test('조건 글자: 유형·조각 라벨을 「 · 」로, 없으면 null', () => {
  assert.equal(conditionText(null, null), null)
  assert.equal(conditionText(undefined, undefined), null)
  assert.equal(conditionText('POLITENESS', null), '존댓말')
  assert.equal(conditionText(null, 'NAME'), '이름 조각')
  assert.equal(conditionText('WORD_ORDER', 'MODIFIER'), '어순 · 꾸밈 조각')
})

test('문구·분절에 엔진·모델 이름 없음', () => {
  const all = read('drawer', 'correctionsCopy.ts') + read('drawer', 'DrawerSwitch.tsx')
  assert.ok(!/claude|haiku|sonnet|opus|qwen|whisper|reazon|style-?bert|sbv2|ollama|home-m4|gpt|llm/i.test(all))
})
