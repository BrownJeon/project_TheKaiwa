/**
 * task-076 화면 B(screens.md §33 P6·P7·P10, 33-1a) — 오늘 탭 회화 뱃지 꼬리표·챌린지 단어 칩·「내 단어장 세트」 준비 줄.
 * 정답은 손으로 적은 문자열(데모 v2 `#copy`)과 `SEED_PACK_LABEL` 바이트 일치로 단언한다. 렌더 시험은 실제 컴포넌트에 연결됐는지,
 * 소스 확인은 배선(두 카드 모두·한 줄 고정·이름 하드코딩 없음)만 본다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { LEVEL_SRC, lessonLevelBadge, type LessonLevelSource } from '@/components/lesson/lessonCopy'
import TodayLessonCard from '@/components/lesson/TodayLessonCard'
import type { ChallengeSummary, ChallengeTodayResponse, ChallengeTodayTasks } from '@/types/challenge'
import type { JlptLevel, LessonRecommendation, TodayLessons } from '@/types/lesson'
import { SEED_PACK_LABEL } from '@/types/seedPack'
import { todayLevelLine } from '../labels'
import TodayWordsCard from '../TodayWordsCard'
import { WORDS_CARD } from '../topicCopy'
import { challengeCtxOf, mineSetChallengeLevel, type ChallengeCtx } from '../topicLogic'
import TopicWordsCard from '../TopicWordsCard'

const TODAY = '2026-10-07'
const LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const SOURCES: readonly LessonLevelSource[] = ['CHALLENGE', 'GOAL', 'LEVEL']
const noop = () => {}
const ROUTER = { push: noop, replace: noop, prefetch: noop, back: noop, forward: noop, refresh: noop }
const html = (el: ReactElement) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
    .replace(/<!-- -->/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const src = (...p: string[]) => strip(readFileSync(join(__dirname, '..', '..', ...p), 'utf8'))
/** 이름+코드 바로 뒤 조사(받침이 갈리는 문제, 33-1a). */
const PARTICLE_AFTER_LABEL = /\((N[1-5])\)[은는이가을를의와과도]/

// ── P6 회화 뱃지 ─────────────────────────────────────────────────────────────────────────────

test('P6 출처 꼬리표 표 — CHALLENGE 챌린지 · GOAL 내 목표 · LEVEL 내 수준(3칸 그대로)', () => {
  assert.deepEqual(LEVEL_SRC, { CHALLENGE: '챌린지', GOAL: '내 목표', LEVEL: '내 수준' })
})

test('P6 뱃지 글·낭독 — 손으로 적은 정답(데모 v2 문구 표)', () => {
  assert.deepEqual(lessonLevelBadge('N3', 'GOAL', 'N4'), { text: '중급 (N3) · 내 목표', sr: '수업 난이도 중급 (N3), 내 목표 기준' })
  assert.deepEqual(lessonLevelBadge('N3', 'CHALLENGE', 'N4'), { text: '중급 (N3) · 챌린지', sr: '수업 난이도 중급 (N3), 챌린지 기준' })
  assert.deepEqual(lessonLevelBadge('N4', 'LEVEL', 'N5'), { text: '초급 (N4) · 내 수준', sr: '수업 난이도 초급 (N4), 내 수준 기준' })
  assert.deepEqual(lessonLevelBadge('N1', 'GOAL', 'N2'), { text: '최상급 (N1) · 내 목표', sr: '수업 난이도 최상급 (N1), 내 목표 기준' })
  assert.deepEqual(lessonLevelBadge('N5', 'LEVEL', 'N5'), { text: '초보자 (N5) · 내 수준', sr: '수업 난이도 초보자 (N5), 내 수준 기준' })
})

test('P6 다섯 단계 × 출처 셋 — 이름+코드는 SEED_PACK_LABEL 바이트 일치, 뒤에 조사 없음, 주제 난이도(fallback)는 쓰지 않음', () => {
  for (const l of LEVELS) {
    for (const s of SOURCES) {
      const other: JlptLevel = l === 'N5' ? 'N1' : 'N5'
      const b = lessonLevelBadge(l, s, other)
      assert.equal(b.text, `${SEED_PACK_LABEL[l]} · ${LEVEL_SRC[s]}`, `${l} ${s}`)
      assert.equal(b.sr, `수업 난이도 ${SEED_PACK_LABEL[l]}, ${LEVEL_SRC[s]} 기준`, `${l} ${s} 낭독`)
      assert.ok(!b.text.includes(other) && !(b.sr ?? '').includes(other), `${l} ${s} — 수업 난이도(lessonLevel)만, 주제 난이도(level) 아님`)
      assert.doesNotMatch(`${b.text} ${b.sr}`, PARTICLE_AFTER_LABEL)
    }
  }
})

