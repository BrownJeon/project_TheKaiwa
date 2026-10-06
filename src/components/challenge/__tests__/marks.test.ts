import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Btn } from '@/components/common/ui'
import { CalendarLegend } from '@/components/plan/CalendarSection'
import { Chip } from '@/components/plan/parts'
import type { ChallengeDay, DayChallenge } from '@/types/challenge'
import { ChallengeDayLine } from '../ChallengePlanCard'
import { COPY, CREATE, DAY_VIEW, STRIP_LEGEND } from '../challengeCopy'
import { ChoicePills } from '../createParts'
import { DayStrip } from '../DayStrip'
import { daySheetView, ruleLines, taskRowView, wordCountOptions } from '../logic'
import { BLOCKED_DIM, ctaClass, DayGlyph, PartialMark, TaskRows } from '../parts'

// 반원 글자(U+25D0) — 기기 글꼴에 따라 작은 점·빈 네모로 보여 화면에 쓰지 않는다(REV-122 M-5).
const HALF = String.fromCodePoint(0x25d0)
const MARK = 'data-mark="partial"'
const GOAL = { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 }
const day = (over: Partial<ChallengeDay> = {}): ChallengeDay => ({ date: '2026-10-05', dayIndex: 3, state: 'PARTIAL', goalMetAt: null, lesson: null, words: null, ...over })

