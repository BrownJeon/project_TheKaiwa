/**
 * task-055 Developer C — 요약 카드(`DrawerCorrectionCard`, screens.md §21-3 C)·유형 칩(`ErrorTypeChips`, §21-3 D)의 렌더 문자열 시험.
 * 서버 렌더는 표시 설정이 아직 없는 상태(히라가나·한글 끔과 같은 모양)라 루비·한글 줄이 없다 — 켬 모양은 브라우저 QA 몫이다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { DrawerCorrectionItem } from '@/types/chat'
import DrawerCorrectionCard, { acceptedDay, ADDED, LINK_BTN, REMOVED } from '../DrawerCorrectionCard'
import ErrorTypeChips, { TYPE_CHIP } from '../ErrorTypeChips'

const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
const noop = () => {}
const root = join(__dirname, '..', '..')
const raw = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')
const read = (...p: string[]) => raw(...p).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
const textOf = (html: string) => unescape(html.replace(/<[^>]+>/g, ''))

const base: DrawerCorrectionItem = {
  id: 'c1',
  original: '駅に降りて、バスに乗りました',
  corrected: '駅で降りて、バスに乗りました',
  explanation: '내리는 장소는 で 로 나타내요.',
  extraNoteKo: null,
  errorType: 'PARTICLE',
  severity: 'MINOR',
  chunkType: 'ACTION',
  chat: { id: 'ch1', title: '카페에서', kind: 'TALK' },
  resolvedAt: '2026-10-10T03:00:00.000Z',
}
const card = (item: Partial<DrawerCorrectionItem> = {}, open = false) =>
  render(createElement(DrawerCorrectionCard, { item: { ...base, ...item }, open, onToggle: noop, onLeave: noop, onOpenWord: noop }))
/** 요약 버튼 안쪽 — 펼침 영역(버튼 밖)과 나눠 본다. */
const summaryOf = (html: string) => html.slice(html.indexOf('<button'), html.indexOf('</button>') + '</button>'.length)

// ── 강조·칩 문자열은 기존 부품과 같은 값(§21-10 ⑦) ───────────────────────────────

test('지운·넣은 글자 강조는 chat/CorrectionCard 소스의 REMOVED·ADDED 와 같은 문자열', () => {
  const src = raw('chat', 'CorrectionCard.tsx')
  const removed = /const REMOVED = '([^']+)'/.exec(src)?.[1]
  const added = /const ADDED = '([^']+)'/.exec(src)?.[1]
  assert.ok(removed && added, 'CorrectionCard 에 REMOVED·ADDED 상수가 있다')
  assert.equal(REMOVED, removed)
  assert.equal(ADDED, added)
})

test('유형 칩 클래스는 vocab/ChunkChips 의 CHIP 과 같은 문자열(보이는 36 · 세로 44 히트)', () => {
  const src = raw('vocab', 'ChunkChips.tsx')
  const chip = /const CHIP =\s*"([^"]+)"/.exec(src)?.[1]
  assert.ok(chip)
  assert.equal(TYPE_CHIP, chip)
  assert.match(TYPE_CHIP, /\bh-9\b/)
  assert.match(TYPE_CHIP, /before:h-11/)
})

test('이동 버튼은 44px(min-h-11)·줄어들 수 있게 min-w-0', () => {
  assert.match(LINK_BTN, /\bmin-h-11\b/)
  assert.match(LINK_BTN, /\bmin-w-0\b/)
})

// ── 원문 그대로(§21-11 ②, A17) ─────────────────────────────────────────────────

test('✕ 내 문장은 저장 글자 그대로 — 앞뒤 공백·연속 공백·줄바꿈을 지우지 않는다(강조로 span 만 나눔)', () => {
  const original = '  駅に  降りて\n バスに乗った  '
  const html = card({ original, corrected: '駅で降りて、バスに乗った' })
  const start = html.indexOf('<span class="sr-only">내 문장: </span>') + '<span class="sr-only">내 문장: </span>'.length
  const end = html.indexOf('</span></span></span><span class="mt-2 grid', start)
  assert.ok(start > 0 && end > start)
  assert.equal(textOf(html.slice(start, end)), original)
  assert.match(html, /whitespace-pre-wrap text-\[16px\]/)
})

