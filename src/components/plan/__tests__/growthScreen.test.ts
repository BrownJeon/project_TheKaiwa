import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import type { GrowthResponse } from '@/types/plan'
import { RadarChart, Sparkline } from '../GrowthCharts'
import { GrowthBody, GrowthError } from '../GrowthScreen'
import GrowthSkeleton, { GrowthSkeletonBody } from '../GrowthSkeleton'
import { GROWTH_SKELETON } from '../growthSkeletonSizes'
import { MonthNav } from '../CalendarSection'
import { readLineOf } from '../growthLogic'
import { BarsSvg, WeekNav } from '../WeeklyBars'
import { emptyFixture, fewFixture, normalFixture, oneSidedFixture, richFixture, TODAY } from './growthFixtures'

// task-080 성장 탭 정적 렌더(screens.md §36-3·36-4·36-12). 막대·레이더는 너비를 재야 그려지므로 그림은 너비를 직접 준 부품으로 따로 본다.
const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const wrap = (el: ReactElement, qs = '') =>
  renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: ROUTER as never }, createElement(SearchParamsContext.Provider, { value: new URLSearchParams(qs) as never }, el)),
  )
const noop = () => {}
const body = (data: GrowthResponse, busy = false) => wrap(createElement(GrowthBody, { data, weeks: data.range.weeks, onWeeks: noop, busy, today: data.range.today }))
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

test('섹션 순서·이름 — 기간 → 한눈에 → 체크내역 → 주마다 공부량 → 공부결과 → AI 평가 점수 → 선생님 분석 → 끝 줄', () => {
  const html = body(fewFixture())
  const order = ['role="radiogroup" aria-label="볼 기간"', '>한눈에</h2>', '>체크내역</h2>', '>주마다 공부량</h2>', '>공부결과</h2>', '>AI 평가 점수</h2>', '>선생님 분석</h2>', '기록을 지워도 이 화면의 숫자는 바뀌지 않아요.']
  let at = -1
  for (const k of order) {
    const i = html.indexOf(k)
    assert.ok(i > at, k)
    at = i
  }
})