test('일부 모양은 글꼴 비의존 SVG — 원 테두리 + 왼쪽 절반 채움(currentColor), 읽기에서 숨김', () => {
  const svg = renderToStaticMarkup(createElement(PartialMark))
  assert.match(svg, /^<svg [^>]*viewBox="0 0 16 16"/)
  assert.ok(svg.includes('width="1em"') && svg.includes('height="1em"'))
  assert.ok(svg.includes('aria-hidden="true"') && svg.includes('focusable="false"') && svg.includes(MARK))
  assert.match(svg, /<circle [^>]*fill="none"[^>]*stroke="currentColor"/)
  assert.match(svg, /<path d="M8 1\.5a6\.5 6\.5 0 0 0 0 13z" fill="currentColor"/)
  assert.ok(!/#[0-9a-f]{3,6}\b|rgb\(/i.test(svg), '새 색 없음(currentColor 만)')
})

test('달력 칩·하루 줄·날짜 띠·범례·할 일 줄·시트 배지·규칙에 반원 글자가 남지 않고 그림이 나온다', () => {
  // 달력 17px 칩 — 일부만 그림, 달성·놓침은 글자 그대로.
  const chip = renderToStaticMarkup(createElement(Chip, { mark: { kind: 'ch', state: 'PARTIAL' } }))
  assert.ok(chip.includes(MARK) && chip.includes('h-[17px]') && chip.includes('bg-warn-soft') && !chip.includes(HALF))
  const metChip = renderToStaticMarkup(createElement(Chip, { mark: { kind: 'ch', state: 'MET' } }))
  assert.ok(metChip.includes('✓') && !metChip.includes('<svg'))
  assert.ok(renderToStaticMarkup(createElement(Chip, { mark: { kind: 'ch', state: 'MISSED' } })).includes('✕'))

  // 달력 범례(챌린지 4항목).
  const legend = renderToStaticMarkup(createElement(CalendarLegend, { showChallenge: true }))
  assert.ok(legend.includes(MARK) && legend.includes('일부') && !legend.includes(HALF))

  // 상세 모양 원(sm·md·lg) — 모두 그림.
  for (const size of ['sm', 'md', 'lg'] as const) {
    const g = renderToStaticMarkup(createElement(DayGlyph, { state: 'PARTIAL', size }))
    assert.ok(g.includes(MARK) && !g.includes(HALF), size)
  }

  // 달력 하루 시트의 챌린지 줄.
  const dc: DayChallenge = { challengeId: 'ch1', title: '카페 주문 7일 챌린지', dayIndex: 3, state: 'PARTIAL', lesson: null, words: { correct: 3, wrong: 1, skipped: 6, cardCount: 10, ok: false, need: 8 } }
  const line = renderToStaticMarkup(createElement(ChallengeDayLine, { challenge: dc, date: '2026-10-05', need: 8, onOpen: () => {} }))
  assert.ok(line.includes(MARK) && line.includes('챌린지 3일째 — 일부') && !line.includes(HALF))

  // 날짜 띠(칸 + 아래 범례 "일부 = …" 앞 그림).
  const strip = renderToStaticMarkup(
    createElement(DayStrip, { days: [day({ state: 'MET', dayIndex: 1, date: '2026-10-03' }), day(), day({ state: 'TODAY', dayIndex: 4, date: '2026-10-06' })], lengthDays: 7, todayIndex: 4, onOpen: () => {} }),
  )
  assert.equal(strip.split(MARK).length - 1, 2, '칸 1 + 범례 1')
  assert.ok(strip.includes(STRIP_LEGEND.PARTIAL) && !strip.includes(HALF))
  assert.match(strip, /tabindex="0"[^>]*data-strip="2026-10-06"|data-strip="2026-10-06"[^>]*tabindex="0"/)

  // 오늘 할 일 "덜 함" 줄.
  const short = taskRowView({ kind: 'WORDS', state: 'SHORT', sessionId: null, wordCount: 10, minAnswered: 8, answered: 4, sets: 1 })
  const rows = renderToStaticMarkup(createElement(TaskRows, { rows: [short] }))
  assert.ok(rows.includes(MARK) && rows.includes('덜 함: 오늘의 단어') && !rows.includes(HALF))

  // 하루 시트 단어 배지 — 글은 "덜 풂 · n/m장", 모양은 그림 표시(`half`).
  const sheet = daySheetView(day({ words: { sets: 1, correct: 3, wrong: 1, skipped: 6, cardCount: 10, answered: 4, need: 8, ok: false, sessionId: 'vs1', refExists: true } }), {
    goal: GOAL,
    topicTitle: '카페 주문',
    finished: false,
    stopDay: null,
    todayCounts: null,
  })
  assert.deepEqual(sheet.rows[0].badge, { tone: 'neutral', text: '덜 풂 · 4/8장', half: true })

  // 규칙 첫 줄은 그림을 사이에 끼워 그린다.
  assert.ok(COPY.ruleLegend.before.startsWith('✓ 달성') && COPY.ruleLegend.after.startsWith('일부 = ') && COPY.ruleLegend.after.includes('✕ 놓침'))
  assert.ok(!ruleLines(GOAL).some((l) => l.includes(HALF)))

  // 화면 문구 단일 출처 전체에도 없음.
  const values: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') values.push(v)
    else if (typeof v === 'function') walk((v as (...a: unknown[]) => unknown)('주제', 12, 10))
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  ;[COPY, CREATE, DAY_VIEW, STRIP_LEGEND].forEach(walk)
  assert.ok(!values.some((s) => s.includes(HALF)))
})

test('챌린지·계획표 화면 소스(테스트 제외)에 반원 글자 0', () => {
  const roots = ['src/components/challenge', 'src/components/plan', 'src/app/(app)/plan'].map((r) => join(process.cwd(), r))
  const files: string[] = []
  const collect = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') collect(p)
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  roots.forEach(collect)
  assert.ok(files.length >= 15)
  assert.deepEqual(
    files.filter((f) => readFileSync(f, 'utf8').includes(HALF)),
    [],
  )
})

test('만들기 막힘은 보이게 흐린다 — [다음]·[챌린지 시작]·장수 칩은 aria-disabled + 흐림 클래스', () => {
  assert.equal(BLOCKED_DIM, 'aria-disabled:opacity-40')
  assert.deepEqual(ctaClass(false).split(' '), ['w-full', 'aria-disabled:opacity-40'])
  assert.deepEqual(ctaClass(true).split(' '), ['w-full', 'opacity-70'])

  const blocked = renderToStaticMarkup(createElement(Btn, { className: ctaClass(false), 'aria-disabled': true }, CREATE.next))
  assert.ok(blocked.includes('aria-disabled="true"') && blocked.includes('aria-disabled:opacity-40'))

  // 표현 12개 주제 — 15장 칸만 막힘(이유 문장 id 연결), 고를 수 있는 칸은 aria-disabled 가 없어 흐려지지 않는다.
  const pills = renderToStaticMarkup(createElement(ChoicePills, { label: CREATE.countLabel, options: wordCountOptions(12).options, value: 10, onChange: () => {}, reasonId: 'why' }))
  const btn = (n: number) => pills.match(new RegExp(`<button[^>]*>${n}(?:<!-- -->)?장</button>`))?.[0] ?? ''
  assert.ok(btn(15).includes('aria-disabled="true"') && btn(15).includes('aria-describedby="why"') && btn(15).includes(BLOCKED_DIM))
  for (const n of [5, 10]) assert.ok(btn(n) && !btn(n).includes('aria-disabled="true"'), String(n))
})