test('P6 서버가 T 를 못 정하면(lessonLevel·levelSource 하나라도 null/없음) 꼬리표 없이 주제 난이도(이름+코드)', () => {
  assert.deepEqual(lessonLevelBadge(null, null, 'N4'), { text: '초급 (N4)', sr: null })
  assert.deepEqual(lessonLevelBadge(undefined, undefined, 'N2'), { text: '고급 (N2)', sr: null }, '옛 응답(칸 없음)')
  assert.deepEqual(lessonLevelBadge('N3', null, 'N4'), { text: '초급 (N4)', sr: null }, '출처만 없음')
  assert.deepEqual(lessonLevelBadge(null, 'GOAL', 'N4'), { text: '초급 (N4)', sr: null }, '수준만 없음')
})

// ── P7 챌린지 단어 칩 ────────────────────────────────────────────────────────────────────────

test('P7 칩 — 「챌린지 · 중급 (N3) · 「카페 주문」」: 난이도를 주제 이름 앞에, 다섯 단계 바이트 일치', () => {
  assert.equal(WORDS_CARD.chip('카페 주문', 'N3'), '챌린지 · 중급 (N3) · 「카페 주문」')
  for (const l of LEVELS) {
    const c = WORDS_CARD.chip('긴 주제 이름으로 시험해 보는 주제', l)
    assert.equal(c, `챌린지 · ${SEED_PACK_LABEL[l]} · 「긴 주제 이름으로 시험해 보는 주제」`, l)
    assert.ok(c.indexOf(SEED_PACK_LABEL[l]) < c.indexOf('「'), `${l} — 말줄임에 잘리지 않게 난이도가 먼저`)
    assert.doesNotMatch(c, PARTICLE_AFTER_LABEL)
  }
  assert.equal(WORDS_CARD.chip('카페 주문'), '챌린지 · 「카페 주문」', '난이도를 모르면 지금 모양')
  assert.equal(WORDS_CARD.chip('카페 주문', null), '챌린지 · 「카페 주문」')
})

// ── P10 내 단어장 세트 준비 줄 ───────────────────────────────────────────────────────────────

test('P10 준비 줄 — 챌린지 난이도가 오면 챌린지 문장, 없으면 지금 문장(기존 호출 1인자 호환)', () => {
  assert.equal(todayLevelLine('N4'), '지금 수준(초급 (N4)) 단어가 가장 많이 나와요.')
  assert.equal(todayLevelLine('N4', null), '지금 수준(초급 (N4)) 단어가 가장 많이 나와요.')
  assert.equal(todayLevelLine('N4', undefined), '지금 수준(초급 (N4)) 단어가 가장 많이 나와요.')
  assert.equal(todayLevelLine('N4', 'N3'), '챌린지 난이도(중급 (N3))까지의 단어가 주로 나와요.')
  assert.equal(todayLevelLine('N4', 'N4'), '챌린지 난이도(초급 (N4))까지의 단어가 주로 나와요.', '같은 단계여도 챌린지 중이면 챌린지 문장(가중 기준이 챌린지)')
  for (const l of LEVELS) {
    assert.equal(todayLevelLine('N5', l), `챌린지 난이도(${SEED_PACK_LABEL[l]})까지의 단어가 주로 나와요.`)
    assert.ok(!todayLevelLine('N5', l).includes('지금 수준'), `${l} — 챌린지 중에 「지금 수준」 문장 금지`)
  }
})

const summary = (over: Partial<ChallengeSummary> = {}): ChallengeSummary => ({
  id: 'ch1',
  title: '카페 주문 7일 챌린지',
  topic: { id: 'tp1', title: '카페 주문', exists: true },
  level: 'N3',
  lengthDays: 7,
  startDate: '2026-10-04',
  endDate: '2026-10-10',
  status: 'ACTIVE',
  dailyGoal: { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 },
  stats: { dayIndex: 4, elapsedDays: 3, metDays: 2, rate: 0.67, streak: 2, longestStreak: 2, todayMet: false },
  endedAt: null,
  ...over,
})
const tasks = (wordsState = 'TODO'): ChallengeTodayTasks =>
  ({
    date: TODAY,
    dayIndex: 4,
    topic: { id: 'tp1', title: '카페 주문' },
    tasks: [
      { kind: 'WORDS', state: wordsState, sessionId: null, wordCount: 10, minAnswered: 8, answered: 0, sets: 0 },
      { kind: 'LESSON', state: 'TODO', lessonId: null, jobId: null },
    ],
    goalMet: false,
  }) as unknown as ChallengeTodayTasks
