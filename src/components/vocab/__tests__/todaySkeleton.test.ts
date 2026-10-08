import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { cardHeightVars, TODAY_CARD_CHROME, TODAY_CARD_CHROME_H, TODAY_CARD_GAP, TODAY_CARD_H } from '../todaySkeletonSizes'
import TodaySkeleton, { CardLoadingBody, TodayCardsSkeleton } from '../TodaySkeleton'

// task-046(IMP-0027, T3): 자리표시 높이는 클래스 합산이 아니라 실측 상수다 — 상수와 그리는 곳을 묶어 한쪽만 바뀌지 않게 한다.
const root = join(__dirname, '..', '..')
const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const read = (...p: string[]) => strip(readFileSync(join(root, ...p), 'utf8'))
const readRaw = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')
const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
const skeleton = read('vocab', 'TodaySkeleton.tsx')

test('카드 높이 실측 상수 — 단어 305/285.5(370px 미만/이상), 회화 253.6, 평가 217.1/199.1(362px 미만/이상)', () => {
  assert.deepEqual(TODAY_CARD_H.word, { narrow: 305, wide: 285.5, narrowBelow: 370 })
  assert.deepEqual(TODAY_CARD_H.lesson, { narrow: 253.6, wide: 253.6, narrowBelow: 0 })
  assert.deepEqual(TODAY_CARD_H.eval, { narrow: 217.1, wide: 199.1, narrowBelow: 362 })
  assert.equal(TODAY_CARD_GAP, 18)
})

test('폭 경계는 클래스에 그대로 있다(min-[370px]·min-[362px]) · 회화는 폭과 무관', () => {
  assert.match(skeleton, new RegExp(`word: 'h-\\[var\\(--h-n\\)\\] min-\\[${TODAY_CARD_H.word.narrowBelow}px\\]:h-\\[var\\(--h-w\\)\\]'`))
  assert.match(skeleton, new RegExp(`eval: 'h-\\[var\\(--h-n\\)\\] min-\\[${TODAY_CARD_H.eval.narrowBelow}px\\]:h-\\[var\\(--h-w\\)\\]'`))
  assert.match(skeleton, /lesson: 'h-\[var\(--h-w\)\]'/)
})

test('높이 변수: 카드 전체 / 몸통(= 카드 − 테두리·여백·머리줄·간격 60.5)', () => {
  assert.equal(TODAY_CARD_CHROME_H, 60.5)
  assert.deepEqual(cardHeightVars('word'), { '--h-n': '305px', '--h-w': '285.5px' })
  assert.deepEqual(cardHeightVars('word', true), { '--h-n': '244.5px', '--h-w': '225px' })
  assert.deepEqual(cardHeightVars('lesson', true), { '--h-n': '193.1px', '--h-w': '193.1px' })
  assert.deepEqual(cardHeightVars('eval', true), { '--h-n': '156.6px', '--h-w': '138.6px' })
})

test('카드 틀 상수 = 실제 Card 클래스(테두리 1+1·p-3.5=14+14)와 머리줄 15px·mt-2', () => {
  assert.deepEqual(TODAY_CARD_CHROME, { border: 2, padding: 28, head: 22.5, gap: 8 })
  assert.match(read('common', 'ui.tsx'), /min-w-0 rounded-\[14px\] border p-3\.5/)
  assert.match(skeleton, /min-w-0 flex-col rounded-\[14px\] border border-line bg-surface p-3\.5/, '자리표시 카드 틀 = Card 와 같은 클래스')
  assert.match(skeleton, /<h2 className="text-\[15px\] font-semibold">/)
  assert.match(skeleton, /mt-2 block/, '몸통 위 간격 mt-2')
})

