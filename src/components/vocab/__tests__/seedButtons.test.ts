/**
 * task-068 §28-9 T21 — 기본 단어 넣기 UI 는 어디에도 없다(D7 폐지 · §28-6 A). 기본 단어는 공용 읽기 전용 행이라 넣는 단계가 없다.
 * 이 파일은 task-051 의 「넣기 버튼」 시험이었다 — 같은 자리(빈 단어장 카드·오늘 카드·추가 시트)에 버튼이 없음을 지킨다.
 * 끝의 Segmented 두 줄 시험(설정 「지금 수준」)은 그대로 둔다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Segmented from '@/components/common/Segmented'
import { SEED_PACK_LABEL } from '@/types/seedPack'
import { JLPT_LEVELS, levelHelpText, levelLabel, levelName, todayLevelLine, WORDS_EMPTY_COPY } from '../labels'
import TodayWordsCard from '../TodayWordsCard'
import type { WordsEmptyVariant } from '../validate'
import WordsEmpty from '../WordsEmpty'

const noop = () => {}
const decode = (html: string) => html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
const SEED_BTN = /넣기<\/|한 번에 넣기|기본 단어 [\d,]+개 (한 번에 )?넣기|넣는 중/

function emptyCard(variant: WordsEmptyVariant): string {
  return decode(
    renderToStaticMarkup(
      createElement(WordsEmpty, { variant, q: '映', chunk: 'ACTION', category: '여행', onAdd: noop, onShowArchive: noop, onShowAll: noop, onClearChunk: noop }),
    ),
  )
}

function today(state: 'empty' | 'ready', myLevel: 'N5' | 'N3' | null = 'N5'): string {
  return decode(
    renderToStaticMarkup(
      createElement(TodayWordsCard, {
        state,
        loadError: null,
        dailyWordCount: 10,
        count: 10,
        category: null,
        categories: [],
        archivedTotal: 0,
        todayDone: { sets: 0, correct: 0, cards: 0 },
        inProgress: null,
        today: '2026-10-14',
        poolEmptyKind: null,
        hasKept: false,
        starting: false,
        startError: null,
        finishing: false,
        myLevel,
        onCount: noop,
        onCategory: noop,
        onStart: noop,
        onStartAll: noop,
        onBackToReady: noop,
        onFinish: noop,
        onShowResult: noop,
        onShowKept: noop,
        onRetry: noop,
      }),
    ),
  )
}

const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[0].slice(0, m[0].indexOf('>')), text: m[1].replace(/<[^>]+>/g, '') }))
const VARIANTS: WordsEmptyVariant[] = ['noWords', 'allArchived', 'noSearch', 'noSearchChunk', 'noChunk', 'noCategory', 'noArchived', 'noMine']

test('T21 빈 단어장 카드(모든 경우): 넣기 단추 0 · 비었으면 [단어 직접 추가](채움) 하나', () => {
  for (const v of VARIANTS) {
    const h = emptyCard(v)
    assert.doesNotMatch(h, SEED_BTN, v)
    for (const b of buttons(h)) assert.equal(/넣기$/.test(b.text.trim()), false, `${v}: ${b.text}`)
  }
  const none = emptyCard('noWords')
  const b = buttons(none)
  assert.deepEqual(
    b.map((x) => x.text),
    [WORDS_EMPTY_COPY.addBtn],
  )
  assert.ok(b[0].attrs.includes('bg-accent') && b[0].attrs.includes('w-full'), '채움 · 전체 폭')
  assert.ok(none.includes('단어장이 비어 있어요') && none.includes(WORDS_EMPTY_COPY.noWordsBody))
  assert.equal(none.includes('기본 단어'), false)
})

test('새 noMine · noSearchChunk(J6) 빈 화면', () => {
  const m = emptyCard('noMine')
  assert.ok(m.includes(WORDS_EMPTY_COPY.noMineTitle) && m.includes(WORDS_EMPTY_COPY.noMineBody))
  assert.deepEqual(
    buttons(m).map((x) => x.text),
    [WORDS_EMPTY_COPY.addBtn],
  )
  const sc = emptyCard('noSearchChunk')
  assert.deepEqual(
    buttons(sc).map((x) => x.text),
    ['‘映’ 추가하기', '조각 전체에서 찾기'],
  )
  assert.ok(sc.includes('액션 조각 · 여행 안에서 찾았어요.'))
})

test('T21 오늘 카드 empty: 넣기 단추 0 · [단어 직접 추가] 채운 링크 하나 · 본문 「오늘의 단어는 내 단어장에서 골라요.」', () => {
  const h = today('empty')
  assert.doesNotMatch(h, SEED_BTN)
  assert.equal(buttons(h).length, 0)
  assert.ok(h.includes(WORDS_EMPTY_COPY.todayEmptyBody))
  const link = h.match(/<a [^>]*href="\/drawer\/words\?add=1"[^>]*>([^<]*)<\/a>/)
  assert.ok(link && link[1] === WORDS_EMPTY_COPY.addBtn)
  assert.ok(link![0].includes('bg-accent') && link![0].includes('text-on-accent'), '채운 버튼 모양')
  assert.equal(h.includes(todayLevelLine('N5')), false, 'J13 줄은 준비 카드에만')
})

test('J13 오늘 카드 준비: [시작하기] 아래 「지금 수준(…) 단어가 가장 많이 나와요.」 · 수준을 모르면 없음', () => {
  const h = today('ready', 'N3')
  assert.ok(h.includes(`지금 수준(${levelLabel('N3')}) 단어가 가장 많이 나와요.`))
  assert.ok(h.indexOf('시작하기') < h.indexOf('지금 수준('))
  assert.equal(today('ready', null).includes('지금 수준('), false)
})

test('T21 추가 시트 · 설정 도움말: 넣기 줄 없음(소스·문구)', () => {
  const sheet = readFileSync(join(process.cwd(), 'src/components/vocab/WordAddSheet.tsx'), 'utf8')
  assert.equal(/SeedTextBtn|SEED_COPY|levels\.main|onSeed|seedingPack|<hr/.test(sheet), false)
  assert.equal(levelHelpText().includes('넣기'), false, 'L5')
  assert.ok(levelHelpText().includes('오늘의 단어'))
})

/** `src/**`(시험 제외)의 .ts/.tsx — T21 소스 스캔 대상. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      sourceFiles(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

test('T21 U2 화면 파일에 넣기 부품·훅·문구 0', () => {
  const mine = ['WordsEmpty.tsx', 'TodayWordsCard.tsx', 'TodayHome.tsx', 'WordAddSheet.tsx', 'WordDetailSheet.tsx', 'WordForm.tsx', 'WordRow.tsx', 'validate.ts', 'WordChunkPicker.tsx']
  for (const f of mine) {
    const s = readFileSync(join(process.cwd(), 'src/components/vocab', f), 'utf8')
    assert.equal(/seed-pack|useSeedPack|useSeedLevels|SeedPackButtons|SeedTextBtn|seedResultText|SEED_COPY|SeedLevels/.test(s), false, f)
  }
})

test('T21 src 전체(시험 제외): seed-pack 호출·넣기 훅·부품·문구 0 · #46b 라우트 폴더 없음 — U1 단계 5·S-B 삭제 뒤 통과', () => {
  const root = join(process.cwd(), 'src')
  const hits: string[] = []
  for (const f of sourceFiles(root)) {
    const s = readFileSync(f, 'utf8')
    const m = s.match(/seed-pack|useSeedPack|useSeedLevels|SeedPackButtons|SeedTextBtn|seedResultText|SEED_COPY/)
    if (m) hits.push(`${f.slice(root.length + 1)}: ${m[0]}`)
  }
  assert.deepEqual(hits, [])
  assert.equal(existsSync(join(root, 'app/api/v1/words/seed-pack')), false)
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
