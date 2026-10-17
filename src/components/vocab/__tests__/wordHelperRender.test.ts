/**
 * task-072 — 단어 추가 일본어 도우미 부품을 정적 렌더해 본다(screens §30-14 ②, 서버 렌더 — 효과는 돌지 않는다. jsdom 없음).
 *  - `WordMicField` 슬롯: `trailing`·`afterLabel` 이 없으면 슬롯 도입 **전** 마크업과 바이트 동일(골든) · 있으면 라벨 줄 = 라벨 · [토글 · 가あ] · 안내는 라벨 줄 바로 다음.
 *  - 패널: 상태 표(30-6)의 phase 별 · `<form` 없음 · 모든 버튼 `type="button"` · 스크롤 상자·키보드 숨김 없음 · 안내 줄·낭독 줄은 늘 마운트.
 *  - 카드·안내 줄: 모양 값, 꼬리표·「왜」 줄은 넣어도 그리지 않음.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createElement, createRef, type ComponentProps, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HELPER_PANEL_ID } from '@/components/talk/PhraseHelperButton'
import type { WordPhraseHelpItem } from '@/types/phraseHelp'
import type { WordHelper } from '../useWordPhraseHelper'
import { MIC_NOTICES_INIT, type WordMic } from '../wordMic'
import WordHelperCard from '../WordHelperCard'
import WordHelperTip from '../WordHelperTip'
import WordMicField from '../WordMicField'
import WordPhraseHelper from '../WordPhraseHelper'
import { WORD_HELPER } from '../wordHelperCopy'
import { wordHelperMsgOf, type WordHelperPhase, type WordHint } from '../wordHelperLogic'

const render = (el: ReactElement) => renderToStaticMarkup(el)
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const noop = () => {}
const count = (html: string, s: string) => html.split(s).length - 1

const GOLDEN = {
  closed: "<div class=\"flex min-w-0 items-center justify-between gap-2\"><label for=\"x_surface\">표현</label><button type=\"button\" aria-label=\"표현 말로 쓰기\" class=\"inline-flex h-11 flex-none items-center gap-1 text-[13px] font-medium text-ink underline underline-offset-4 \"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"></rect><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\"></path></svg>말로 쓰기</button></div><input id=\"x_surface\"/><span class=\"sr-only\" role=\"status\" aria-live=\"polite\"></span>",
  notice: "<div class=\"flex min-w-0 items-center justify-between gap-2\"><label for=\"x_surface\">표현</label><button type=\"button\" aria-label=\"표현 말로 쓰기\" class=\"inline-flex h-11 flex-none items-center gap-1 text-[13px] font-medium text-ink underline underline-offset-4 \"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"></rect><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\"></path></svg>말로 쓰기</button></div><input id=\"x_surface\"/><p aria-hidden=\"true\" class=\"text-[12px] text-ink2 break-keep\">잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.</p><span class=\"sr-only\" role=\"status\" aria-live=\"polite\">알아들은 말: インペクト. 잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.</span>",
  blocked: "<div class=\"flex min-w-0 items-center justify-between gap-2\"><label for=\"x_surface\">표현</label><button type=\"button\" aria-label=\"표현 말로 쓰기\" aria-disabled=\"true\" aria-describedby=\"x_surface_mic_why\" class=\"inline-flex h-11 flex-none items-center gap-1 text-[13px] font-medium text-ink underline underline-offset-4 opacity-40\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"></rect><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\"></path></svg>말로 쓰기</button></div><p id=\"x_surface_mic_why\" class=\"text-[12px] text-ink2 break-keep\">이 주소에서는 마이크를 쓸 수 없어요.</p><input id=\"x_surface\"/><span class=\"sr-only\" role=\"status\" aria-live=\"polite\"></span>",
} as const
/** 긴 두 건은 sha256 으로 고정한다(펼친 "말로 쓰기" 상태 — 슬롯 도입 전 마크업의 해시). */
const GOLDEN_SHA = {
  open: '79e75622189409bd3c34a6e57619244f615a8ff7a0e02099a55e0d2d0f5e4c5c',
  exampleOpen: '52697a60f154e2ff8017f3022c3e74574c44dfdf35933be081c0bfe8304ea9fd',
} as const

/* ── WordMicField 슬롯 ─────────────────────────────────────────────── */

