/**
 * task-059(IMP-0011) Dev-H — 오늘 홈·결과·보관 세트·주제/챌린지 진입의 카드 우선 전환(screens.md §23-2·§23-4 D·§23-8·§23-9).
 * 방식 선택 줄이 없고, #47 에 `mode` 를 싣지 않으며, 방식 이름은 이전 4지선다 세트에만 붙고, 섞인 세트 결과만 구분 한 줄·방식 뱃지를 보인다.
 * 판정 함수 자체는 Dev-D 의 `cardFirst.test.ts` 가 시험한다 — 여기서는 화면이 그 함수에 **연결돼 있는지**를 본다.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { ChallengeTodayTasks } from '@/types/challenge'
import type { CreateSessionResult, SessionSummary, VocabCard, VocabMode, VocabSessionInfo } from '@/types/vocab'
import KeptSets from '../KeptSets'
import TodayWordsCard from '../TodayWordsCard'
import { REASON, WAIT, WORDS_CARD } from '../topicCopy'
import { parseTopicStart, topicStartBody, type ChallengeCtx } from '../topicLogic'
import { createTopicSetStarter, type StartFailure, type StarterState, type TopicStartBody } from '../topicSetStart'
import TopicWordsCard from '../TopicWordsCard'
import VocabResult from '../VocabResult'
import WordResultList from '../WordResultList'

const TODAY = '2026-10-11'
const noop = () => {}
const vocabDir = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const src = (f: string) => strip(readFileSync(join(vocabDir, f), 'utf8'))
const ROUTER = { push: noop, replace: noop, prefetch: noop, back: noop, forward: noop, refresh: noop }
const html = (el: ReactElement) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
    .replace(/<!-- -->/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')

const MODE_WORDS = /방식|푸는 방식|뒤집기 카드/

// ── 오늘 홈 단어 카드 ─────────────────────────────────────────────────────────────────────────

const summary = (mode: VocabMode, over: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 's1', date: TODAY, mode, cardCount: 10, correctCount: 0, wrongCount: 0, skippedCount: 0, status: 'IN_PROGRESS', keptAt: null, replayOfId: null, ...over,
})

const wordsCardProps = (over: Partial<Parameters<typeof TodayWordsCard>[0]> = {}): Parameters<typeof TodayWordsCard>[0] => ({
  state: 'ready', loadError: null, dailyWordCount: 10, count: 10, category: null, categories: [], archivedTotal: 0,
  todayDone: { sets: 0, correct: 0, cards: 0 }, inProgress: null, today: TODAY, poolEmptyKind: null, hasKept: false,
  starting: false, startError: null, levels: { status: 'ready', main: null, goal: null, retry: noop }, seedingPack: null, finishing: false,
  onCount: noop, onCategory: noop, onStart: noop, onStartAll: noop, onBackToReady: noop, onFinish: noop, onShowResult: noop,
  onSeed: noop, onShowKept: noop, onRetry: noop,
  ...over,
})

test('오늘 카드 준비(D8 A·§23-9 B): 방식 줄 없음 — 설명 문구 그대로 · 장수 분절 · [시작하기]', () => {
  const h = html(createElement(TodayWordsCard, wordsCardProps()))
  assert.doesNotMatch(h, MODE_WORDS)
  assert.equal((h.match(/role="radiogroup"/g) ?? []).length, 1, '분절은 「카드 장수」 하나')
  assert.match(h, /aria-label="카드 장수"/)
  assert.match(h, /카드를 넘기며 뜻을 맞혀요\. 틀린 단어일수록 자주 나와요\./)
  assert.match(h, /장수<\/p>[\s\S]*시작하기/)
  // 챌린지 카드 안 [내 단어장으로 풀기] 펼침(embedded)도 같은 몸통
  assert.doesNotMatch(html(createElement(TodayWordsCard, wordsCardProps({ embedded: true }))), MODE_WORDS)
})

test('풀던 세트 줄: 카드 우선(FLIP) 세트는 방식 이름 없음, 이전 4지선다 세트만 「4지선다 · 」', () => {
  const flip = html(createElement(TodayWordsCard, wordsCardProps({ state: 'inProgress', inProgress: { session: summary('FLIP'), answered: 3 } })))
  assert.match(flip, /오늘 시작 · 10장 중 3장 답함/)
  assert.doesNotMatch(flip, /4지선다|뒤집기/)
  const choice = html(createElement(TodayWordsCard, wordsCardProps({ state: 'inProgress', inProgress: { session: summary('CHOICE'), answered: 3 } })))
  assert.match(choice, /오늘 시작 · 4지선다 · 10장 중 3장 답함/)
})

// ── 챌린지 단어 카드 ──────────────────────────────────────────────────────────────────────────

const wordsTask = (state: string, answered = 0) =>
  ({ kind: 'WORDS', state, sessionId: null, wordCount: 10, minAnswered: 8, answered, sets: answered ? 1 : 0 }) as ChallengeTodayTasks['tasks'][number]
const ctxOf = (task: ChallengeTodayTasks['tasks'][number]): ChallengeCtx => ({
  challengeId: 'ch1', topicId: 'tp1', title: '카페 주문', lengthDays: 7, level: 'N5',
  today: { date: TODAY, dayIndex: 2, topic: { id: 'tp1', title: '카페 주문' }, tasks: [task], goalMet: false } as unknown as ChallengeTodayTasks,
})

test('챌린지 단어 카드(할 일·조금 남음·내 단어장 펼침): 방식 줄 없음, [시작하기]/[한 세트 더] 그대로', () => {
  for (const [state, cta] of [['TODO', WORDS_CARD.start], ['SHORT', WORDS_CARD.oneMore]] as const) {
    for (const mineOpen of [false, true]) {
      const task = wordsTask(state, state === 'SHORT' ? 5 : 0)
      const h = html(
        createElement(TopicWordsCard, {
          loadState: 'ready', loadError: null, ctx: ctxOf(task), task: task as Parameters<typeof TopicWordsCard>[0]['task'], inProgress: null, today: TODAY,
          tally: { sets: 0, correct: 0, wrong: 0, skipped: 0 }, starting: false, finishing: false, mineOpen,
          mineProps: wordsCardProps(), onStartTopic: noop, onFinish: noop, onShowResult: noop, onToggleMine: noop, onRetry: noop,
        }),
      )
      assert.doesNotMatch(h, MODE_WORDS, `${state} mine=${mineOpen}`)
      assert.ok(h.includes(cta), `${state} — ${cta}`)
    }
  }
  assert.ok(!('modeLabel' in WORDS_CARD), '라벨 「방식」 문구 삭제')
})

// ── 보관 세트 ─────────────────────────────────────────────────────────────────────────────────

test('보관 세트 줄: 이전 4지선다만 줄 끝 「 · 4지선다」, 카드 우선·이전 뒤집기 세트는 이름 없음(Leader 결정 1)', () => {
  const items = [summary('FLIP', { id: 'a', status: 'DONE', date: '2026-10-11' }), summary('CHOICE', { id: 'b', status: 'DONE', date: '2026-10-10' })]
  const h = html(createElement(KeptSets, { initial: { items, nextCursor: null }, today: TODAY, busyId: null, onReplay: noop }))
  assert.match(h, />오늘 · 10장</)
  assert.match(h, />어제 · 10장 · 4지선다</)
  assert.doesNotMatch(h, /뒤집기/)
})

// ── 결과(D5) ──────────────────────────────────────────────────────────────────────────────────

const card = (order: number, over: Partial<VocabCard>): VocabCard => ({
  order, wordId: `w${order}`, surface: `語${order}`, reading: null, flagged: false, answered: true, meaning: `뜻${order}`, ...over,
})
/** Q9 5장: 食べる 스스로 알았어요 · 行く 객관식 정답 · 水 객관식 오답 · 高い 스스로 몰랐어요 · 友達 표시 후 건너뜀 */
const Q9: VocabCard[] = [
  card(0, { answer: 'CORRECT', chosenText: null }),
  card(1, { answer: 'CORRECT', chosenText: '뜻1', correctText: '뜻1', choices: ['뜻1', 'a', 'b', 'c'] }),
  card(2, { answer: 'WRONG', chosenText: '불', correctText: '뜻2', choices: ['뜻2', '불', 'b', 'c'] }),
  card(3, { answer: 'WRONG', chosenText: null }),
  card(4, { answer: 'SKIPPED', chosenText: null, flagged: true }),
]
const session = (mode: VocabMode, over: Partial<VocabSessionInfo> = {}): VocabSessionInfo => ({
  id: 's9', date: TODAY, mode, requestedCount: 5, cardCount: 5, status: 'DONE', correctCount: 2, wrongCount: 2, skippedCount: 1, durationSec: 64, keptAt: null, replayOfId: null, ...over,
})
const result = (s: VocabSessionInfo, cards: VocabCard[]) =>
  html(createElement(VocabResult, { session: s, cards, finish: null, today: TODAY, flash: null, onFlashShown: noop, onSession: noop }))

