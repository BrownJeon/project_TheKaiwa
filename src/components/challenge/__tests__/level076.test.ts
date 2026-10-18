import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChallengeDailyGoal, ChallengeStats, ChallengeSummary } from '@/types/challenge'
import type { JlptLevel, Topic } from '@/types/lesson'
import { SEED_PACK_LABEL } from '@/types/seedPack'
import ChallengePlanCard from '../ChallengePlanCard'
import { COPY, CREATE } from '../challengeCopy'
import { ConfirmLevelValue, LevelCompareLine, LevelPills, LevelText, TopicLevelsBody, TopicRadioCard } from '../createParts'
import {
  EMPTY_DRAFT,
  confirmLevelNote,
  createBody,
  levelCompareGroups,
  levelCompareText,
  levelHint,
  levelHintText,
  levelPillSr,
  parseDraft,
  planLevelText,
  selectedLevel,
  serializeDraft,
  type Draft,
} from '../logic'

/**
 * task-076 화면 A(screens.md §33 · 승인 데모 v2) — 챌린지 만들기 ③ 난이도 · ④ 확인 「난이도」 줄 · ① 주제 뱃지·설명 · 계획표 카드 부제.
 * 순수 로직은 동작으로, 화면 조각은 렌더 결과로 확인한다. 소스 읽기는 배선(어디에 무엇이 붙었는지)에만 쓴다.
 */

// 쉬운 쪽 → 어려운 쪽(N5 → N1). 단계 차이는 이 배열의 위치 차이다.
const ORDER: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const nowrapSpans = (html: string) => [...html.matchAll(/<span class="whitespace-nowrap">(.*?)<\/span>/g)].map((m) => text(m[1]))
const topic = (level: JlptLevel, over: Partial<Topic> = {}): Topic => ({
  id: `t_${level}`,
  title: '카페 주문',
  titleJa: 'カフェで注文',
  level,
  description: null,
  tags: [],
  isSeed: true,
  chunks: [],
  lessonCount: 0,
  lastLessonAt: null,
  ...over,
})

test('표기 정본: 화면이 그리는 「이름 (코드)」는 SEED_PACK_LABEL 과 바이트 일치(한 덩어리 span) — 다섯 단계 전부', () => {
  for (const l of ORDER) {
    const label = SEED_PACK_LABEL[l]
    assert.equal(renderToStaticMarkup(createElement(LevelText, { level: l })), `<span class="whitespace-nowrap">${label}</span>`)
    assert.equal(planLevelText(l), `난이도 ${label}`)
    assert.ok(levelPillSr(l, { my: null, goal: null, topic: l }).startsWith(`${label}, `))
    assert.deepEqual(levelCompareGroups({ my: l, goal: l, topic: l }).map((g) => g.label), [label, label, label])
  }
})

test('이름+코드 바로 뒤에 조사가 붙지 않는다 — 새 문구 전부(②단계 비교·④ 작은 글·① 설명·계획표 부제)', () => {
  const PARTICLE_AFTER = /\((N[1-5])\)[가-힣]/
  const all: string[] = []
  for (const a of ORDER)
    for (const b of ORDER) {
      all.push(levelCompareText(levelCompareGroups({ my: a, goal: b, topic: a })))
      const n = confirmLevelNote(a, b)
      all.push(n.head + (n.topicLabel ?? ''))
      all.push(levelPillSr(a, { my: a, goal: b, topic: b }))
    }
  for (const l of ORDER) all.push(planLevelText(l))
  all.push(text(renderToStaticMarkup(createElement(TopicLevelsBody, { levels: ORDER }))))
  for (const s of all) assert.ok(!PARTICLE_AFTER.test(s), s)
})

test('보이는 선택(D9 A): 손대지 않으면 주제 난이도, 주제를 바꾸면 따라감 / 고른 값은 주제를 바꿔도 유지', () => {
  const untouched: Pick<Draft, 'level'> = { level: null }
  assert.equal(selectedLevel(untouched, topic('N4')), 'N4')
  assert.equal(selectedLevel(untouched, topic('N2')), 'N2', '주제 변경 → 새 주제 난이도')
  const picked: Pick<Draft, 'level'> = { level: 'N3' }
  assert.equal(selectedLevel(picked, topic('N4')), 'N3')
  assert.equal(selectedLevel(picked, topic('N1')), 'N3', '고른 값 유지')
  // 주제 난이도와 같은 값을 골라도 「고른 값」 — 다른 주제로 바꾸면 그대로 남는다.
  assert.equal(selectedLevel({ level: 'N4' }, topic('N2')), 'N4')
  assert.equal(selectedLevel(untouched, null), null)
  assert.equal(EMPTY_DRAFT.level, null)
})