test('세 카드 자리표시 렌더 — 실제 제목 · 회색 블록 · 버튼·링크·「불러오는 중」·깜빡임 없음 · 해요체 알림 한 줄', () => {
  const html = render(createElement(TodayCardsSkeleton))
  for (const t of ['오늘의 단어', '오늘의 회화', 'AI 평가']) assert.match(html, new RegExp(`<h2[^>]*>${t}</h2>`))
  assert.equal((html.match(/<section/g) ?? []).length, 3)
  assert.ok(!/<button|<a |불러오는 중|animate-pulse|기본 단어|시작하기|만들기/.test(html), html)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status" class="sr-only">불러오고 있어요</)
  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /--h-n:305px/)
  assert.match(html, /--h-w:285\.5px/)
  assert.match(html, /--h-w:253\.6px/)
  assert.match(html, /--h-n:217\.1px/)
  // 첫 카드만 위 간격이 없고(실제 단어 카드와 같다) 나머지는 18px
  assert.equal((html.match(/mt-\[18px\]/g) ?? []).length, 2)
})

test('서버 loading 화면 = 앱바 제목(실제 부품) + px-4 pb-8 본문 + 같은 자리표시', () => {
  const html = render(createElement(TodaySkeleton))
  assert.match(html, /<h1[^>]*>오늘의 공부<\/h1>/)
  assert.match(html, /<div class="px-4 pb-8">/)
  assert.equal((html.match(/<section/g) ?? []).length, 3)
})

test('카드 안 몸통 자리표시(상한이 지났거나 다시 읽는 중) — 회색 블록 + 알림만, 글자·버튼 없음', () => {
  for (const kind of ['word', 'lesson', 'eval'] as const) {
    const html = render(createElement(CardLoadingBody, { kind }))
    assert.match(html, /role="status" class="sr-only">불러오고 있어요</)
    assert.match(html, /aria-hidden="true"/)
    assert.ok(!/<button|<a |불러오는 중/.test(html))
  }
})

test('네 카드의 로딩 구간은 「불러오는 중…」 글자 대신 몸통 자리표시를 쓴다', () => {
  for (const [dir, file, kind] of [
    ['vocab', 'TodayWordsCard.tsx', 'word'],
    ['vocab', 'TopicWordsCard.tsx', 'word'],
    ['lesson', 'TodayLessonCard.tsx', 'lesson'],
    ['eval', 'EvalHomeCard.tsx', 'eval'],
  ] as const) {
    const src = read(dir, file)
    assert.match(src, new RegExp(`<CardLoadingBody kind="${kind}" />`), file)
    assert.ok(!/불러오는 중…/.test(src), `${file} 에 「불러오는 중…」 남음`)
    assert.ok(!/HOME\.loading/.test(src), `${file} 이 HOME.loading 을 그림`)
  }
  assert.equal((read('lesson', 'TodayLessonCard.tsx').match(/<CardLoadingBody kind="lesson" \/>/g) ?? []).length, 2, '지금 카드 + 챌린지 모드 두 곳')
})

test('TodayHome: 한 번에 보이기 — 자리표시를 겹쳐 두고 진짜 카드는 invisible+inert 로 제자리 마운트(요청 수·시점 그대로)', () => {
  const src = read('vocab', 'TodayHome.tsx')
  assert.match(src, /todayRevealed\(\{ home: loadState !== 'loading', lessons: lessonToday\.state !== 'loading', challenge: challenge\.state !== 'loading', evaluation: evalSettled \}, holdOver\)/)
  assert.match(src, /setTimeout\(\(\) => setHoldOver\(true\), TODAY_HOLD_MS\)/)
  assert.match(src, /className="relative px-4 pb-8"/)
  assert.match(src, /<div className="absolute inset-x-4 top-0">\s*<TodayCardsSkeleton \/>/)
  assert.match(src, /className=\{shown \? undefined : 'invisible'\} aria-hidden=\{shown \? undefined : true\} inert=\{!shown\}/)
  assert.match(src, /onSettled=\{onEvalSettled\}/)
  assert.ok(!/display:\s*none|(?<![-\w])hidden=|h-0 overflow-hidden/.test(src), 'display:none·높이 0 으로 숨기지 않는다(scrollIntoView 가 화면 밖 좌표를 읽는다)')
  // 한 번 보인 뒤에는 되돌리지 않는다: setShown(true) 만 있고 setShown(false) 는 없다
  assert.ok(!/setShown\(false\)/.test(src))
  // 요청 목록·시점 불변: 마운트 효과가 읽는 경로(홈 4곳 + #58)가 그대로이고 prefetch 를 건드리지 않는다
  for (const path of ['/api/v1/words/categories', '/api/v1/vocab/sessions?limit=10', '/api/v1/vocab/sessions?kept=1&limit=5', '/api/v1/vocab/stats?days=30', '/api/v1/lessons/today']) assert.ok(src.includes(path), path)
  assert.ok(!/prefetch/.test(src))
})