test('결과 — 섞인 카드 우선 세트(Q9): 합산 타일 그대로 + 구분 한 줄 + 「맞혔어요」 + 세 목록 모두 방식 뱃지', () => {
  const h = result(session('FLIP'), Q9)
  assert.match(h, /5장 중 2장 맞혔어요/)
  assert.match(h, /세트 결과[\s\S]*오늘 · 5장/)
  assert.doesNotMatch(h, /4지선다|뒤집기/)
  assert.match(h, /걸린 시간 1분 4초 · 다시 볼 카드 1장<\/p><p class="mt-1 text-\[13px\] text-ink2 break-keep">객관식 2장 중 1장 맞힘 · 스스로 2장 중 1장 알았어요<\/p>/)
  // 틀린 단어 목록(2장) + 다시 볼 카드(1장) + 전체(5장)
  assert.equal((h.match(/>객관식 틀림</g) ?? []).length, 2, '틀린 단어 + 전체')
  assert.equal((h.match(/>스스로 몰랐어요</g) ?? []).length, 2)
  assert.equal((h.match(/>객관식 맞힘</g) ?? []).length, 1)
  assert.equal((h.match(/>스스로 알았어요</g) ?? []).length, 1)
  assert.equal((h.match(/<span[^>]*>건너뜀<\/span>/g) ?? []).length, 2, '다시 볼 카드 + 전체(타일 라벨 <p> 제외)')
  assert.doesNotMatch(h, />맞힘<\/span>|>틀림<\/span>/, '섞인 세트는 결과 뱃지 대신 방식 뱃지')
  assert.match(h, /정답 뜻2 · 내 답 불/, '내 답은 둘째 줄 그대로(뱃지에 반복하지 않음)')
})