test('초안: level 왕복 · task-076 전 초안(칸 없음)과 잘못된 값은 null(= 주제 난이도)', () => {
  const d: Draft = { ...EMPTY_DRAFT, topicId: 'topic_1', level: 'N2' }
  assert.deepEqual(parseDraft(serializeDraft(d)), d)
  assert.equal(parseDraft(serializeDraft({ ...d, level: null }))?.level, null)
  const old = JSON.stringify({ v: 1, topicId: 'topic_1', lengthDays: 14, lesson: true, words: false, wordCount: null, start: 'TOMORROW' })
  const parsed = parseDraft(old)
  assert.ok(parsed)
  assert.equal(parsed.level, null)
  assert.equal(parsed.lengthDays, 14)
  assert.equal(parsed.start, 'TOMORROW')
  for (const bad of ['N6', 'n3', 3, ['N3'], { l: 'N3' }, ''])
    assert.equal(parseDraft(JSON.stringify({ v: 1, topicId: 'topic_1', level: bad }))?.level, null, JSON.stringify(bad))
})

test('안내 줄 규칙(D8 A) 전수 — 내 수준 5 × 고른 값 5: 2단계 이상 위 = 「n단계 어려워요」, 아래 = 「쉬워요」, 같음·1단계 위 = 비움', () => {
  // 단계 차이(고른 값 − 내 수준) → 기대 문구.
  const EXPECT: Record<number, string> = {
    [-4]: '내 수준보다 쉬워요. 복습하듯 가볍게 할 수 있어요.',
    [-3]: '내 수준보다 쉬워요. 복습하듯 가볍게 할 수 있어요.',
    [-2]: '내 수준보다 쉬워요. 복습하듯 가볍게 할 수 있어요.',
    [-1]: '내 수준보다 쉬워요. 복습하듯 가볍게 할 수 있어요.',
    0: '',
    1: '',
    2: '내 수준보다 2단계 어려워요. 처음엔 모르는 말이 많을 수 있어요.',
    3: '내 수준보다 3단계 어려워요. 처음엔 모르는 말이 많을 수 있어요.',
    4: '내 수준보다 4단계 어려워요. 처음엔 모르는 말이 많을 수 있어요.',
  }
  let n = 0
  for (const [mi, my] of ORDER.entries())
    for (const [si, sel] of ORDER.entries()) {
      assert.equal(levelHintText(levelHint(sel, my)), EXPECT[si - mi], `내 수준 ${my} · 고름 ${sel}`)
      n++
    }
  assert.equal(n, 25)
  assert.deepEqual(levelHint('N2', 'N4'), { kind: 'high', steps: 2 })
  assert.deepEqual(levelHint('N5', 'N4'), { kind: 'low' })
  // 내 수준을 모르면 안내 없음(고르기는 그대로 된다).
  for (const sel of ORDER) assert.equal(levelHintText(levelHint(sel, null)), '')
})

test('비교 줄(D3 A): 목표 있음·없음·내 수준 모름 — 묶음 순서 내 수준 → 내 목표 → 이 주제', () => {
  assert.equal(levelCompareText(levelCompareGroups({ my: 'N4', goal: 'N3', topic: 'N4' })), '내 수준 초급 (N4) · 내 목표 중급 (N3) · 이 주제 초급 (N4)')
  assert.equal(levelCompareText(levelCompareGroups({ my: 'N4', goal: null, topic: 'N4' })), '내 수준 초급 (N4) · 이 주제 초급 (N4)')
  assert.equal(levelCompareText(levelCompareGroups({ my: null, goal: 'N1', topic: 'N5' })), '내 목표 최상급 (N1) · 이 주제 초보자 (N5)')
  assert.equal(levelCompareText(levelCompareGroups({ my: null, goal: null, topic: 'N2' })), '이 주제 고급 (N2)')
})