test('평가 카드: 첫 읽기가 끝나면(성공·실패) onSettled 를 부른다', () => {
  const src = read('eval', 'EvalHomeCard.tsx')
  assert.match(src, /if \(data\.state !== 'loading'\) onSettled\?\.\(\)/)
})

test('loading.tsx 적용 범위 — 오늘 탭 홈에만 닿는다((tab) 그룹), 오늘의 단어·회화·평가 하위 경로엔 닿지 않는다', () => {
  const app = join(root, '..', 'app', '(app)')
  const exists = (...p: string[]) => {
    try {
      readFileSync(join(app, ...p))
      return true
    } catch {
      return false
    }
  }
  assert.ok(exists('study', 'today', '(tab)', 'loading.tsx'))
  assert.ok(exists('study', 'today', '(tab)', 'page.tsx'))
  assert.ok(!exists('study', 'today', 'loading.tsx'), 'study/today 바로 아래 loading.tsx 는 words·talk·eval 진입에도 뜬다')
  assert.ok(!exists('study', 'today', 'page.tsx'), '그룹으로 옮긴 page 가 두 곳에 남지 않는다')
  const loading = readFileSync(join(app, 'study', 'today', '(tab)', 'loading.tsx'), 'utf8')
  assert.match(loading, /TodaySkeleton/)
  assert.ok(!/apiGet|fetch\(/.test(loading))
  // 하위 경로 폴더는 그대로 study/today 바로 아래에 있다
  for (const sub of ['words', 'talk', 'eval']) assert.ok(!exists('study', 'today', '(tab)', sub, 'page.tsx'))
})

test('화면 문구 — 엔진명·모델명·「AI」 새로 만들지 않음(제목 「AI 평가」는 기존 문구), 해요체', () => {
  const copy = readRaw('vocab', 'TodaySkeleton.tsx')
  assert.ok(!/claude|sonnet|haiku|opus|reazon|whisper|style-bert/i.test(copy))
})

// REV-171 L-2: 오늘 탭은 공개 전에 알림이 자리표시 한 곳뿐이다 — 진짜 카드(각자 몸통 알림을 가진다)는 aria-hidden+inert 아래라 읽히지 않는다.
test('세 카드 자리표시: role=status 는 한 곳 · busy 래퍼 밖(앞) 형제', () => {
  const html = render(createElement(TodayCardsSkeleton))
  assert.equal((html.match(/role="status"/g) ?? []).length, 1)
  assert.ok(html.indexOf('role="status"') < html.indexOf('aria-busy="true"'))
  const page = render(createElement(TodaySkeleton))
  assert.equal((page.match(/role="status"/g) ?? []).length, 1, '서버 loading 화면 전체에서도 한 곳')
})

test('TodayHome: 공개 전에는 진짜 카드 묶음이 aria-hidden+inert — 카드 안 몸통 알림은 공개된 뒤에만 읽힌다', () => {
  const src = read('vocab', 'TodayHome.tsx')
  assert.match(src, /aria-hidden=\{shown \? undefined : true\} inert=\{!shown\}/)
})