test('결과 — 섞이지 않은 세트: 구분 한 줄·방식 뱃지 없음, 동사는 답한 방식대로', () => {
  const self = Q9.map((c) => ({ ...c, chosenText: null }))
  const h = result(session('FLIP'), self)
  assert.match(h, /5장 중 2장 알았어요/)
  assert.doesNotMatch(h, /객관식 \d+장 중|스스로 \d+장 중|객관식 맞힘|스스로 알았어요/)
  assert.match(h, />맞힘<\/span>/, '전체 목록 결과 뱃지는 지금 그대로')

  const allChoice = Q9.filter((c) => c.chosenText != null || c.answer === 'SKIPPED')
  const h2 = result(session('FLIP', { cardCount: 3, correctCount: 1, wrongCount: 1, skippedCount: 1 }), allChoice)
  assert.match(h2, /3장 중 1장 맞혔어요/)
  assert.doesNotMatch(h2, /객관식 \d+장 중/)

  const legacy = result(session('CHOICE'), Q9.map((c) => ({ ...c, chosenText: c.answer === 'SKIPPED' ? null : (c.chosenText ?? 'x') })))
  assert.match(legacy, /오늘 · 4지선다 · 5장/, '이전 4지선다 세트만 부제에 방식 이름')
  assert.match(legacy, /5장 중 2장 맞혔어요/)
  assert.doesNotMatch(legacy, /객관식 \d+장 중|스스로/)
})