test('비교 줄 렌더: 묶음마다 nowrap span 하나(「… ·」 포함), 묶음 사이에서만 줄바꿈 — 목표 없으면 그 묶음만 빠짐', () => {
  const html = renderToStaticMarkup(createElement(LevelCompareLine, { id: 'cmp', groups: levelCompareGroups({ my: 'N5', goal: 'N1', topic: 'N4' }) }))
  assert.match(html, /^<p id="cmp" /)
  assert.deepEqual(nowrapSpans(html), ['내 수준 초보자 (N5) ·', '내 목표 최상급 (N1) ·', '이 주제 초급 (N4)'])
  assert.equal(text(html), '내 수준 초보자 (N5) · 내 목표 최상급 (N1) · 이 주제 초급 (N4)')
  const noGoal = renderToStaticMarkup(createElement(LevelCompareLine, { id: 'cmp', groups: levelCompareGroups({ my: 'N4', goal: null, topic: 'N4' }) }))
  assert.deepEqual(nowrapSpans(noGoal), ['내 수준 초급 (N4) ·', '이 주제 초급 (N4)'])
  assert.equal(text(noGoal), '내 수준 초급 (N4) · 이 주제 초급 (N4)')
})

test('알약 시각 숨김 글: 이름 (코드) + 맞는 꼬리말만(내 수준 → 내 목표 → 이 주제 기본)', () => {
  const ctx = { my: 'N4', goal: 'N3', topic: 'N4' } as const
  assert.equal(levelPillSr('N4', ctx), '초급 (N4), 내 수준, 이 주제 기본')
  assert.equal(levelPillSr('N3', ctx), '중급 (N3), 내 목표')
  assert.equal(levelPillSr('N1', ctx), '최상급 (N1)')
  assert.equal(levelPillSr('N2', { my: 'N2', goal: 'N2', topic: 'N2' }), '고급 (N2), 내 수준, 내 목표, 이 주제 기본')
  assert.equal(levelPillSr('N4', { my: null, goal: null, topic: 'N5' }), '초급 (N4)')
})

test('알약 렌더: native radio 5칸(N5 → N1, 같은 name, 고른 칸만 checked) · 보이는 두 줄은 낭독 숨김 · 칸 높이 48 · 이름 13/코드 11 ink2', () => {
  const picked: JlptLevel[] = []
  const html = renderToStaticMarkup(
    createElement(LevelPills, { name: 'lv', value: 'N3', ctx: { my: 'N4', goal: 'N3', topic: 'N4' }, onChange: (l: JlptLevel) => picked.push(l) }),
  )
  const radios = [...html.matchAll(/<input type="radio"[^>]*>/g)].map((m) => m[0])
  assert.equal(radios.length, 5)
  assert.deepEqual(radios.map((r) => /value="(N[1-5])"/.exec(r)?.[1]), ORDER)
  assert.ok(radios.every((r) => r.includes('name="lv"')))
  assert.deepEqual(radios.map((r) => r.includes('checked=""')), [false, false, true, false, false])
  assert.ok(!html.includes('role="radio"'), 'role=radio 버튼이 아니라 native radio')
  assert.equal((html.match(/min-h-12/g) ?? []).length, 5)
  for (const l of ORDER) {
    const name = SEED_PACK_LABEL[l].slice(0, -` (${l})`.length)
    assert.ok(html.includes(`<span aria-hidden="true" class="block max-w-full truncate text-[13px] leading-[1.2]">${name}</span>`), name)
    assert.ok(html.includes(`<span aria-hidden="true" class="block max-w-full truncate text-[11px] font-medium leading-[1.2] text-ink2">${l}</span>`), l)
  }
  const sr = [...html.matchAll(/<span class="sr-only">(.*?)<\/span>/g)].map((m) => m[1])
  assert.deepEqual(sr, ['초보자 (N5)', '초급 (N4), 내 수준, 이 주제 기본', '중급 (N3), 내 목표', '고급 (N2)', '최상급 (N1)'])
  assert.ok(html.includes('peer-checked:shadow-[inset_0_0_0_2px_var(--color-accent)]') && html.includes('peer-checked:font-bold'))
  assert.ok(html.includes('peer-focus-visible:outline-accent'))
  assert.ok(html.includes('grid-cols-5'))
})

