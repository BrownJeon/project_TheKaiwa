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
import { BLOCKED_FACE, BUSY_FACE, ctaClass, DayGlyph, PartialMark, TaskRows } from '../parts'

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

test('만들기 막힘은 보이게 구분한다 — [다음]·[챌린지 시작]·장수 칩은 aria-disabled + 면 클래스(글자는 토큰 유지)', () => {
  assert.deepEqual(ctaClass(false).split(' '), ['w-full', ...BLOCKED_FACE.split(' ')])
  assert.deepEqual(ctaClass(true).split(' '), ['w-full', ...BUSY_FACE.split(' ')])

  const blocked = renderToStaticMarkup(createElement(Btn, { className: ctaClass(false), 'aria-disabled': true }, CREATE.next))
  assert.ok(blocked.includes('aria-disabled="true"') && blocked.includes('aria-disabled:bg-surface2') && blocked.includes('aria-disabled:text-ink2'))
  const busy = renderToStaticMarkup(createElement(Btn, { className: ctaClass(true), 'aria-disabled': true }, CREATE.starting))
  assert.ok(busy.includes('aria-disabled="true"') && busy.includes('aria-disabled:bg-accent-soft') && busy.includes('aria-disabled:text-ink'))

  // 표현 12개 주제 — 15장 칸만 막힘(이유 문장 id 연결), 고를 수 있는 칸은 aria-disabled 가 없어 면이 바뀌지 않는다.
  const pills = renderToStaticMarkup(createElement(ChoicePills, { label: CREATE.countLabel, options: wordCountOptions(12).options, value: 10, onChange: () => {}, reasonId: 'why' }))
  const btn = (n: number) => pills.match(new RegExp(`<button[^>]*>${n}(?:<!-- -->)?장</button>`))?.[0] ?? ''
  assert.ok(btn(15).includes('aria-disabled="true"') && btn(15).includes('aria-describedby="why"') && btn(15).includes(BLOCKED_FACE))
  for (const n of [5, 10]) assert.ok(btn(n) && !btn(n).includes('aria-disabled="true"'), String(n))
})

// 막힘·보내는 중의 면은 글자까지 옅어지는 `opacity` 로 만들지 않는다 — 라벨 대비가 1.4~2.9:1 까지 떨어졌다(qa-p2a #3).
test('막힘·보내는 중 면 클래스는 opacity 0건, 모두 aria-disabled: 한정, 색은 토큰만', () => {
  for (const face of [BLOCKED_FACE, BUSY_FACE]) {
    const classes = face.split(' ')
    assert.ok(classes.length >= 4)
    for (const c of classes) {
      assert.ok(c.startsWith('aria-disabled:'), `${c} — 막히지 않은 상태에 영향이 없어야 한다`)
      assert.ok(!/opacity/.test(c), `${c} — 버튼 전체 불투명도 금지`)
      assert.ok(!/#[0-9a-f]{3,6}\b|rgb\(|\[/i.test(c), `${c} — 토큰만`)
    }
  }
  const files = readdirSync(join(process.cwd(), 'src/components/challenge')).filter((n) => /\.tsx?$/.test(n))
  assert.ok(files.length >= 10)
  for (const n of files) {
    const src = readFileSync(join(process.cwd(), 'src/components/challenge', n), 'utf8')
    assert.ok(!/(^|[\s'"`:])opacity-\d+/.test(src), `${n} — 챌린지 화면 버튼에 opacity-N 을 쓰지 않는다(글자까지 옅어짐)`)
  }
})

// 라벨 대비 ≥ 3:1 — 면 클래스가 가리키는 토큰의 실제 색값(globals.css 라이트·다크)으로 계산한다(WCAG 상대 휘도).
test('막힘·보내는 중 라벨 대비는 라이트·다크 모두 3:1 이상', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
  const block = (re: RegExp): Record<string, string> => {
    const m = re.exec(css)
    assert.ok(m, String(re))
    return Object.fromEntries([...m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1], x[2]]))
  }
  const light = block(/:root\s*\{([^}]*)\}/)
  const dark = { ...light, ...block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/) }
  const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  const lum = (hex: string) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16))
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  for (const face of [BLOCKED_FACE, BUSY_FACE]) {
    const bg = /aria-disabled:bg-([a-z0-9-]+)/.exec(face)?.[1]
    const fg = /aria-disabled:text-([a-z0-9-]+)/.exec(face)?.[1]
    assert.ok(bg && fg, face)
    for (const [scheme, t] of [['light', light], ['dark', dark]] as const) {
      assert.ok(t[bg] && t[fg], `${scheme} ${bg}/${fg} 토큰`)
      assert.ok(ratio(t[fg], t[bg]) >= 3, `${scheme} ${fg} on ${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`)
    }
  }
})