test('WordResultList: mixedMode 가 없으면 지금 그대로(전체 목록에만 결과 뱃지)', () => {
  const plain = html(createElement(WordResultList, { cards: Q9, showResult: false }))
  assert.doesNotMatch(plain, /객관식|스스로|>맞힘<|>틀림</)
  const mixed = html(createElement(WordResultList, { cards: Q9, showResult: false, mixedMode: 'FLIP' }))
  assert.match(mixed, />객관식 맞힘<[\s\S]*>객관식 틀림<[\s\S]*>스스로 몰랐어요</)
})

// ── 주제 세트 시작(§23-10 D 6) ────────────────────────────────────────────────────────────────

test('시작 토큰: mode 없으면 통과 · 옛 CHOICE/FLIP 도 통과 · 그 밖 값은 null', () => {
  const now = 1_000_000
  const base = { v: 1, topicId: 'tp1', title: '카페 주문', count: 10, wordsDone: false, at: now - 1000 }
  const t = parseTopicStart(JSON.stringify(base), now)
  assert.ok(t)
  assert.equal('mode' in t!, false, '새 토큰에는 mode 키가 없다')
  assert.equal(parseTopicStart(JSON.stringify({ ...base, mode: 'CHOICE' }), now)?.mode, 'CHOICE')
  assert.equal(parseTopicStart(JSON.stringify({ ...base, mode: 'FLIP' }), now)?.topicId, 'tp1')
  assert.equal(parseTopicStart(JSON.stringify({ ...base, mode: 'X' }), now), null)
  assert.equal(parseTopicStart(JSON.stringify({ ...base, mode: null }), now), null)
})

test('대기 화면 #47 본문: 옛 토큰에 mode:CHOICE 가 있어도 싣지 않는다(서버 기본 = 카드 우선)', async () => {
  const old = parseTopicStart(JSON.stringify({ v: 1, topicId: 'tp1', title: 't', count: 10, mode: 'CHOICE', wordsDone: false, at: 5 }), 5)!
  assert.deepEqual(topicStartBody(old), { topicId: 'tp1', count: 10 })
  const sent: TopicStartBody[] = []
  const s = createTopicSetStarter({
    body: topicStartBody(old),
    post: (b) => {
      sent.push(b)
      return new Promise<CreateSessionResult>(() => {})
    },
    toFailure: (e) => e as StartFailure,
    setTimer: () => 0,
    clearTimer: noop,
    onState: noop,
  })
  s.start()
  assert.deepEqual(sent, [{ topicId: 'tp1', count: 10, generate: true }])
  s.dispose()
  assert.match(src('useTopicSetStart.ts'), /body: topicStartBody\(t\)/)
  assert.doesNotMatch(src('useTopicSetStart.ts'), /mode/)
})

const flipCards = (choices: string[] | null | undefined): VocabCard[] => [0, 1].map((o) => card(o, { answered: false, answer: null, choices }))
async function doneState(r: CreateSessionResult): Promise<StarterState> {
  const states: StarterState[] = []
  const s = createTopicSetStarter({
    body: { topicId: 'tp1', count: 10 },
    post: () => Promise.resolve(r),
    toFailure: (e) => e as StartFailure,
    setTimer: () => 0,
    clearTimer: noop,
    onState: (x) => states.push(x),
  })
  s.start()
  await new Promise((res) => setTimeout(res, 0))
  return states.at(-1)!
}