test('카드 섹션은 모두 aria-labelledby 로 제목 h2 를 가리킨다', () => {
  const html = body(normalFixture())
  const refs = [...html.matchAll(/<section aria-labelledby="([^"]+)"/g)].map((m) => m[1])
  assert.equal(refs.length, 5, '체크내역·주마다 공부량·공부결과·AI 평가 점수·선생님 분석')
  for (const id of refs) assert.match(html, new RegExp(`<h2 id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), id)
})

test('정상 화면의 알림 영역은 읽기 줄 하나(role=status·aria-live=polite), 오류 알림·자리표시 알림 없음', () => {
  for (const data of [fewFixture(), normalFixture(), richFixture(), emptyFixture()]) {
    const html = body(data)
    assert.equal(count(html, /role="status"/g), 1)
    assert.equal(count(html, /aria-live=/g), 1)
    assert.ok(!html.includes('role="alert"'))
  }
  assert.match(
    body(fewFixture()),
    /<p role="status" aria-live="polite"[^>]*><span aria-hidden="true">이번 주 10월 18일\(일\)~오늘\(화\) · <b class="font-\[650\] whitespace-nowrap">공부한 날 2일<\/b><\/span><span class="sr-only">이번 주, 10월 18일 일요일부터 오늘 화요일까지, 공부한 날 2일<\/span><\/p>/,
  )
  assert.ok(text(body(emptyFixture())).includes('이번 주 10월 18일(일)~오늘(화) · 기록을 시작하기 전이에요'), '기록 0 — 이번 주도 기록 전')
})

test('기간 바꾸는 중 — 앞 내용을 그대로 두고 감싸개에 aria-busy, 기간 분절만 새 값', () => {
  const few = fewFixture()
  const html = wrap(createElement(GrowthBody, { data: few, weeks: 8, onWeeks: noop, busy: true, today: TODAY }))
  assert.match(html, /^<div aria-busy="true">/)
  assert.match(html, /<button type="button" role="radio" aria-checked="true"[^>]*><span class="block truncate">최근 8주<\/span>/)
  assert.match(html, />최근 4주<\/span><\/div>/, '공부결과 오른쪽 글은 보이는 내용(4주)의 기간')
  assert.ok(!body(few).startsWith('<div aria-busy'), '평소엔 aria-busy 없음')
})

test('적음(①) — 기간 줄 꼬리·숫자 카드·적음 안내·축 상태(단계·아직·기록 전·역할극 링크)·평가 빈 상태 링크', () => {
  const html = body(fewFixture())
  assert.ok(text(html).includes('9월 27일(일)~오늘 · 주는 일요일에 시작해요 · 기록은 10월 8일부터라 그 전 칸은 비어 보여요'))
  assert.ok(text(html).includes('연속 출석3일가장 길게 3일'))
  assert.ok(text(html).includes('공부한 날9일시작한 지 13일 중'))
  assert.match(html, /기록 13일째예요\. 능력 단계는 기록이 모이는 대로 하나씩 보여요 — 지금은 <b class="font-semibold">어휘 회상<\/b>이 먼저 보이기 시작했어요\./)
  // L12 — 안내는 «공부결과» 카드 안, 소개 줄 바로 아래·첫 축 줄 위(숫자 카드 아래가 아니다)
  const note = html.indexOf('data-few-note')
  assert.equal(count(html, /data-few-note/g), 1)
  assert.ok(html.indexOf('>공부결과</h2>') < note && html.indexOf('공부하며 맞히고 틀린 기록으로 계산해요.') < note, '소개 줄 뒤')
  assert.ok(note < html.indexOf('data-axis="VOCAB_RECALL"'), '첫 축 줄 앞')
  assert.ok(html.indexOf('>체크내역</h2>') < note && html.indexOf('>주마다 공부량</h2>') < note, '체크내역·주마다 공부량은 안내 위쪽(밀리지 않음)')
  const tiles = html.slice(html.indexOf('>한눈에</h2>'), html.indexOf('>체크내역</h2>'))
  assert.ok(!tiles.includes('일째예요'), '숫자 카드 쪽에는 안내 없음')
  assert.match(html, /<p class="-mt-1 mb-2 [^"]*">공부하며 맞히고 틀린 기록으로 계산해요\.<\/p><p data-few-note="" class="mb-2 rounded-\[10px\] bg-surface2 [^"]*">/, '옛 mt-2 없이 mb-2')
  assert.deepEqual(
    [...html.matchAll(/data-axis="(\w+)" data-state="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`),
    ['VOCAB_RECALL:stage', 'GRAMMAR_PARTICLE:wait', 'LISTEN_RESPOND:none', 'SENTENCE_PRODUCTION:wait', 'CONVERSATION_MAINTAIN:wait'],
  )
  // 어휘 회상: 단계 + 숨김 «4단계 중 3단계» + 4칸 중 3칸 채움
  const vocab = html.slice(html.indexOf('data-axis="VOCAB_RECALL"'), html.indexOf('data-axis="GRAMMAR_PARTICLE"'))
  assert.match(vocab, /자리 잡는 중<\/span><span class="sr-only">4단계 중 3단계<\/span>/)
  assert.equal(count(vocab, /data-on="1"/g), 3)
  assert.equal(count(vocab, /data-on="0"/g), 1)
  assert.ok(text(vocab).includes('관측 90건(맞힘 70 · 틀림 20) · 넘김 6'))
  assert.ok(text(vocab).includes('추세는 기록이 더 모이면 보여요'))
  const listen = html.slice(html.indexOf('data-axis="LISTEN_RESPOND"'), html.indexOf('data-axis="SENTENCE_PRODUCTION"'))
  assert.ok(text(listen).includes('기록 전'))
  assert.ok(text(listen).includes('아직 이 능력을 기록하는 공부가 없어요.'))
  assert.ok(!listen.includes('href='), '기록 전 축은 진행선·링크 없음')
  const grammar = html.slice(html.indexOf('data-axis="GRAMMAR_PARTICLE"'), html.indexOf('data-axis="LISTEN_RESPOND"'))
  assert.ok(text(grammar).includes('아직 판단하기 일러요'))
  assert.ok(text(grammar).includes('관측 14건 · 20건이 되면 단계가 보여요수업 문제와 대화 교정에서 쌓여요'))
  assert.match(grammar, /style="width:70%"/)
  const conv = html.slice(html.indexOf('data-axis="CONVERSATION_MAINTAIN"'))
  assert.ok(text(conv).includes('끝낸 역할극 1번 · 5번이 되면 단계가 보여요'))
  assert.match(conv, /<a class="[^"]*min-h-11[^"]*" href="\/study\/ai\?tab=scenario">역할극 고르러 가기<\/a>/)
  assert.match(html, /아직 AI 평가를 본 적이 없어요\./)
  assert.match(html, /<a class="[^"]*h-12[^"]*" href="\/study\/today\/eval\/new">AI 평가 보러 가기<\/a>/)
})