test('고친 문장도 그대로, 바뀐 글자에 강조 클래스(지운 に → REMOVED, 넣은 で → ADDED)', () => {
  const html = card()
  assert.ok(html.includes(`<span class="${REMOVED}">`), '지운 글자 강조')
  assert.ok(html.includes(`<span class="${ADDED}">`), '넣은 글자 강조')
  const s = html.indexOf('<span class="sr-only">고친 문장: </span>') + '<span class="sr-only">고친 문장: </span>'.length
  const e = html.indexOf('</span></span></span>', s)
  assert.equal(textOf(html.slice(s, e)), base.corrected)
})

test('200 코드포인트를 넘으면 강조 없이 원문 그대로', () => {
  const long = '駅'.repeat(201)
  const html = card({ original: long, corrected: `${long}で` })
  assert.ok(!html.includes(REMOVED) && !html.includes(ADDED))
  assert.ok(html.includes(long))
})

// ── 요약 버튼 구조(§21-11 ⑧·⑪) ─────────────────────────────────────────────────

test('요약 버튼 안에는 p·div·a·button 이 없다(블록 span 만), 일본어 줄은 lang=ja span', () => {
  const sum = summaryOf(card({ savedWord: { id: 'w1', surface: '降りる' }, extraNoteKo: '〜で(N5): 장소' }, true))
  assert.ok(!/<(p|div|a|ul|li)[\s>]/.test(sum), sum)
  assert.equal((sum.match(/<button/g) ?? []).length, 1, '버튼 안에 버튼 없음')
  assert.equal((sum.match(/<span lang="ja" class="block whitespace-pre-wrap/g) ?? []).length, 2)
})

test('한글 줄은 HangulLine(as span)만 — 표시 설정 전(서버)·끔에서는 그리지 않는다(손으로 만든 한글 span 없음)', () => {
  const src = read('drawer', 'DrawerCorrectionCard.tsx')
  assert.equal((src.match(/<HangulLine as="span" state=\{ann(Original|Corrected)\} \/>/g) ?? []).length, 2)
  assert.ok(!/lang="ko"|hangulLine\(|text-ink3/.test(src), '한글 줄을 직접 만들지 않는다')
  const html = card()
  assert.ok(!html.includes('lang="ko"'), '설정 전 렌더에 한글 줄 없음')
  assert.ok(!html.includes('<ruby'), '설정 전 렌더에 루비 없음')
})

test('접힘: aria-expanded=false · 펼침 영역 hidden · 설명 2줄 말줄임 · ▾', () => {
  const html = card()
  assert.match(html, /<button type="button" id="dcr_c1_btn" aria-expanded="false" aria-controls="dcr_c1_x"/)
  assert.match(html, /<div id="dcr_c1_x" hidden="" class="mt-0\.5">/)
  assert.match(html, /line-clamp-2/)
  assert.ok(summaryOf(html).includes('▾'))
})

test('펼침: aria-expanded=true · 영역 보임 · 설명 전체 · ▴', () => {
  const html = card({}, true)
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /<div id="dcr_c1_x" class="mt-0\.5">/)
  assert.ok(!html.includes('line-clamp-2'))
  assert.ok(summaryOf(html).includes('▴'))
})

test('머리: 유형 뱃지·조각 이름·채택한 날(KST)·중요 뱃지(MAJOR 만)', () => {
  const html = card()
  assert.ok(html.includes('>조사</span>'))
  assert.ok(html.includes('>액션 조각</span>'))
  assert.ok(html.includes('<span class="sr-only">채택한 날 </span>10월 10일'))
  assert.ok(!html.includes('>중요<'))
  assert.ok(card({ severity: 'MAJOR' }).includes('>중요</span>'))
  assert.ok(!card({ chunkType: null }).includes('조각</span>'))
  assert.equal(acceptedDay('2026-10-10T16:00:00.000Z'), '10월 11일', 'UTC 16시 = KST 다음 날')
  assert.equal(acceptedDay(''), '')
  assert.equal(acceptedDay('not-a-date'), '')
})

test('출처 줄 「회화/채팅 · 제목」, 상태 뱃지·[채택][무시]·「채택했어요」 없음', () => {
  const talk = card()
  assert.ok(talk.includes('<b class="font-semibold text-ink">회화</b> · 카페에서'))
  const chat = card({ chat: { id: 'ch2', title: '주말 이야기', kind: 'CHAT' } })
  assert.ok(chat.includes('<b class="font-semibold text-ink">채팅</b> · 주말 이야기'))
  for (const html of [talk, chat]) {
    assert.ok(!/채택함|채택했어요|>채택<|>무시</.test(html))
  }
})

// ── 이동 버튼(§21-6 A) ────────────────────────────────────────────────────────

test('[원래 대화 보기 ›]: 회화 → 회화방 #cr_, 채팅 → 표현 점검 #cr_, 링크 이름 「{종류} ‘{제목}’에서 이 교정 보기」', () => {
  const talk = card({}, true)
  assert.match(talk, /<a id="dcr_c1_go" aria-label="회화 ‘카페에서’에서 이 교정 보기" class="[^"]*min-h-11[^"]*" href="\/study\/ai\/talk\/ch1#cr_c1">원래 대화 보기 ›<\/a>/)
  const chat = card({ chat: { id: 'a/b', title: 'T', kind: 'CHAT' } }, true)
  assert.ok(chat.includes('href="/study/ai/chat/a%2Fb/review#cr_c1"'), 'id 는 인코딩')
})

test('ASK(계약상 교정 없음)면 링크 없음, 넣은 단어도 없으면 버튼 줄 자체가 없다', () => {
  const html = card({ chat: { id: 'q1', title: '질문', kind: 'ASK' } }, true)
  assert.ok(!html.includes('<a '))
  assert.ok(!html.includes('flex flex-wrap gap-2'))
})

test('[단어 ○○ 보기 ›]: 넣은 단어가 있을 때만, 표현은 lang=ja·truncate', () => {
  const none = card({}, true)
  assert.ok(!none.includes('보기 ›</button>'))
  const html = card({ savedWord: { id: 'w1', surface: '降りる' } }, true)
  assert.ok(html.includes('<button type="button" class="' + LINK_BTN + '">단어<span lang="ja" class="mx-1 min-w-0 truncate">降りる</span>보기 ›</button>'))
})

test('시험 문법 줄은 값이 있을 때만, 요약 버튼 밖(펼침 영역 안)', () => {
  assert.ok(!card({}, true).includes('시험 문법'))
  const html = card({ extraNoteKo: '〜で(N5): 동작의 장소' }, true)
  const at = html.indexOf('시험 문법 더 보기')
  assert.ok(at > html.indexOf('</button>'), '요약 버튼 뒤')
  assert.ok(at > html.indexOf('id="dcr_c1_x"'), '펼침 영역 안')
  assert.match(html, /aria-describedby="dcr_c1_head"/)
})

test('카드 바깥 모양: 테두리 line · 모서리 14 · 안쪽 14 · scroll-mt-16, id=dcr_', () => {
  assert.match(card(), /^<li id="dcr_c1" class="min-w-0 scroll-mt-16 rounded-\[14px\] border border-line bg-surface p-3\.5">/)
})

// ── 유형 칩 ───────────────────────────────────────────────────────────────────

const facets = { errorType: [{ value: 'PARTICLE' as const, count: 3 }, { value: 'CONJUGATION' as const, count: 1 }] }
const chips = (value: Parameters<typeof ErrorTypeChips>[0]['value'], f: Parameters<typeof ErrorTypeChips>[0]['facets'] = facets) =>
  render(createElement(ErrorTypeChips, { facets: f, value, onChange: noop }))

test('유형 칩: 「전체 {합}」 + 서버 순서, radiogroup·radio·aria-checked, sr 「 (모든 유형)」/「개」', () => {
  const html = chips(null)
  assert.match(html, /role="radiogroup" aria-labelledby="[^"]+"/)
  assert.match(html, />유형<\/span>/)
  const names = [...html.matchAll(/aria-checked="(true|false)"[^>]*>([^<]+)<span class="ml-1 font-normal tabular-nums">(\d+)<\/span><span class="sr-only">([^<]+)<\/span>/g)].map(
    (m) => `${m[2]}:${m[3]}:${m[4]}:${m[1]}`,
  )
  assert.deepEqual(names, ['전체:4: (모든 유형):true', '조사:3:개:false', '활용:1:개:false'])
})

test('유형 칩: 고른 유형이 0이 되면 그 칩만 0 으로 끝에 남고 켜져 있다', () => {
  const html = chips('POLITENESS')
  assert.match(html, /aria-checked="true"[^>]*>존댓말<span class="ml-1 font-normal tabular-nums">0<\/span>/)
  assert.ok(html.lastIndexOf('존댓말') > html.lastIndexOf('활용'))
})

test('유형 칩: facets 가 비면 「전체 0」 하나만', () => {
  const html = chips(null, { errorType: [] })
  assert.equal((html.match(/role="radio"/g) ?? []).length, 1)
  assert.match(html, />전체<span class="ml-1 font-normal tabular-nums">0<\/span>/)
})