test('주제 세트 done: 보기를 하나도 못 만든 카드 우선 세트만 noChoice:true, 그 밖은 키 없음', async () => {
  const ses = { ...session('FLIP'), status: 'IN_PROGRESS' as const }
  const none = await doneState({ session: ses, cards: flipCards(null) })
  assert.equal(none.kind, 'done')
  assert.equal((none as Extract<StarterState, { kind: 'done' }>).noChoice, true)
  const some = await doneState({ session: ses, cards: flipCards(['a', 'b', 'c', 'd']) })
  assert.equal('noChoice' in some, false)
  const legacy = await doneState({ session: { ...ses, mode: 'CHOICE' }, cards: flipCards(undefined) })
  assert.equal('noChoice' in legacy, false, '이전 4지선다 세트는 해당 없음')
  assert.match(src('useTopicSetStart.ts'), /s\.noChoice \? 'noChoice' : s\.session\.downgraded \? 'few' : ''/)
})

test('대기 화면 부제·주제 알림 문구(§23-8 ⑤★·§23-9 B)', () => {
  assert.equal(WAIT.subtitle('카페에서 주문하기', 10), '「카페에서 주문하기」 · 10장')
  assert.equal(REASON.noChoice, '뜻이 서로 다른 표현이 4개보다 적어서 이번엔 객관식 없이 풀어요.')
  assert.match(src('TopicSetStart.tsx'), /WAIT\.subtitle\(token\.title, token\.count\)/)
})

// ── 오늘 홈·결과 배선(소스 검사) ─────────────────────────────────────────────────────────────

test('오늘 홈: #47 에 mode 를 싣지 않고, 시작·다시 풀기 notice 가 보기 없는 세트를 남긴다', () => {
  const home = src('TodayHome.tsx')
  assert.match(home, /apiPost<CreateSessionResult>\('\/api\/v1\/vocab\/sessions', \{ count, category: cat \}\)/)
  assert.match(home, /isNoChoiceSet\(r\) \? 'noChoice' : r\.session\.downgraded \? 'few' : ''/)
  assert.match(home, /isNoChoiceSet\(r\) \? 'noChoice' : r\.session\.downgraded \? 'deleted' : ''/)
  assert.doesNotMatch(home, /useStoredPref|(?<!\.)\bmode[,:)]|onMode|setMode/)
  // 옛 저장값은 읽지 않고 마운트 때 한 번 지운다(§23-2 L5)
  assert.equal((home.match(/VOCAB_KEYS\.mode/g) ?? []).length, 1)
  assert.match(home, /writeStore\('local', VOCAB_KEYS\.mode, null\)/)
  assert.match(home, /writeTopicStart\(\{ topicId: ctx\.topicId, title: ctx\.title, count: [^}]*wordsDone[^}]*\}\)/)
})

test('결과: [다시 풀기]·[한 세트 더] 경로도 방식을 싣지 않는다', () => {
  const r = src('VocabResult.tsx')
  assert.match(r, /isNoChoiceSet\(r\) \? 'noChoice' : r\.session\.downgraded \? 'deleted' : ''/)
  assert.doesNotMatch(r, /useStoredPref|prefMode|VOCAB_KEYS\.mode/)
  assert.match(r, /writeTopicStart\(\{ topicId: topic\.id, title: topic\.title, count: session\.requestedCount \|\| n, wordsDone: false \}\)/)
})

test('방식 이름(MODE_LABEL) 직접 사용은 labels.ts 정의와 cardFirst.ts 안쪽뿐(§23-10 D 5)', () => {
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__' && name !== 'node_modules') walk(p)
      } else if (/\.tsx?$/.test(name) && /\bMODE_LABEL\b/.test(strip(readFileSync(p, 'utf8')))) hits.push(p.slice(join(vocabDir, '..').length + 1))
    }
  }
  walk(join(vocabDir, '..'))
  assert.deepEqual(hits.sort(), ['vocab/cardFirst.ts', 'vocab/labels.ts'])
})