test('#156 본문: 난이도를 늘 싣는다 — 손대지 않음 = 주제 난이도, 고름 = 고른 값(주제와 같아도)', () => {
  const goal = { lesson: true, words: true, wordCount: 10 as const }
  const base = { lengthDays: 7 as const, start: 'TODAY' as const }
  assert.deepEqual(createBody(topic('N4'), { ...base, level: null }, goal), {
    topicId: 't_N4',
    lengthDays: 7,
    start: 'TODAY',
    dailyGoal: { lesson: true, words: true, wordCount: 10 },
    level: 'N4',
  })
  assert.equal(createBody(topic('N4'), { ...base, level: 'N2' }, goal).level, 'N2')
  assert.equal(createBody(topic('N4'), { ...base, level: 'N4' }, goal).level, 'N4')
  // 단어를 끄면 장수는 빠진다(지금 동작 그대로).
  assert.deepEqual(createBody(topic('N5'), { ...base, level: 'N1' }, { lesson: true, words: false, wordCount: null }).dailyGoal, { lesson: true, words: false })
  // 저장 실패 뒤 다시 누르면 같은 초안 → 같은 값.
  const d: Draft = { ...EMPTY_DRAFT, topicId: 't_N4', level: 'N2' }
  const again = parseDraft(serializeDraft(d))
  assert.ok(again)
  assert.equal(createBody(topic('N4'), again, goal).level, 'N2')
})

test('④ 확인 「난이도」 줄: dd = 고른 「이름 (코드)」, 작은 글 = 「이 주제 기본」 / 「이 주제 기본은 {주제}」(한 덩어리)', () => {
  const diff = renderToStaticMarkup(createElement(ConfirmLevelValue, { level: 'N3', topicLevel: 'N4' }))
  assert.deepEqual(nowrapSpans(diff), ['중급 (N3)', '초급 (N4)'])
  assert.match(diff, /<small class="block text-\[12.5px\] text-ink2 break-keep">이 주제 기본은 <span class="whitespace-nowrap">초급 \(N4\)<\/span><\/small>/)
  assert.equal(text(diff), `중급 (N3)${CREATE.rowLevelDiff('초급 (N4)')}`)
  const same = renderToStaticMarkup(createElement(ConfirmLevelValue, { level: 'N4', topicLevel: 'N4' }))
  assert.deepEqual(nowrapSpans(same), ['초급 (N4)'])
  assert.equal(text(same), '초급 (N4)이 주제 기본')
  assert.deepEqual(confirmLevelNote('N1', 'N5'), { head: '이 주제 기본은 ', topicLabel: '초보자 (N5)' })
  assert.deepEqual(confirmLevelNote('N5', 'N5'), { head: '이 주제 기본', topicLabel: null })
})

test('① 설명(질문 5 a): 「…보여 드려요: 초보자 (N5) · 초급 (N4) · 중급 (N3). …」 — 각 이름 (코드)가 한 덩어리, 목록 모르면 「—」', () => {
  const html = renderToStaticMarkup(createElement(TopicLevelsBody, { levels: ['N5', 'N4', 'N3'] }))
  assert.equal(text(html), '내 수준에 맞는 주제를 보여 드려요: 초보자 (N5) · 초급 (N4) · 중급 (N3). 챌린지 동안 매일 이 주제로 공부해요.')
  assert.equal(text(html), CREATE.q1Body('초보자 (N5) · 초급 (N4) · 중급 (N3)'))
  assert.deepEqual(nowrapSpans(html), ['초보자 (N5)', '초급 (N4)', '중급 (N3)'])
  assert.equal(text(renderToStaticMarkup(createElement(TopicLevelsBody, { levels: [] }))), CREATE.q1Body('—'))
})

test('① 주제 카드 뱃지(질문 5 a) = 「초급 (N4)」 한 덩어리 — 코드만 보이지 않는다', () => {
  const html = renderToStaticMarkup(createElement(TopicRadioCard, { topic: topic('N4'), name: 'tp', checked: false, onSelect: () => {} }))
  assert.ok(nowrapSpans(html).includes('초급 (N4)'))
  assert.ok(!/>N4</.test(html), html)
})

test('계획표 카드 부제(D10 A): 「난이도 중급 (N3)」 · 날짜가 각각 한 덩어리', () => {
  const GOAL: ChallengeDailyGoal = { lesson: true, words: false, wordCount: null, wordsMinAnswered: null, countSkipped: false, ruleVersion: 1 }
  const STATS: ChallengeStats = { dayIndex: 2, elapsedDays: 1, metDays: 1, rate: 1, streak: 1, longestStreak: 1, todayMet: false }
  const c: ChallengeSummary = {
    id: 'ch1', title: '카페 주문 7일 챌린지', topic: { id: 't1', title: '카페 주문', exists: true }, level: 'N3', lengthDays: 7,
    startDate: '2026-10-18', endDate: '2026-10-24', status: 'ACTIVE', dailyGoal: GOAL, stats: STATS, endedAt: null,
  }
  const today = { date: '2026-10-19', dayIndex: 2, topic: { id: 't1', title: '카페 주문' }, tasks: [], goalMet: false }
  const html = renderToStaticMarkup(createElement(ChallengePlanCard, { status: 'ready', data: { challenge: c, today, recentlyEnded: null }, dailyWordCount: 10, onRetry: () => {} }))
  assert.ok(
    html.replace(/<!-- -->/g, '').includes('<p class="text-[12.5px] text-ink2"><span class="whitespace-nowrap">난이도 중급 (N3)</span> · <span class="whitespace-nowrap">10월 18일 ~ 10월 24일</span></p>'),
    html,
  )
  assert.equal(COPY.planLevel('X'), '난이도 X')
})