function fakeMic(over: Partial<WordMic> = {}): WordMic {
  return {
    target: null,
    blocked: null,
    announce: null,
    notice: MIC_NOTICES_INIT,
    edited: noop,
    toggle: noop,
    close: noop,
    dismissError: noop,
    voice: {
      phase: 'idle',
      recording: false,
      db: null,
      partial: '',
      statusText: '누르고 있는 동안 말해요',
      pttLabel: '누르고 있는 동안 말하기',
      error: null,
      press: noop,
      release: noop,
      abort: noop,
    },
    ...over,
  }
}

function field(mic: WordMic, target: 'surface' | 'example' = 'surface', value = '', slots: { trailing?: unknown; afterLabel?: unknown } = {}) {
  return render(
    createElement(
      WordMicField,
      { mic, target, idPrefix: 'x', value, label: createElement('label', { htmlFor: `x_${target}` }, '표현'), ...slots } as ComponentProps<typeof WordMicField>,
      createElement('input', { id: `x_${target}` }),
    ),
  )
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

test('슬롯이 없으면 WordMicField 마크업은 슬롯 도입 전과 바이트 동일하다(골든 5종: 닫힘·확인 안내+낭독·막힘·열림·예문 열림)', () => {
  assert.equal(field(fakeMic()), GOLDEN.closed)
  assert.equal(field(fakeMic({ notice: { ...MIC_NOTICES_INIT, surface: true }, announce: { target: 'surface', text: 'インペクト', n: 1 } }), 'surface', 'インペクト'), GOLDEN.notice)
  assert.equal(field(fakeMic({ blocked: 'INSECURE' })), GOLDEN.blocked)
  assert.equal(sha(field(fakeMic({ target: 'surface' }), 'surface', '映画')), GOLDEN_SHA.open)
  assert.equal(sha(field(fakeMic({ target: 'example' }), 'example')), GOLDEN_SHA.exampleOpen)
})

test('슬롯 값이 비어 있어도(null·undefined·false·빈 글) 없을 때와 같고, 감싸는 상자도 안내도 없다', () => {
  const plain = field(fakeMic())
  for (const empty of [null, undefined, false, '']) {
    assert.equal(field(fakeMic(), 'surface', '', { trailing: empty, afterLabel: empty }), plain, JSON.stringify(empty))
  }
  assert.ok(!plain.includes('flex flex-none items-center gap-2'))
})

test('trailing — 라벨 줄 오른쪽에 [말로 쓰기 · 가あ] 순서로 한 상자에 들어간다(라벨은 상자 밖 왼쪽)', () => {
  const html = field(fakeMic(), 'surface', '', { trailing: createElement('i', { 'data-x': '1' }) })
  const m = html.match(/^<div class="flex min-w-0 items-center justify-between gap-2"><label[^>]*>표현<\/label><div class="flex flex-none items-center gap-2">(<button[^]*?<\/button>)<i data-x="1"><\/i><\/div><\/div>/)
  assert.ok(m, '라벨 줄 구조')
  assert.match(m[1], /aria-label="표현 말로 쓰기"/)
  assert.equal(count(html, 'data-x="1"'), 1)
  // 말로 쓰기가 열린 칸에서도 같은 자리다(글자로 쓰기 · 가あ)
  const open = field(fakeMic({ target: 'surface' }), 'surface', '映画', { trailing: createElement('i', { 'data-x': '1' }) })
  assert.match(open, /<div class="flex flex-none items-center gap-2"><button[^]*?글자로 쓰기<\/button><i data-x="1"><\/i><\/div>/)
})

test('afterLabel — 라벨 줄 바로 다음(이유 줄·입력 칸 앞)에 그려진다', () => {
  const tip = createElement('b', { 'data-tip': '1' })
  const html = field(fakeMic({ blocked: 'INSECURE' }), 'surface', '', { afterLabel: tip, trailing: createElement('i', { 'data-x': '1' }) })
  const at = (s: string) => html.indexOf(s)
  assert.ok(at('<label') < at('data-x="1"') && at('data-x="1"') < at('data-tip="1"'), '라벨 < 가あ < 안내')
  assert.ok(at('data-tip="1"') < at('<p id="x_surface_mic_why"') && at('<p id="x_surface_mic_why"') < at('id="x_surface"'), '안내 < 이유 줄 < 입력 칸')
  assert.match(html, /<\/div><b data-tip="1"><\/b><p id="x_surface_mic_why"/)
})

/* ── 패널 ─────────────────────────────────────────────────────────── */

const SOUND = {
  tap: noop,
  retry: noop,
  stop: noop,
  view: () => ({ phase: 'idle', look: 'idle', label: '', busy: false }),
  line: () => ({ kind: 'live', text: '' }),
}
const ITEMS: WordPhraseHelpItem[] = [
  { ja: 'インパクト', ko: '임팩트, 강한 인상' },
  { ja: '衝撃', ko: '충격' },
  { ja: '影響', ko: '영향' },
]

function fakeH(p: Partial<Record<keyof WordHelper, unknown>> & { phase?: WordHelperPhase; hint?: WordHint } = {}): WordHelper {
  const { hint = null, ...rest } = p
  const query = typeof rest.query === 'string' ? rest.query : ''
  return {
    open: true,
    toggle: () => true,
    close: noop,
    query,
    setQuery: noop,
    phase: 'idle',
    items: [],
    more: false,
    setMore: noop,
    rateUntil: null,
    rateLeft: null,
    rateWaiting: false,
    msg: wordHelperMsgOf({ query, hint }),
    askDisabled: query.trim() === '',
    announce: '',
    fillAnnounce: '',
    ask: () => false,
    retry: () => false,
    stop: () => false,
    cancelPending: () => false,
    fill: noop,
    fresh: true,
    sound: SOUND,
    play: noop,
    ...rest,
  } as unknown as WordHelper
}
const panel = (h: WordHelper) => render(createElement(WordPhraseHelper, { h, qRef: createRef<HTMLInputElement>(), askRef: createRef<HTMLButtonElement>(), onClose: noop, onFill: noop }))
const PHASES: WordHelperPhase[] = ['idle', 'loading', 'slow', 'result', 'none', 'rate', 'busy', 'offline', 'error', 'timeout']
const phaseHtml = (phase: WordHelperPhase) => panel(fakeH({ phase, query: '임팩트', items: phase === 'result' ? ITEMS : [], askDisabled: phase === 'loading' || phase === 'slow' || phase === 'rate', rateWaiting: phase === 'rate', rateLeft: phase === 'rate' ? 12 : null }))

test('패널 뼈대 — section#talk-helper(aria-labelledby) · 비모달 h3 · 머리(제목·부제·✕) · 질의 줄 · 늘 마운트된 안내 줄·낭독 줄', () => {
  const html = panel(fakeH())
  assert.match(html, new RegExp(`^<section id="${HELPER_PANEL_ID}" aria-labelledby="wadd_helper_title" class="min-w-0 rounded-\\[14px\\] bg-surface2 px-3 pb-3 pt-1">`))
  assert.ok(html.includes('<h3 id="wadd_helper_title"') && !html.includes('<h2'))
  assert.ok(text(html).includes('일본어 도우미') && text(html).includes('모르는 말을 한국어로 물어보세요'))
  assert.ok(html.includes('aria-label="일본어 도우미 닫기"') && html.includes('<svg width="20" height="20"'))
  assert.ok(html.includes('<label class="sr-only" for="wadd_helper_q">한국어로 물어볼 말</label>'))
  assert.match(html, /<input id="wadd_helper_q" type="text" lang="ko" enterKeyHint="search" autoComplete="off" spellCheck="false" aria-describedby="wadd_helper_msg"/)
  assert.ok(html.includes('placeholder="예: 임팩트, 어색하다"') && html.includes('text-[16px]'), '입력 칸 16px(확대 방지)')
  assert.match(html, /<p id="wadd_helper_msg" role="status" class="[^"]*empty:mt-0[^"]*"><\/p>/)
  assert.match(html, /<p role="status" class="sr-only"><\/p>/)
  assert.ok(!text(html).includes('저장'), '저장 버튼 없음')
})

test('패널 불변식 — <form 없음 · 모든 버튼 type="button" · 스크롤 상자·키보드 숨김·높이 상한 없음 · 안내/낭독 줄 둘이 모든 phase 에서 존재 (함정 ①⑥)', () => {
  for (const phase of PHASES) {
    const html = phaseHtml(phase)
    assert.ok(!html.includes('<form'), `${phase}: 중첩 form 금지`)
    assert.equal(html.match(/<button(?![^>]*type="button")/g), null, `${phase}: type 없는/submit 버튼 금지`)
    assert.ok(count(html, '<button') >= 2, `${phase}: 버튼이 있다`)
    for (const bad of ['data-kb-docked', 'overflow-y-auto', 'overflow-auto', 'max-h-', '[:root[data-kb]', 'role="status" aria-live="off"', 'disabled=""']) assert.ok(!html.includes(bad), `${phase}: ${bad}`)
    assert.ok(!html.includes('<input id="wadd_helper_q"') || !/<input[^>]*disabled/.test(html), `${phase}: 질의 칸 disabled 금지`)
    assert.equal(count(html, 'role="status"'), 2, `${phase}: 안내 줄·낭독 줄 둘뿐`)
    assert.ok(html.includes('id="wadd_helper_msg" role="status"'), `${phase}: 안내 줄`)
    assert.ok(html.includes('<p role="status" class="sr-only">'), `${phase}: 낭독 줄`)
    assert.ok(!/<(?:div|section|ul)[^>]*class="[^"]*(?:overflow-y|overflow-auto|overflow-scroll)/.test(html), `${phase}: 스크롤 상자 0`)
  }
})

