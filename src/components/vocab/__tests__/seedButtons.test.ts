import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Segmented from '@/components/common/Segmented'
import { SEED_PACK_COUNT, SEED_PACK_LABEL, type SeedPack } from '@/types/seedPack'
import type { SeedLevels } from '../hooks'
import { fmtCount, JLPT_LEVELS, levelLabel, levelName, SEED_COPY } from '../labels'
import TodayWordsCard from '../TodayWordsCard'
import WordsEmpty from '../WordsEmpty'

const noop = () => {}
const lv = (status: SeedLevels['status'], main: SeedPack | null, goal: SeedPack | null = null): SeedLevels => ({ status, main, goal, retry: noop })
const decode = (html: string) => html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')

function emptyCard(levels: SeedLevels, seedingPack: SeedPack | null = null): string {
  return decode(
    renderToStaticMarkup(
      createElement(WordsEmpty, { variant: 'noWords', q: '', levels, seedingPack, onSeed: noop, onAdd: noop, onShowArchive: noop, onShowAll: noop }),
    ),
  )
}

function todayEmpty(levels: SeedLevels, seedingPack: SeedPack | null = null): string {
  return decode(
    renderToStaticMarkup(
      createElement(TodayWordsCard, {
        state: 'empty',
        loadError: null,
        dailyWordCount: 10,
        count: 10,
        mode: 'CHOICE',
        category: null,
        categories: [],
        archivedTotal: 0,
        todayDone: { sets: 0, correct: 0, cards: 0 },
        inProgress: null,
        today: '2026-10-10',
        poolEmptyKind: null,
        hasKept: false,
        starting: false,
        startError: null,
        levels,
        seedingPack,
        finishing: false,
        onCount: noop,
        onMode: noop,
        onCategory: noop,
        onStart: noop,
        onStartAll: noop,
        onBackToReady: noop,
        onFinish: noop,
        onShowResult: noop,
        onSeed: noop,
        onShowKept: noop,
        onRetry: noop,
      }),
    ),
  )
}

const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[0].slice(0, m[0].indexOf('>')), text: m[1].replace(/<[^>]+>/g, '') }))

test('빈 단어장 카드: 지금 수준 주 버튼(채움) → 목표 수준 보조(ghost) → 직접 추가, 이름·개수는 seedPack 에서', () => {
  const html = emptyCard(lv('ready', 'N2', 'N1'))
  const b = buttons(html)
  assert.deepEqual(
    b.map((x) => x.text),
    [SEED_COPY.mainBtn('N2'), SEED_COPY.goalBtn('N1'), '직접 추가'],
  )
  assert.ok(b[0].attrs.includes('bg-accent'), '주 버튼은 채움')
  assert.ok(!b[1].attrs.includes('bg-accent') && b[1].attrs.includes('border-line'), '보조는 ghost')
  assert.ok(b[1].attrs.includes('whitespace-normal') && b[1].attrs.includes('break-keep') && !b[1].attrs.includes('truncate'), '보조는 두 줄 허용')
  assert.ok(html.includes(`${SEED_PACK_LABEL.N2} 기본 단어 ${fmtCount(SEED_PACK_COUNT.N2)}개로 바로 시작하거나`))
  assert.doesNotMatch(html, /원어민|N5 기초|50개/)
})

test('목표 수준이 없거나 같으면 보조 버튼 없음 · 단계를 모르면 넣기 버튼 숨김', () => {
  assert.equal(buttons(emptyCard(lv('ready', 'N5'))).length, 2)
  // 읽기 실패: 넣기 버튼 대신 「다시 시도」 글자 버튼이 [직접 추가] 위에.
  const err = emptyCard(lv('error', null))
  assert.deepEqual(
    buttons(err).map((x) => x.text),
    [SEED_COPY.levelRetry, '직접 추가'],
  )
  assert.ok(err.includes(SEED_COPY.emptyBodyNoLevel) && !err.includes('기본 단어'))
  assert.ok(buttons(err)[0].attrs.includes('min-h-[44px]') && buttons(err)[0].attrs.includes('text-[13px]'))
  // 오늘 카드도 같은 규칙.
  const tErr = todayEmpty(lv('error', null))
  assert.ok(tErr.includes(SEED_COPY.todayBodyNoLevel) && tErr.includes(SEED_COPY.levelRetry) && !tErr.includes('넣기'))
})

test('넣는 중: 누른 버튼만 「넣는 중…」+aria-busy, 다른 넣기 버튼은 aria-disabled(disabled 속성 없음), 직접 추가는 그대로', () => {
  const b = buttons(emptyCard(lv('ready', 'N5', 'N4'), 'N4'))
  assert.equal(b[0].text, SEED_COPY.mainBtn('N5'))
  assert.ok(b[0].attrs.includes('aria-disabled="true"') && !b[0].attrs.includes('aria-busy'))
  assert.equal(b[1].text, SEED_COPY.busy)
  assert.ok(b[1].attrs.includes('aria-busy="true"'))
  assert.ok(!b[2].attrs.includes('aria-disabled'))
  for (const x of b) assert.ok(!/\sdisabled=""/.test(x.attrs))
})

test('오늘 카드 empty: 본문에 수준 이름, 주·보조 버튼, 단어 직접 추가 링크', () => {
  const html = todayEmpty(lv('ready', 'N4', 'N3'))
  assert.ok(html.includes(SEED_COPY.todayBody('N4')))
  assert.deepEqual(
    buttons(html).map((x) => x.text),
    [SEED_COPY.mainBtn('N4'), SEED_COPY.goalBtn('N3')],
  )
  assert.ok(html.includes('href="/drawer/words?add=1"') && html.includes('단어 직접 추가'))
})

test('Segmented 두 줄: 칸마다 이름·코드, 읽기 이름 「초보자 (N5)」, 없음 칸은 한 줄, 6칸이면 12.5px', () => {
  const opts = JLPT_LEVELS.map((v) => ({ value: v, label: levelName(v), sub: v, ariaLabel: levelLabel(v) }))
  const html = renderToStaticMarkup(createElement(Segmented, { ariaLabel: '지금 수준', twoLine: true, describedBy: 'levelHelp', options: opts, value: 'N3', onChange: noop }))
  assert.ok(html.includes('aria-describedby="levelHelp"'))
  for (const v of JLPT_LEVELS) assert.ok(html.includes(`aria-label="${SEED_PACK_LABEL[v]}"`), v)
  assert.equal((html.match(/h-12/g) ?? []).length, 5)
  assert.ok(html.includes('text-[13px]') && !html.includes('text-[12.5px]'))
  assert.ok(html.includes('aria-checked="true"') && html.includes('font-semibold'))
  const goal = renderToStaticMarkup(
    createElement(Segmented, { ariaLabel: '목표 수준', twoLine: true, options: [{ value: 'NONE', label: '없음', ariaLabel: '없음' }, ...opts], value: 'NONE', onChange: noop }),
  )
  assert.ok(goal.includes('text-[12.5px]') && goal.includes('aria-label="없음"'))
  assert.equal((goal.match(/text-\[11px\]/g) ?? []).length, 5, '「없음」 칸은 아래 줄 없음')
  // 한 줄 사용처는 그대로(aria-label·describedby 를 내지 않는다).
  const one = renderToStaticMarkup(createElement(Segmented, { ariaLabel: '방식', options: [{ value: 'A', label: '가' }], value: 'A', onChange: noop }))
  assert.ok(!one.includes('aria-describedby') && !one.includes('aria-label="가"') && one.includes('h-9'))
})