// ── 배선(소스) — 위치·속성만. 동작은 위 시험이 본다 ─────────────────────────────────────────────
const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (f: string) => strip(readFileSync(join(dir, f), 'utf8'))

test('배선: 난이도 이름을 챌린지 파일에 적지 않는다(이름은 labels → SEED_PACK_LABEL 에서만)', () => {
  const NAMES = /초보자|초급|중급|고급|최상급/
  for (const f of ['challengeCopy.ts', 'logic.ts', 'createParts.tsx', 'ChallengeCreateScreen.tsx', 'ChallengePlanCard.tsx']) {
    read(f)
      .split('\n')
      .forEach((line, i) => assert.ok(!NAMES.test(line), `${f}:${i + 1} ${line.trim().slice(0, 90)}`))
  }
})

test('배선: ③ 목표 단계 = h2 「목표를 정해요」(초점 headRef) → 난이도 fieldset(비교 줄 describedby · aria-live 안내) → 구분선 → 하루에 할 것 h3', () => {
  const src = read('ChallengeCreateScreen.tsx')
  const goal = src.slice(src.indexOf('function GoalStep('), src.indexOf('function ConfirmStep('))
  const at = (needle: string) => {
    const i = goal.indexOf(needle)
    assert.ok(i >= 0, needle)
    return i
  }
  assert.match(goal, /<h2 ref=\{headRef\} tabIndex=\{-1\}[^>]*>\s*\{CREATE\.q3Title\}\s*<\/h2>/)
  assert.match(goal, /<fieldset className="mt-3 min-w-0" aria-describedby=\{cmpId\}>/)
  assert.match(goal, /<h3 className="text-\[15px\] font-semibold">\{CREATE\.levelQ\}<\/h3>/)
  assert.match(goal, /<LevelCompareLine id=\{cmpId\}/)
  assert.match(goal, /<p aria-live="polite"[^>]*>\s*\{levelHintText\(levelHint\(sel, levelCtx\.my\)\)\}\s*<\/p>/)
  assert.ok(!/role="alert"|text-bad/.test(goal.slice(at('CREATE.levelQ'), at('mt-5 border-t'))), '안내 줄은 경고가 아니다')
  assert.match(goal, /<h3 className="text-\[15px\] font-semibold">\{CREATE\.q3\}<\/h3>/)
  assert.ok(at('CREATE.q3Title') < at('CREATE.levelQ'))
  assert.ok(at('CREATE.levelQ') < at('mt-5 border-t border-line pt-4'))
  assert.ok(at('mt-5 border-t border-line pt-4') < at('{CREATE.q3}</h3>'))
  assert.match(goal, /onChange=\{\(l\) => onChange\(\{ level: l \}\)\}/)
})

test('배선: ④ 확인 — 주제 줄에서 「· 코드」를 빼고 이름 → 주제 → 난이도 → 기간 → 하루 목표 / 다시 도전은 #157 level 을 초안에 / 본문은 createBody', () => {
  const src = read('ChallengeCreateScreen.tsx')
  const confirm = src.slice(src.indexOf('function ConfirmStep('))
  assert.ok(!/· \{topic\.level\}/.test(confirm))
  const order = ['CREATE.rowName', 'CREATE.rowTopic', 'CREATE.rowLevel', 'CREATE.rowLength', 'CREATE.rowGoal'].map((k) => confirm.indexOf(`{${k}}`))
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), String(order))
  assert.match(confirm, /<ConfirmLevelValue level=\{level\} topicLevel=\{topic\.level\} \/>/)
  assert.match(src, /level: isJlptLevel\(d\.level\) \? d\.level : null,/)
  assert.match(src, /const body = createBody\(topic, draft, goal\)/)
})