test('idle — 「이렇게 물어보세요」 + 예시 칩 3개(보이는 36·히트 44) · [물어보기] 켜짐/흐림', () => {
  const html = panel(fakeH())
  assert.ok(text(html).includes('이렇게 물어보세요'))
  for (const ex of WORD_HELPER.examples) assert.ok(html.includes(`<span class="block truncate">${ex}</span></button>`), ex)
  assert.equal(count(html, 'before:-inset-y-[5px]'), 3)
  assert.match(html, /<button type="button" aria-disabled="true"[^>]*aria-disabled:opacity-40">물어보기<\/button>/, '빈 칸이면 흐림')
  const typed = panel(fakeH({ query: '임팩트', askDisabled: false }))
  assert.doesNotMatch(typed, /aria-disabled="true"[^>]*>물어보기/, '한 글자 이상이면 켜짐')
  assert.ok(html.indexOf('wadd_helper_q') < html.indexOf('>물어보기<') && html.indexOf('>물어보기<') < html.indexOf('이렇게 물어보세요'), 'Tab 순서: 질의 칸 → 물어보기 → 칩')
})

test('안내 줄 — 빈 제출 · 한글 없음(흐리지 않음) · 90자 글자 수 · 100 초과(bad·흐림) · 서버 문구 · 멈춤(bad 아님)', () => {
  const msgOf = (html: string) => html.match(/<p id="wadd_helper_msg" role="status" class="([^"]*)">([^<]*)<\/p>/)
  const empty = msgOf(panel(fakeH({ query: ' ', hint: 'empty' })))
  assert.ok(empty && empty[2] === '물어볼 말을 한국어로 써 주세요' && empty[1].includes('text-bad'))
  const noHangul = msgOf(panel(fakeH({ query: 'impact', hint: 'noHangul', askDisabled: false })))
  assert.ok(noHangul && noHangul[2] === '한국어로 써 주세요. 일본어는 위 표현 칸에 바로 적으면 돼요.' && noHangul[1].includes('text-bad'))
  assert.doesNotMatch(panel(fakeH({ query: 'impact', hint: 'noHangul', askDisabled: false })), /aria-disabled="true"[^>]*>물어보기/)
  const n95 = msgOf(panel(fakeH({ query: '가'.repeat(95), askDisabled: false })))
  assert.ok(n95 && n95[2] === '95/100' && n95[1].includes('text-ink2') && n95[1].includes('text-right'))
  const over = msgOf(panel(fakeH({ query: '가'.repeat(101), askDisabled: true })))
  assert.ok(over && over[2] === '100자까지 물어볼 수 있어요 · 101/100' && over[1].includes('text-bad') && over[1].includes('text-right'))
  assert.match(panel(fakeH({ query: '가'.repeat(101), askDisabled: true })), /aria-disabled="true"[^>]*>물어보기/)
  const server = msgOf(panel(fakeH({ query: '<임팩트>', hint: { server: '꺾쇠(< >)는 쓸 수 없어요.' } })))
  assert.ok(server && server[2] === '꺾쇠(&lt; &gt;)는 쓸 수 없어요.' && server[1].includes('text-bad'))
  const stopped = msgOf(panel(fakeH({ query: '임팩트', hint: 'stopped', askDisabled: false })))
  assert.ok(stopped && stopped[2] === '찾기를 멈췄어요. 다시 물어볼 수 있어요.' && stopped[1].includes('text-ink2') && !stopped[1].includes('text-bad'))
})