const res = (s: Partial<ChallengeSummary> | null, t: ChallengeTodayTasks | null = tasks()): ChallengeTodayResponse => ({
  challenge: s === null ? null : summary(s),
  today: t,
  recentlyEnded: null,
})

test('P10 챌린지 난이도 판정(mineSetChallengeLevel) — 서버 「진행 중」(isChallengeInProgress)과 같은 표', () => {
  const rows: [string, ChallengeTodayResponse | null, string, JlptLevel | null][] = [
    ['응답 없음', null, TODAY, null],
    ['챌린지 없음', res(null, null), TODAY, null],
    ['기간 안', res({}), TODAY, 'N3'],
    ['다른 난이도', res({ level: 'N1' }), TODAY, 'N1'],
    ['마지막 날(종료일 = 오늘)', res({ endDate: TODAY }), TODAY, 'N3'],
    ['내일 시작(시작 전 포함 — 서버와 같음)', res({ startDate: '2026-10-08', endDate: '2026-10-14' }, null), TODAY, 'N3'],
    ['기간 지남·정산 전(ACTIVE)', res({ endDate: '2026-10-06' }, null), TODAY, null],
    ['다 함', res({ status: 'COMPLETED' }, null), TODAY, null],
    ['그만둠', res({ status: 'ENDED' }, null), TODAY, null],
    ['주제 지워짐', res({ topic: { id: null, title: '카페 주문', exists: false } }), TODAY, null],
    ['오늘을 모름', res({}), '', null],
  ]
  for (const [name, r, today, want] of rows) assert.equal(mineSetChallengeLevel(r, today), want, name)
  // 띠·카드 모드(기간 안만)와 다른 점 — 내일 시작이면 카드 모드는 없지만 준비 줄은 챌린지 문장(서버 가중이 이미 챌린지 기준).
  const tomorrow = res({ startDate: '2026-10-08', endDate: '2026-10-14' }, null)
  assert.equal(challengeCtxOf(tomorrow), null)
  assert.equal(mineSetChallengeLevel(tomorrow, TODAY), 'N3')
})

// ── 렌더(실제 컴포넌트 연결) ──────────────────────────────────────────────────────────────

const wordsCardProps = (over: Partial<Parameters<typeof TodayWordsCard>[0]> = {}): Parameters<typeof TodayWordsCard>[0] => ({
  state: 'ready', loadError: null, dailyWordCount: 10, count: 10, category: null, categories: [], archivedTotal: 0,
  todayDone: { sets: 0, correct: 0, cards: 0 }, inProgress: null, today: TODAY, poolEmptyKind: null, hasKept: false,
  starting: false, startError: null, finishing: false, myLevel: 'N4',
  onCount: noop, onCategory: noop, onStart: noop, onStartAll: noop, onBackToReady: noop, onFinish: noop, onShowResult: noop,
  onShowKept: noop, onRetry: noop,
  ...over,
})

test('P10 렌더 — 오늘 카드·챌린지 카드 [내 단어장으로 풀기] 펼침 둘 다 같은 줄을 받는다', () => {
  const plain = html(createElement(TodayWordsCard, wordsCardProps()))
  assert.ok(plain.includes('지금 수준(초급 (N4)) 단어가 가장 많이 나와요.'))
  assert.ok(!plain.includes('챌린지 난이도'))
  const chOn = html(createElement(TodayWordsCard, wordsCardProps({ challengeLevel: 'N3' })))
  assert.ok(chOn.includes('챌린지 난이도(중급 (N3))까지의 단어가 주로 나와요.'), '챌린지 과제가 꺼져 지금 카드가 보일 때도')
  assert.ok(!chOn.includes('지금 수준('))
  const ctx: ChallengeCtx = challengeCtxOf(res({}))!
  const task = ctx.today.tasks[0] as Parameters<typeof TopicWordsCard>[0]['task']
  const card = (mineChallengeLevel: JlptLevel | null) =>
    html(
      createElement(TopicWordsCard, {
        loadState: 'ready', loadError: null, ctx, task, inProgress: null, today: TODAY,
        tally: { sets: 0, correct: 0, wrong: 0, skipped: 0 }, starting: false, finishing: false, mineOpen: true,
        mineProps: wordsCardProps({ challengeLevel: mineChallengeLevel }),
        onStartTopic: noop, onFinish: noop, onShowResult: noop, onToggleMine: noop, onRetry: noop,
      }),
    )
  const open = card('N3')
  assert.ok(open.includes('챌린지 난이도(중급 (N3))까지의 단어가 주로 나와요.'), '펼침(MineSetPanel)')
  // P7 칩도 같은 카드 머리에 — 시각 숨김 「챌린지 주제: 」 + 보이는 글.
  assert.match(open, /<span class="sr-only">챌린지 주제: <\/span><span class="truncate">챌린지 · 중급 \(N3\) · 「카페 주문」<\/span>/)
})