test('한쪽 증거(⑩ L11) — 표본 부족 줄 모양에 다른 글, 진행선·막대·숫자 줄·추세·링크 없음, 낭독은 한 문단', () => {
  const html = body(oneSidedFixture())
  const grammar = html.slice(html.indexOf('data-axis="GRAMMAR_PARTICLE"'), html.indexOf('data-axis="LISTEN_RESPOND"'))
  assert.match(grammar, /^data-axis="GRAMMAR_PARTICLE" data-state="oneSided"/)
  assert.match(grammar, /<h3[^>]*>문형·조사<\/h3><span class="flex-none whitespace-nowrap text-\[14px\] font-semibold text-ink2">아직 판단하기 일러요<\/span>/)
  assert.match(
    grammar,
    /<p class="mt-1\.5 text-\[13px\] text-ink break-keep \[overflow-wrap:anywhere\]">교정 기록이 대부분이라 단계를 보이지 않아요\.<span class="mt-0\.5 block text-\[12px\] text-ink2">수업 문제도 풀면 단계가 보이기 시작해요\.<\/span><\/p><\/li>/,
    '본문 + 안내가 한 문단, 그 뒤 줄 끝',
  )
  assert.ok(!/data-meter|style="width|href=|sr-only|관측|맞힘|틀림|119|추세|일에 걸쳐/.test(grammar), '진행선·4칸 막대·숫자·추세·링크·숨김 단계 글 없음')
  assert.match(html, /지금은 <b class="font-semibold">어휘 회상<\/b>이 먼저/, '적음 안내는 한쪽 증거 축을 세지 않는다')
  const vocab = html.slice(html.indexOf('data-axis="VOCAB_RECALL"'), html.indexOf('data-axis="GRAMMAR_PARTICLE"'))
  assert.match(vocab, /data-state="stage"/)
  // 문장 산출·어휘 회상 안내 글(축마다 문장째)
  for (const [axis, sub] of [
    ['VOCAB_RECALL', '오늘의 단어나 수업 문제도 풀면 단계가 보이기 시작해요.'],
    ['SENTENCE_PRODUCTION', '수업 «말하기» 과제도 하면 단계가 보이기 시작해요.'],
  ] as const) {
    const d = oneSidedFixture()
    d.skills = d.skills.map((x) => (x.axis === axis ? { ...x, n: 40, obsDays: 5, enough: true, oneSided: true, stage: null } : x))
    const h = body(d)
    const row = h.slice(h.indexOf(`data-axis="${axis}"`))
    assert.ok(text(row.slice(0, row.indexOf('</li>'))).includes(`교정 기록이 대부분이라 단계를 보이지 않아요.${sub}`), axis)
  }
  const early = oneSidedFixture()
  early.skills = early.skills.map((x) => (x.axis === 'GRAMMAR_PARTICLE' ? { ...x, n: 3, obsDays: 1, enough: false, oneSided: true } : x))
  const eh = body(early)
  const eg = eh.slice(eh.indexOf('data-axis="GRAMMAR_PARTICLE"'), eh.indexOf('data-axis="LISTEN_RESPOND"'))
  assert.match(eg, /data-state="wait"/, '표본이 차기 전에는 표본 부족 줄(진행선)')
  assert.ok(text(eg).includes('관측 3건 · 20건이 되면 단계가 보여요') && /style="width:15%"/.test(eg))
})

test('‹ › 끝 칸(감사 L2) — aria-disabled + 눌러도 onPick 을 부르지 않는다(weeks[-1] 방지), 가운데 칸은 한 칸씩', () => {
  type Btn = { props: { 'aria-disabled'?: boolean; onClick: () => void; 'aria-label': string } }
  const picks: number[] = []
  const nav = (sel: number, n = 4) => (WeekNav({ sel, n, read: null, onPick: (j) => picks.push(j) }) as unknown as { props: { children: Btn[] } }).props.children
  const [prev0, , next0] = nav(0)
  assert.equal(prev0.props['aria-disabled'], true)
  assert.equal(next0.props['aria-disabled'], undefined)
  prev0.props.onClick()
  assert.deepEqual(picks, [], '첫 주에서 ‹ 는 아무 일 없음')
  next0.props.onClick()
  assert.deepEqual(picks, [1])
  const [prev3, , next3] = nav(3)
  assert.equal(next3.props['aria-disabled'], true)
  next3.props.onClick()
  assert.deepEqual(picks, [1], '이번 주에서 › 는 아무 일 없음')
  prev3.props.onClick()
  assert.deepEqual(picks, [1, 2])
  const [p1, , n1] = nav(0, 1)
  assert.ok(p1.props['aria-disabled'] && n1.props['aria-disabled'], '1주뿐이면 둘 다 끝')
  const html = renderToStaticMarkup(createElement(WeekNav, { sel: 3, n: 4, read: null, onPick: noop }))
  assert.match(html, /aria-label="다음 주" aria-disabled="true"/)
  assert.ok(!/aria-label="이전 주" aria-disabled/.test(html))
})

test('고른 주 배선(감사 L1) — 렌더 중 syncWeekPick 결과를 상태에 되쓰고 그 값으로 주를 고른다(빼면 4→8→4 왕복에서 지난 주가 되살아난다)', () => {
  // DOM 도구가 없어 상태 전환은 순수 함수 시험(growthLogic.test)과 헤드리스 왕복 검증이 맡고, 여기서는 그 둘을 잇는 두 줄만 묶어 둔다.
  const src = readFileSync(join(__dirname, '..', 'WeeklyBars.tsx'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.match(src, /const synced = syncWeekPick\(picked, key\)\s+if \(synced !== picked\) setPicked\(synced\)/)
  assert.match(src, /const sel = selectedWeekOf\(synced, n\)/)
  assert.ok(!/key=\{/.test(readFileSync(join(__dirname, '..', 'GrowthScreen.tsx'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').split('<WeeklyBars')[1]?.split('/>')[0] ?? ''), 'WeeklyBars 에 key 를 달지 않는다(지표 칩까지 초기화되므로)')
})

test('읽기 줄 굵은 값 조각은 줄 중간에서 접히지 않는다(정정 ⑮ whitespace-nowrap)', () => {
  const read = readLineOf('2026-10-18', true, TODAY, 'days', 2)
  const html = renderToStaticMarkup(createElement(WeekNav, { sel: 3, n: 4, read, onPick: noop }))
  assert.match(html, /<b class="font-\[650\] whitespace-nowrap">공부한 날 2일<\/b>/)
})

test('달력 «오늘» 단추(L13) — 눌리는 높이 44px 이상(::before 세로 여백), 보이는 알약 h-8·테두리 그대로', () => {
  const html = renderToStaticMarkup(
    createElement(MonthNav, { month: '2026-10', isCurrent: false, titleId: 't', onPrev: noop, onNext: noop, onToday: noop, onBlocked: noop }),
  )
  const cls = /<button type="button" class="([^"]*)">오늘<\/button>/.exec(html)?.[1] ?? ''
  assert.ok(cls.includes(' h-8 ') && cls.includes(' border ') && cls.includes(' px-3 '), cls)
  // ::before 는 안쪽 여백 상자(h-8 32 − 테두리 2 = 30px) 기준이다.
  const m = /before:-inset-y-(?:\[(\d+(?:\.\d+)?)px\]|(\d+(?:\.\d+)?))(?=\s)/.exec(cls)
  assert.ok(m, '세로 히트 여백')
  const inset = m[1] !== undefined ? Number(m[1]) : Number(m[2]) * 4
  assert.ok(30 + 2 * inset >= 44, `눌림 높이 ${30 + 2 * inset}px`)
  assert.equal(30 + 2 * inset, 44, '줄 높이(‹ › 44) 밖으로 나가지 않는다')
  const cur = renderToStaticMarkup(createElement(MonthNav, { month: '2026-10', isCurrent: true, titleId: 't', onPrev: noop, onNext: noop, onToday: noop, onBlocked: noop }))
  assert.match(cur, /<button type="button" aria-disabled="true" class="[^"]*before:-inset-y-\[7px\][^"]*">오늘<\/button>/, '이번 달(aria-disabled)도 같은 크기')
})

test('보통(②) — 적음 안내 없음, 날짜 부족 줄, 평가 종류 칩 두 개(회화 → 단어), 한 번 본 평가 문장', () => {
  const html = body(normalFixture())
  assert.ok(!text(html).includes('일째예요'))
  assert.ok(text(html).includes('관측 22건 · 3일에 걸쳐 모이면 단계가 보여요(지금 2일)'))
  assert.match(html, /<div role="radiogroup" aria-label="평가 종류"[^>]*><button type="button" role="radio" aria-checked="true"[^>]*>회화 평가 1<\/button><button type="button" role="radio" aria-checked="false"[^>]*>단어 평가 1<\/button><\/div>/)
  assert.match(html, /회화 평가\(N4\) <b class="font-\[650\]">62점<\/b> · 기본은 잡혔어요/)
  assert.ok(text(html).includes('회화 평가를 한 번 더 보면 달라진 점이 겹쳐 보여요.'))
  assert.match(html, /<p class="sr-only">회화 평가 최근 10월 6일 62점: 정확성 3점, 어휘 3점, 문법 2점, 자연스러움 3점, 조각 조립 4점\. 5점 만점\.<\/p>/)
  assert.match(html, /<caption class="sr-only">회화 평가 영역별 점수\(5점 만점\)<\/caption>/)
  assert.ok(text(html).includes('최근 4주 2번'))
  assert.ok(text(html).includes('↑ 앞 기간보다 늘었어요'))
  assert.match(html, /<span aria-hidden="true">↑ <\/span>앞 기간보다 늘었어요/, '화살표는 읽지 않는다')
})

test('풍부(③) 12주 — 띠 위 달 라벨, 작은 추이선(그림 숨김), 겹친 평가 문장·범례·표(최근이 위)', () => {
  const html = body(richFixture())
  assert.match(html, /grid-template-columns:16px repeat\(12, minmax\(12px, 56px\)\)/)
  assert.ok(html.includes('>8월</span>') && html.includes('>9월</span>') && html.includes('>10월</span>'))
  assert.equal(count(html, /<svg width="64" height="22"[^>]*aria-hidden="true"/g), 3, '어휘·문형·문장 3축(대화 유지는 점 0개)')
  assert.match(html, /회화 평가\(N4\) 58점 → <b class="font-\[650\]">82점<\/b> · 거의 다 왔어요/)
  assert.ok(text(html).includes('10/17 82점(최근)') && text(html).includes('8/10 58점(이 기간 처음)'))
  const rows = [...html.slice(html.indexOf('회화 평가 영역별 점수')).matchAll(/<tr><td[^>]*>(\d+\/\d+)<\/td>/g)].map((m) => m[1])
  assert.deepEqual(rows, ['10/17', '10/5', '9/7', '8/10'])
  assert.ok(text(html).includes('↓ 앞 기간보다 줄었어요'))
})

test('8주 — 띠 위 라벨은 카드 안 너비 324px 이상이면 날짜, 아니면 달(컨테이너 질의)', () => {
  const html = body(fewFixture(8))
  assert.match(html, /<div class="@container min-w-0">/)
  assert.match(html, /<span class="hidden @min-\[324px\]:inline">8\/30<\/span><span class="@min-\[324px\]:hidden">8월<\/span>/)
  assert.match(html, /<span class="hidden @min-\[324px\]:inline">9\/6<\/span><span class="@min-\[324px\]:hidden">9월<\/span>/, '달이 바뀐 열')
  assert.match(html, /<span class="hidden @min-\[324px\]:inline">9\/13<\/span><span class="@min-\[324px\]:hidden"><\/span>/, '같은 달은 빈 라벨')
})

test('평가가 기간 밖에만 — «이 기간에는 본 평가가 없어요» + 둘째 줄은 12주가 아닐 때만', () => {
  const w8 = { ...fewFixture(8), hasEvaluations: true, evaluations: [] }
  assert.ok(text(body(w8)).includes('이 기간에는 본 평가가 없어요.기간을 늘리면 지난 평가가 보여요.'))
  const w12 = { ...richFixture(), evaluations: [] }
  assert.ok(text(body(w12)).includes('이 기간에는 본 평가가 없어요.'))
  assert.ok(!text(body(w12)).includes('기간을 늘리면'))
  assert.ok(!text(body(w12)).includes('최근 12주 0번'), '기간 안 0건이면 오른쪽 글 없음')
})

test('체크내역 — 그림은 숨김(aria-hidden), 숨김 요약 한 문장, [주별로 보기] 표 캡션·열', () => {
  const html = body(fewFixture())
  assert.match(html, /<div aria-hidden="true" data-growth-strip=""/)
  assert.match(html, /<p class="sr-only">최근 4주 동안 공부한 날 9일, 출석만 한 날 1일\. 주별 자세한 내용은 아래 표에 있어요\.<\/p>/)
  assert.match(html, /<caption class="sr-only">주별 공부한 요일<\/caption>/)
  assert.ok(text(html).includes('10/18 주 · 이번 주일(2) 화(1)월'))
  assert.equal(count(html, /data-cell="future"/g), 4)
  assert.equal(count(html, /data-cell="att"/g), 1)
  assert.match(html, /<caption class="sr-only">주별 공부한 날<\/caption>/, '[표로 보기] 기본 지표')
})

test('완전 처음(since=null) — 같은 구조, 숫자 0, 안내 없음, 오늘 칸만 «안 함»', () => {
  const html = body(emptyFixture())
  assert.ok(!text(html).includes('일째예요'))
  assert.equal(count(html, /data-cell="none"/g), 1)
  assert.equal(count(html, /data-cell="pre"/g), 7 * 4 - 1 - 4)
  assert.ok(text(html).includes('연속 출석0일'))
  assert.ok(text(html).includes('아직 AI 평가를 본 적이 없어요.'))
})

test('그림 SVG 는 모두 aria-hidden — 막대(고른 주 값·x 라벨 «이번 주»·기록 전 구역)·레이더·추이선', () => {
  const few = fewFixture()
  const vals = [null, 3, 4, 2]
  const bars = renderToStaticMarkup(createElement(BarsSvg, { W: 298, vals, sel: 3, weeks: few.weeks }))
  assert.match(bars, /^<svg width="298" height="132" viewBox="0 0 298 132" aria-hidden="true"/)
  assert.ok(bars.includes('>이번 주</text>') && bars.includes('>9/27</text>'))
  assert.match(bars, /<rect x="26" y="18" width="68" height="94" rx="6" fill="var\(--color-surface2\)"><\/rect><text[^>]*>기록 전<\/text>/)
  assert.match(bars, /font-weight="700" fill="var\(--color-ink\)" style="font-size:12px">2<\/text>/, '고른 주(이번 주) 값')
  assert.equal(count(bars, /<path /g), 3, '0 보다 큰 주만 막대')
  const radar = renderToStaticMarkup(createElement(RadarChart, { size: 298, series: [{ values: [4, 4, 3, 4, 5], main: true }, { values: [3, 3, 2, 2, 3], main: false }] }))
  assert.match(radar, /^<svg width="298" height="256" viewBox="0 0 298 256" aria-hidden="true"/)
  for (const d of ['정확성', '어휘', '문법', '자연스러움', '조각 조립']) assert.ok(radar.includes(`>${d}</text>`), d)
  assert.match(renderToStaticMarkup(createElement(Sparkline, { points: [0.5, 0.6, 0.7, 0.8] })), /^<svg width="64" height="22" viewBox="0 0 64 22" aria-hidden="true"/)
  assert.equal(renderToStaticMarkup(createElement(Sparkline, { points: [0.5, 0.6, 0.7] })), '')
})

test('자리표시 — 알림 한 줄(aria-busy 밖) · 기간 분절은 실제 부품(inert, 주소 값) · 회색 블록 높이 = 실측 상수 · 「불러오는 중」 글자 없음', () => {
  const b = wrap(createElement(GrowthSkeletonBody, { weeks: 12 }))
  assert.match(b, /^<p class="sr-only" role="status">성장 기록을 불러오는 중이에요<\/p><div aria-busy="true">/)
  assert.equal(count(b, /role="status"/g), 1)
  assert.match(b, /<div inert=""><div role="radiogroup" aria-label="볼 기간"/)
  assert.match(b, /aria-checked="true"[^>]*><span class="block truncate">최근 12주/)
  assert.ok(b.includes(`style="height:${GROWTH_SKELETON.rangeLineH}px"`))
  assert.equal(count(b, new RegExp(`style="height:${GROWTH_SKELETON.tileH}px"`, 'g')), 3)
  assert.ok(b.includes(`style="height:${GROWTH_SKELETON.stripCardH}px"`) && b.includes(`style="height:${GROWTH_SKELETON.barsCardH}px"`))
  // 실측 3폭 중앙값(2026-10-21, growthSkeletonSizes.ts 근거) — 화면을 바꾸면 다시 재고 함께 고친다.
  assert.deepEqual({ ...GROWTH_SKELETON }, { rangeLineH: 36, tileH: 88, stripCardH: 330, barsCardH: 347 })
  assert.ok(!/불러오는 중…|<button(?![^>]*role="radio")/.test(b), '가짜 버튼 없음')
  const full = wrap(createElement(GrowthSkeleton), 'weeks=8')
  assert.match(full, /<nav aria-label="계획표 보기" inert=""/)
  assert.match(full, /aria-checked="true"[^>]*><span class="block truncate">최근 8주/, '주소의 ?weeks=')
  assert.equal(count(full, /role="status"/g), 1)
  const src = readFileSync(join(__dirname, '..', 'GrowthSkeleton.tsx'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.ok(!/apiGet|fetch\(/.test(src), '자리표시는 데이터 요청 없음')
  assert.equal((src.match(/useSearchParams\(\)/g) ?? []).length, 1, 'useSearchParams 는 Suspense 안 부품 하나에서만')
})

test('오류 — 제목 h2(tabindex=-1, 다시 불러오기 뒤 초점 자리) · role=alert 한 줄 · [다시 불러오기] 버튼', () => {
  const html = renderToStaticMarkup(createElement(GrowthError, { onRetry: noop }))
  assert.match(html, /<h2 tabindex="-1"[^>]*>성장 기록을 불러오지 못했어요<\/h2><p role="alert"[^>]*>인터넷 연결을 확인하고 다시 불러와 주세요\. 기록은 안전해요\.<\/p><button type="button"[^>]*h-12[^>]*>다시 불러오기<\/button>/)
  const screen = readFileSync(join(__dirname, '..', 'GrowthScreen.tsx'), 'utf8')
  assert.match(screen, /window\.history\.replaceState\(null, '', url\)/, '기간은 주소에 replaceState(서버를 다시 부르지 않는다)')
  assert.match(screen, /querySelector<HTMLElement>\('\[role="radio"\]\[aria-checked="true"\]'\)\?\.focus\(\)/, '다시 불러오기 성공 → 고른 기간 라디오')
  assert.match(screen, /else errRef\.current\?\.focus\(\)/, '또 실패 → 오류 제목')
})