test('loading / slow — 스켈레톤 1장(aria-hidden · 공용 Skeleton 아님) + 문구 + 텍스트 버튼 [그만두기](44) · 느리면 문구만 바뀜', () => {
  const loading = panel(fakeH({ phase: 'loading', query: '임팩트', askDisabled: true, announce: '일본어 표현을 찾는 중…' }))
  assert.ok(loading.includes('<span aria-hidden="true" class="block h-[104px] rounded-[14px] bg-surface"></span>'))
  assert.ok(!loading.includes('style="height:'), '공용 Skeleton 은 style 높이를 쓴다')
  assert.match(loading, /<p class="min-w-0 text-\[12px\] text-ink2 break-keep">일본어 표현을 찾는 중…<\/p>/)
  assert.match(loading, /<button type="button" class="inline-flex h-11 flex-none items-center px-1 text-\[13px\] font-semibold text-accent">그만두기<\/button>/)
  assert.match(loading, /<p role="status" class="sr-only">일본어 표현을 찾는 중…<\/p>/, '낭독 줄에 한 번')
  assert.match(loading, /<button type="button" aria-disabled="true"[^>]*>물어보기/, '찾는 중엔 [물어보기] 흐림')
  const slow = panel(fakeH({ phase: 'slow', query: '임팩트', askDisabled: true }))
  assert.match(slow, /text-ink2 break-keep">조금만 기다려 주세요<\/p>/)
  assert.ok(slow.includes('>그만두기<') && !text(slow).replace(/일본어 표현을 찾는 중/, '').includes('찾는 중…') && !slow.includes('break-keep">일본어 표현을 찾는 중…'))
  for (const html of [loading, slow]) assert.ok(!html.includes('이렇게 물어보세요'))
})

test('result 1개 — 카드 하나 · [다른 후보] 줄 없음 · 낭독 「표현 1개를 찾았어요」', () => {
  const html = panel(fakeH({ phase: 'result', items: [ITEMS[0]], announce: '표현 1개를 찾았어요' }))
  assert.ok(html.includes('<ul aria-label="일본어 표현" class="flex flex-col gap-2">'))
  assert.equal(count(html, '<li '), 1)
  assert.ok(!html.includes('wadd_helper_alts') && !text(html).includes('다른 후보'))
  assert.match(html, /<p role="status" class="sr-only">표현 1개를 찾았어요<\/p>/)
})

test('result 3개 — 첫 카드만 + [다른 후보 2개 더 보기 ▾](요약 칸 비움) · 나머지는 hidden 으로 늘 마운트 · 펼치면 「다른 후보 접기 ▴」', () => {
  const closed = panel(fakeH({ phase: 'result', items: ITEMS }))
  assert.match(closed, /<button type="button" aria-expanded="false" aria-controls="wadd_helper_alts" class="my-1 flex h-11 w-full min-w-0 items-center gap-2 rounded-\[10px\] px-1 text-left">/)
  assert.ok(text(closed).includes('다른 후보 2개 더 보기') && text(closed).includes('▾'))
  assert.ok(closed.includes('<span class="min-w-0 flex-1 truncate text-[12px] text-ink2"></span>'), '요약 칸은 비어 있다(Q4)')
  assert.match(closed, /<ul id="wadd_helper_alts" aria-label="다른 후보" hidden="" class="flex flex-col gap-2">/)
  assert.equal(count(closed, '<li '), 3)
  const open = panel(fakeH({ phase: 'result', items: ITEMS, more: true }))
  assert.ok(open.includes('aria-expanded="true" aria-controls="wadd_helper_alts"'))
  assert.match(open, /<ul id="wadd_helper_alts" aria-label="다른 후보" class="flex flex-col gap-2">/)
  assert.ok(text(open).includes('다른 후보 접기') && text(open).includes('▴'))
})

test('none — 빈 결과 상자(role 없음) + 힌트, [다시 시도] 없음 · 질의 칸·[물어보기]는 그대로 쓸 수 있다(막다른 길 없음)', () => {
  const html = panel(fakeH({ phase: 'none', query: '감사합니다', askDisabled: false, announce: '이 말에 맞는 일본어를 찾지 못했어요.' }))
  assert.ok(text(html).includes('이 말에 맞는 일본어를 찾지 못했어요.') && text(html).includes('짧은 한국어 낱말로 다시 써 보세요. 예: ‘어색하다’'))
  assert.ok(!html.includes('role="alert"') && !text(html).includes('다시 시도'))
  assert.ok(html.includes('class="flex flex-col items-start gap-2 rounded-xl bg-surface px-3 py-2.5"'))
  assert.ok(!/<input[^>]*disabled/.test(html) && !/aria-disabled="true"[^>]*>물어보기/.test(html))
  assert.match(html, /<p role="status" class="sr-only">이 말에 맞는 일본어를 찾지 못했어요\.<\/p>/)
})

test('rate — 상자(role 없음) 「n초 뒤…」 + [다시 시도] 대기 중 흐림 · 끝나면 「잠시 뒤…」 + 켜짐', () => {
  const waiting = panel(fakeH({ phase: 'rate', query: '임팩트', askDisabled: true, rateWaiting: true, rateLeft: 12, announce: '12초 뒤 다시 물어볼 수 있어요.' }))
  assert.ok(!waiting.includes('role="alert"') && text(waiting).includes('12초 뒤 다시 물어볼 수 있어요.'))
  assert.match(waiting, /<button type="button" aria-disabled="true" class="[^"]*opacity-40">다시 시도<\/button>/)
  assert.match(waiting, /<button type="button" aria-disabled="true"[^>]*>물어보기/)
  const done = panel(fakeH({ phase: 'rate', query: '임팩트', askDisabled: false, rateWaiting: false, rateLeft: 0 }))
  assert.ok(text(done).includes('잠시 뒤 다시 물어봐 주세요.') && !text(done).includes('초 뒤'))
  assert.doesNotMatch(done, /aria-disabled="true"[^>]*>다시 시도/)
  const unknown = panel(fakeH({ phase: 'rate', query: '임팩트', rateWaiting: true, rateLeft: null }))
  assert.ok(text(unknown).includes('잠시 뒤 다시 물어봐 주세요.'), '첫 틱 전(남은 초 모름)에는 숫자를 지어내지 않는다')
})

test('busy / offline / error / timeout — 실패 4종만 role="alert" 상자 + [다시 시도](켜짐), 문구는 데모 그대로', () => {
  const want: Record<string, string> = {
    busy: '다른 화면에서 일본어 표현을 찾는 중이에요. 끝나면 다시 물어봐 주세요.',
    offline: '연결하지 못했어요. 네트워크를 확인해 주세요.',
    error: '지금은 표현을 가져오지 못했어요.',
    timeout: '시간이 오래 걸려 멈췄어요. 다시 물어봐 주세요.',
  }
  for (const [phase, msg] of Object.entries(want)) {
    const html = panel(fakeH({ phase: phase as WordHelperPhase, query: '임팩트', askDisabled: false }))
    assert.match(html, new RegExp(`<div role="alert" class="flex flex-col items-start gap-2 rounded-xl bg-surface px-3 py-2\\.5"><p class="text-\\[13px\\] text-ink break-keep">${msg}</p><button type="button" class="inline-flex h-11[^"]*">다시 시도</button></div>`), phase)
    assert.equal(count(html, 'role="alert"'), 1, phase)
    assert.ok(!/<input[^>]*disabled/.test(html), `${phase}: 질의 칸은 고칠 수 있다`)
  }
  for (const phase of ['idle', 'loading', 'slow', 'result', 'none', 'rate']) assert.ok(!phaseHtml(phase as WordHelperPhase).includes('role="alert"'), `${phase}: alert 없음`)
})

test('Tab/읽기 순서 — 패널 ✕ → 질의 칸 → [물어보기] → 본문 버튼 (DOM 순서 = 보이는 순서)', () => {
  const html = panel(fakeH({ phase: 'result', items: ITEMS, query: '임팩트', askDisabled: false }))
  const at = (s: string) => html.indexOf(s)
  assert.ok(at('일본어 도우미 닫기') < at('id="wadd_helper_q"') && at('id="wadd_helper_q"') < at('>물어보기<') && at('>물어보기<') < at('>표현 칸에 넣기<') && at('>표현 칸에 넣기<') < at('インパクト 듣기') && at('インパクト 듣기') < at('다른 후보 2개 더 보기'))
})

/* ── 카드 · 안내 줄 ──────────────────────────────────────────────── */

const card = (item: unknown = ITEMS[0], sound: unknown = SOUND) =>
  render(createElement('ul', null, createElement(WordHelperCard, { item: item as WordPhraseHelpItem, index: 0, ann: { s: 'off' }, sound: sound as never, onPlay: noop, onFill: noop })))

test('카드 — 일본어 20px semibold(lang=ja) · 한국어 뜻 늘 · [표현 칸에 넣기] · ▶ 「… 듣기」(44) · 꼬리표/「왜」 줄은 넣어도 그리지 않는다', () => {
  const html = card()
  assert.ok(html.includes('lang="ja" class="text-[20px] font-semibold leading-[1.6] text-ink [overflow-wrap:anywhere]"'))
  assert.ok(html.includes('class="mt-0.5 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">임팩트, 강한 인상</p>'))
  assert.match(html, /<button type="button" class="inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-\[14px\] font-semibold text-ink mt-2">표현 칸에 넣기<\/button>/)
  assert.ok(html.includes('aria-label="インパクト 듣기"') && html.includes('grid h-11 w-11 flex-none place-items-center rounded-full text-ink'))
  assert.ok(html.includes('<li class="flex min-w-0 gap-0.5 rounded-[14px] border border-line bg-surface pb-3 pl-3 pr-1 pt-2.5">'))
  const extra = card({ ...ITEMS[0], labelKo: '꼬리표입니다', whyKo: '이유입니다' })
  assert.equal(extra, html, '꼬리표·이유 칸은 있어도 마크업이 같다')
  assert.ok(!extra.includes('꼬리표입니다') && !extra.includes('이유입니다'))
})

test('카드 ▶ — 재생 중이면 ■ + 「… 멈추기」 + accent 바탕, 소리 실패는 그 카드 아래 한 줄(role 따라 alert/status)', () => {
  const playing = card(ITEMS[0], { ...SOUND, view: () => ({ phase: 'playing', look: 'on', label: '', busy: false }) })
  assert.ok(playing.includes('aria-label="インパクト 멈추기"') && playing.includes('bg-accent text-on-accent') && playing.includes('<rect x="5" y="5"'))
  const failed = card(ITEMS[0], { ...SOUND, line: () => ({ kind: 'msg', msg: 'fail' }) })
  assert.match(failed, /<p role="alert" class="mt-1 text-\[12px\] break-keep text-bad">목소리를 불러오지 못했어요\.<\/p>/)
  const retrying = card(ITEMS[0], { ...SOUND, line: () => ({ kind: 'retrying' }) })
  assert.match(retrying, /<p role="status" class="mt-1 text-\[12px\] text-ink2">다시 불러오는 중…<\/p>/)
  assert.ok(!card({ ja: '', ko: '뜻' }).includes('듣기'), '소리 낼 글이 없으면 ▶ 없음')
})

test('처음 안내 줄 — role=note · id · 문구 · ✕ 「안내 닫기」(히트 44) · 흐름 안(absolute 아님) · 꼬리는 가あ 가운데(right-[15px]+7=22)', () => {
  const html = render(createElement(WordHelperTip, { onClose: noop }))
  assert.ok(html.startsWith('<div id="wadd_helper_tip" role="note"'))
  assert.ok(text(html).includes('한국어로 물어보면 일본어 표현을 알려 줘요'))
  assert.ok(html.includes('aria-label="안내 닫기"') && html.includes('before:-inset-2') && html.includes('type="button"'))
  const cls = html.match(/^<div[^>]*class="([^"]*)"/)?.[1] ?? ''
  assert.ok(cls.startsWith('relative mt-1.5 flex w-[min(100%,236px)]') && cls.includes('self-end') && cls.includes('bg-ink') && cls.includes('text-surface'))
  assert.ok(!/(^|\s)(absolute|fixed)(\s|$)/.test(cls), '떠 있지 않다')
  assert.ok(cls.includes("before:right-[15px]") && cls.includes('before:border-[7px]') && cls.includes('before:border-b-ink') && cls.includes('before:bottom-full'))
  assert.ok(!cls.includes('shadow'), '그림자 없음')
})

test('화면 문구·마크업에 엔진·모델 이름이 없다', () => {
  const all = [...PHASES.map(phaseHtml), card(), render(createElement(WordHelperTip, { onClose: noop }))].join('')
  assert.doesNotMatch(all, /reazon|whisper|style-?bert|claude|haiku|sonnet|opus|qwen|sherpa|speaker_?id|model_?id/i)
})