const rec = (over: Partial<LessonRecommendation> = {}): LessonRecommendation => ({
  topicId: 'tq1', topicTitle: '길 묻기', level: 'N4', reason: 'START', nextPreview: null, ...over,
})
const lessons = (r: LessonRecommendation | null): TodayLessons => ({ mode: 'NEW', date: TODAY, todayLessons: [], resume: null, recommendation: r })

test('P6 렌더 — 챌린지 없음 추천 카드: lessonLevel·levelSource 로 「중급 (N3) · 내 목표」, 보이는 글 숨김 + 낭독 문장', () => {
  const h = html(createElement(TodayLessonCard, { state: 'ready', today: lessons(rec({ lessonLevel: 'N3', levelSource: 'GOAL' })), onReload: noop, onToast: noop }))
  assert.match(h, /<span aria-hidden="true" class="whitespace-nowrap">중급 \(N3\) · 내 목표<\/span><span class="sr-only">수업 난이도 중급 \(N3\), 내 목표 기준<\/span>/)
  assert.ok(!/>N4</.test(h) && !h.includes('초급 (N4)'), '주제 난이도(level)는 뱃지에 없음')
  const old = html(createElement(TodayLessonCard, { state: 'ready', today: lessons(rec()), onReload: noop, onToast: noop }))
  assert.match(old, /<span class="whitespace-nowrap">초급 \(N4\)<\/span>/, '서버가 T 를 못 정함 — 꼬리표 없이 주제 난이도')
  assert.ok(!old.includes('수업 난이도'))
})

test('P6 렌더 — 챌린지 카드: 챌린지 난이도 + 「챌린지」(#58 추천과 무관)', () => {
  const ctx: ChallengeCtx = challengeCtxOf(res({ level: 'N2' }))!
  const lessonTask = ctx.today.tasks[1] as NonNullable<Parameters<typeof TodayLessonCard>[0]['challenge']>['task']
  const h = html(
    createElement(TodayLessonCard, {
      state: 'ready',
      today: lessons(rec({ lessonLevel: 'N4', levelSource: 'GOAL' })),
      onReload: noop,
      onToast: noop,
      challenge: { ctx, task: lessonTask },
    }),
  )
  assert.match(h, /<span aria-hidden="true" class="whitespace-nowrap">고급 \(N2\) · 챌린지<\/span><span class="sr-only">수업 난이도 고급 \(N2\), 챌린지 기준<\/span>/)
  assert.ok(!h.includes('내 목표'), '챌린지 카드는 추천 출처를 쓰지 않는다')
})

// ── 배선(소스) ───────────────────────────────────────────────────────────────────────────────

test('배선 — 두 카드 모두 LevelBadge, 옛 코드 뱃지 0, 이름 하드코딩 0, TodayHome 이 판정 함수 한 곳으로 넘긴다', () => {
  const card = src('lesson', 'TodayLessonCard.tsx')
  assert.equal((card.match(/<LevelBadge badge=\{lessonLevelBadge\(/g) ?? []).length, 2, '추천 카드 + 챌린지 카드')
  assert.match(card, /lessonLevelBadge\(rec\.lessonLevel, rec\.levelSource, rec\.level\)/)
  assert.match(card, /lessonLevelBadge\(ctx\.level, 'CHALLENGE', ctx\.level\)/)
  assert.doesNotMatch(card, /<Badge tone="neutral">\{(rec|ctx)\.level\}<\/Badge>/)
  const NAMES = /초보자|초급|중급|고급|최상급/
  for (const f of [['lesson', 'TodayLessonCard.tsx'], ['lesson', 'lessonCopy.ts'], ['vocab', 'topicCopy.ts'], ['vocab', 'TopicWordsCard.tsx'], ['vocab', 'TodayHome.tsx'], ['vocab', 'topicLogic.ts']]) {
    assert.doesNotMatch(src(...f), NAMES, `${f.join('/')} — 이름은 levelLabel 로만`)
  }
  const home = src('vocab', 'TodayHome.tsx')
  assert.match(home, /mineSetChallengeLevel\(challenge\.data, data\?\.today \?\? nowKey\)/)
  assert.match(home, /challengeLevel: mineChallengeLevel,/)
  assert.match(src('vocab', 'TodayWordsCard.tsx'), /todayLevelLine\(myLevel, challengeLevel\)/)
  assert.match(src('vocab', 'TopicWordsCard.tsx'), /WORDS_CARD\.chip\(ctx\.title, ctx\.level\)/)
})
