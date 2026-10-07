/**
 * task-044 — 챌린지 주제 단어·오늘 탭 챌린지 표시의 순수 판정(가이드 §3·§5) + 서버 렌더 한 번.
 * 실 화면(360/390/412 × 780/892)은 `tests/live/task044-screens.ts`(고정 응답)에서 본다.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChallengeProgress, ChallengeSummary, ChallengeTodayResponse, ChallengeTodayTasks } from '@/types/challenge'
import type { SessionSummary } from '@/types/vocab'
import ChallengeEndLine from '@/components/lesson/ChallengeEndLine'
import ChallengeResultBox from '../ChallengeResultBox'
import ChallengeStrip from '../ChallengeStrip'
import { pickNotice } from '../deck'
import { WORDS_CARD } from '../topicCopy'
import TopicDeckLines from '../TopicDeckLines'
import TopicWordsCard from '../TopicWordsCard'
import {
  addBody,
  challengeCtxOf,
  deckChallengeLine,
  finishChallengeNote,
  parseGeneration,
  parseTopicStart,
  resultChallengeView,
  stripModel,
  topicReasonNotice,
  topicSourceLine,
  topicSourceParts,
  wipCardNotes,
  wordsCardKind,
  type ChallengeCtx,
} from '../topicLogic'

const TODAY = '2026-10-07'
const topic = (ai: number, lc = 0) => ({ id: 'tp1', title: '카페 주문', aiCardCount: ai, lessonCardCount: lc })

const summary = (over: Partial<ChallengeSummary> = {}): ChallengeSummary => ({
  id: 'ch1',
  title: '카페 주문 7일 챌린지',
  topic: { id: 'tp1', title: '카페 주문', exists: true },
  level: 'N5',
  lengthDays: 7,
  startDate: '2026-10-04',
  endDate: '2026-10-10',
  status: 'ACTIVE',
  dailyGoal: { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 },
  stats: { dayIndex: 4, elapsedDays: 3, metDays: 2, rate: 0.67, streak: 2, longestStreak: 2, todayMet: false },
  endedAt: null,
  ...over,
})
const tasks = (words: Partial<ChallengeTodayTasks['tasks'][number]> & { state: string; answered?: number } | null, over: Partial<ChallengeTodayTasks> = {}): ChallengeTodayTasks => ({
  date: TODAY,
  dayIndex: 4,
  topic: { id: 'tp1', title: '카페 주문' },
  tasks: [
    ...(words ? [{ kind: 'WORDS' as const, sessionId: null, wordCount: 10, minAnswered: 8, answered: 0, sets: 0, ...words } as ChallengeTodayTasks['tasks'][number]] : []),
    { kind: 'LESSON', state: 'TODO', lessonId: null, jobId: null },
  ],
  goalMet: false,
  ...over,
})
const res = (t: ChallengeTodayTasks | null, s: Partial<ChallengeSummary> = {}): ChallengeTodayResponse => ({ challenge: summary(s), today: t, recentlyEnded: null })
const ctx = (t: ChallengeTodayTasks): ChallengeCtx => challengeCtxOf(res(t))!

test('출처 줄 B: 새 단어·섞임·재사용(두 번째 세트)·B1(지난 수업 표현 포함/없음)·다시 연 세트', () => {
  assert.equal(topicSourceLine(topic(10), 10, { source: 'AI', generatedNow: true, reason: null }), '「카페 주문」 새 단어 10장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요')
  assert.equal(topicSourceLine(topic(7), 10, { source: 'MIXED', generatedNow: true, reason: 'SHORT' }), '새 단어 7장 + 「카페 주문」 표현 3장 · AI 가 만든 단어는 틀릴 수 있어요')
  assert.equal(topicSourceLine(topic(6), 10, { source: 'MIXED', generatedNow: false, reason: null }), '오늘 만든 새 단어 중 안 푼 6장 + 「카페 주문」 표현 4장 · AI 가 만든 단어는 틀릴 수 있어요')
  assert.equal(topicSourceLine(topic(0, 3), 10, { source: 'TOPIC', generatedNow: false, reason: 'SKIPPED' }), '「카페 주문」 표현으로 만든 오늘의 단어 10장 · 지난 수업 표현 3개 포함')
  assert.equal(topicSourceLine(topic(0, 0), 10, { source: 'TOPIC', generatedNow: false, reason: 'TIMEOUT' }), '「카페 주문」 표현으로 만든 오늘의 단어 10장')
  // #48·#49 로 다시 연 세트(generation 없음)는 카드 수로 고른다 — 재사용 문구 대신 새 단어/섞임 문구
  assert.equal(topicSourceLine(topic(10), 10, null), '「카페 주문」 새 단어 10장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요')
  assert.equal(topicSourceLine(topic(6), 10, null), '새 단어 6장 + 「카페 주문」 표현 4장 · AI 가 만든 단어는 틀릴 수 있어요')
  assert.ok(!/AI 가 새 단어를 만들었어요/.test(topicSourceLine(topic(0, 2), 10, null)), 'B1 문구에는 AI 생성 표현 금지')
})

test('폴백 사유 알림: TIMEOUT·FAILED·INVALID / LIMIT / NEW_DONE(ai=0 만) / SHORT·SKIPPED·null 은 없음', () => {
  const fail = '오늘은 새 단어를 만들지 못해 「카페 주문」 표현으로 골랐어요 · 다음 세트에서 다시 만들어 볼게요'
  for (const r of ['TIMEOUT', 'FAILED', 'INVALID'] as const) assert.equal(topicReasonNotice({ source: 'TOPIC', generatedNow: false, reason: r }, topic(0)), fail)
  assert.equal(topicReasonNotice({ source: 'TOPIC', generatedNow: false, reason: 'LIMIT' }, topic(0)), '오늘 새 단어 만들기는 여기까지예요 · 「카페 주문」 표현으로 골랐어요')
  assert.equal(topicReasonNotice({ source: 'TOPIC', generatedNow: false, reason: 'NEW_DONE' }, topic(0)), '오늘 새 단어는 다 풀었어요 — 「카페 주문」 표현으로 이어서 풀어요')
  assert.equal(topicReasonNotice({ source: 'MIXED', generatedNow: false, reason: 'NEW_DONE' }, topic(3)), null)
  for (const r of ['SHORT', 'SKIPPED', null] as const) assert.equal(topicReasonNotice({ source: 'MIXED', generatedNow: true, reason: r }, topic(5)), null)
  assert.equal(topicReasonNotice(null, topic(0)), null, '#49 로 다시 연 세트 — 사유 알림 없음')
  // 덱 알림 우선순위: few/deleted > topicReason > fewer > resume
  const s = { cardCount: 6, requestedCount: 10, downgraded: false, replayOfId: null, date: TODAY }
  assert.deepEqual(pickNotice(s, 0, null, TODAY, fail), { kind: 'topicReason', text: fail })
  assert.deepEqual(pickNotice({ ...s, downgraded: true }, 0, null, TODAY, fail), { kind: 'few' })
  assert.deepEqual(pickNotice(s, 0, null, TODAY, null), { kind: 'fewer', cardCount: 6 })
  assert.deepEqual(pickNotice(s, 2, null, TODAY, fail), { kind: 'resume', answered: 2 }, '이어 풀기면 사유 알림 없음')
})

test('덱 챌린지 줄 C: 첫 세트·두 번째 세트(4/8 부터)·채움·이미 완료·5장 목표·다른 주제·지난 날·챌린지 없음', () => {
  const s = { date: TODAY, topic: { id: 'tp1' } }
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'TODO' })), s, 0), '챌린지 · 8장 이상 풀면 오늘 단어 완료')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'SHORT', answered: 4 })), s, 0), '챌린지 · 오늘 4/8장 — 4장 더 풀면 완료')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'SHORT', answered: 4 })), s, 3), '챌린지 · 오늘 7/8장 — 1장 더 풀면 완료')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'SHORT', answered: 4 })), s, 4), '챌린지 · 오늘 8장 풂 · 이 세트를 끝내면 오늘 단어 완료')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'DONE', answered: 9 })), s, 1), '챌린지 · 오늘 단어는 이미 완료 · 더 풀면 오늘 합계에 더해져요')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'SHORT', answered: 2, wordCount: 5, minAnswered: 4 })), s, 0), '챌린지 · 오늘 2/4장 — 2장 더 풀면 완료')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'TODO' })), { date: TODAY, topic: { id: 'other' } }, 0), null, '다른 주제 세트')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'TODO' })), { date: TODAY, topic: null }, 0), null, '내 단어장 세트')
  assert.equal(deckChallengeLine(ctx(tasks(null)), s, 0), null, '단어 과제 꺼짐')
  assert.equal(deckChallengeLine(null, s, 0), null, '챌린지 없음·#158 실패')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'TODO' })), { date: '2026-10-06', topic: { id: 'tp1' } }, 2), '챌린지 · 10월 6일 시작 세트 · 그날(3일째) 단어로 인정돼요')
  assert.equal(deckChallengeLine(ctx(tasks({ state: 'TODO' }, { dayIndex: 1 })), { date: '2026-10-06', topic: { id: 'tp1' } }, 2), null, '챌린지 시작 전날 세트(k<1)')
})

test('끝내기 시트 메모: 답 0장·미달(일부)·채움·이미 완료·지난 날·챌린지 아님', () => {
  const s = { date: TODAY, topic: { id: 'tp1' } }
  assert.deepEqual(finishChallengeNote(ctx(tasks({ state: 'SHORT', answered: 4 })), s, 0), { tone: 'plain', strong: null, text: '오늘 단어는 4/8장 그대로예요.' })
  const short = finishChallengeNote(ctx(tasks({ state: 'TODO' })), s, 4)
  assert.equal(short?.tone, 'warn')
  assert.equal(`${short?.strong}${short?.text}`, '지금 끝내면 오늘 단어는 8장 중 4장 — ‘일부’로 남아요. 남은 표현으로 한 세트 더 풀 수 있어요.')
  assert.equal(finishChallengeNote(ctx(tasks({ state: 'SHORT', answered: 4 })), s, 5)?.text, '이 세트까지 오늘 9장 풀었어요 — 오늘 단어는 완료로 인정돼요.')
  assert.equal(finishChallengeNote(ctx(tasks({ state: 'DONE', answered: 8 })), s, 2)?.text, '오늘 단어는 이미 완료예요. 이 세트도 오늘 합계에 더해져요.')
  assert.equal(finishChallengeNote(ctx(tasks({ state: 'DONE', answered: 8 })), s, 0)?.text, '오늘 단어는 이미 완료 그대로예요.')
  assert.equal(finishChallengeNote(ctx(tasks({ state: 'TODO' })), { date: '2026-10-06', topic: { id: 'tp1' } }, 3)?.text, '이 세트는 10월 6일에 시작해서 그날 기록으로 남아요.')
  assert.equal(finishChallengeNote(ctx(tasks({ state: 'TODO' })), { date: TODAY, topic: { id: 'x' } }, 3), null)
})

test('결과 상자: 두 세트 날(첫 세트 미달 → 둘째 달성 알림 1번)·이미 달성·단어만 채움·소급·지난 날·null', () => {
  const p = (over: Partial<ChallengeProgress>): ChallengeProgress => ({ challengeId: 'ch1', date: TODAY, dayIndex: 4, goalMet: false, goalMetNow: false, words: { answered: 4, need: 8 }, ...over })
  assert.deepEqual(resultChallengeView(p({}), 4, TODAY), { kind: 'short', ans: 4, need: 8 }, '첫 세트 4장 — 알림 없음')
  assert.equal(resultChallengeView(p({ goalMet: true, goalMetNow: true, words: { answered: 9, need: 8 } }), 5, TODAY)?.kind, 'metNow', '합계를 채운 둘째 세트만 알림')
  assert.equal(resultChallengeView(p({ goalMet: true, words: { answered: 12, need: 8 } }), 3, TODAY)?.kind, 'already', '이미 달성한 날 [한 세트 더] — 알림 없음')
  assert.equal(resultChallengeView(p({ words: { answered: 8, need: 8 } }), 8, TODAY)?.kind, 'wordsDone', '단어를 채웠지만 회화 남음')
  assert.equal(resultChallengeView(p({ words: { answered: 12, need: 8 } }), 3, TODAY)?.kind, 'wordsAlready')
  assert.deepEqual(resultChallengeView(p({ date: '2026-10-06', dayIndex: 3, goalMet: true, goalMetNow: true }), 4, TODAY), { kind: 'retro', date: '2026-10-06', dayIndex: 3 })
  assert.equal(resultChallengeView(p({ date: '2026-10-06', dayIndex: 3 }), 2, TODAY)?.kind, 'pastDay')
  assert.equal(resultChallengeView(null, 4, TODAY), null, 'challenge null — 다른 주제·내 단어장·꺼진 과제·마감 뒤')
  const html = renderToStaticMarkup(createElement(ChallengeResultBox, { view: resultChallengeView(p({ goalMet: true, goalMetNow: true, words: { answered: 9, need: 8 } }), 5, TODAY)!, title: '카페 주문', onOneMore: () => {}, oneMoreBusy: false }))
  assert.match(html, /오늘 챌린지 목표 달성!/)
  assert.match(html, /role="status"/)
  assert.match(renderToStaticMarkup(createElement(ChallengeResultBox, { view: { kind: 'short', ans: 4, need: 8 }, title: '카페 주문', onOneMore: () => {}, oneMoreBusy: false })), /4장 더 풀면 오늘 단어 완료예요[\s\S]*한 세트 더/)
})

test('수업 종료 줄: goalMetNow·이미 달성·단어 남음, null 이면 아무것도 그리지 않음', () => {
  const p = (over: Partial<ChallengeProgress>): ChallengeProgress => ({ challengeId: 'ch1', date: TODAY, dayIndex: 4, goalMet: false, goalMetNow: false, words: null, ...over })
  assert.equal(renderToStaticMarkup(createElement(ChallengeEndLine, { challenge: null, topicTitle: '카페 주문' })), '')
  assert.match(renderToStaticMarkup(createElement(ChallengeEndLine, { challenge: p({ goalMet: true, goalMetNow: true }), topicTitle: '카페 주문' })), /오늘 챌린지 목표 달성![\s\S]*「카페 주문」 챌린지 4일째/)
  assert.match(renderToStaticMarkup(createElement(ChallengeEndLine, { challenge: p({ goalMet: true }), topicTitle: '카페 주문' })), /오늘 목표는 이미 채웠어요/)
  assert.match(renderToStaticMarkup(createElement(ChallengeEndLine, { challenge: p({}), topicTitle: '카페 주문' })), /회화 완료[\s\S]*오늘의 단어가 남았어요/)
})

test('띠·카드 모드: 진행 중·달성·내일 시작·끝난 챌린지/없음, 단어 카드 판정 순서', () => {
  const prog = stripModel(res(tasks({ state: 'SHORT', answered: 4 })), TODAY)
  assert.ok(prog && prog.kind === 'progress')
  assert.equal(prog.title, '「카페 주문」 챌린지 · 4일째 / 7일')
  assert.equal(prog.sub, '오늘 할 일 0 / 2')
  assert.equal(prog.kind === 'progress' && prog.words?.label, '단어 4/8장')
  assert.equal(stripModel(res(tasks({ state: 'DONE' }, { goalMet: true })), TODAY)?.title, '✓ 오늘 챌린지 목표 달성')
  assert.equal(stripModel(res(null, { startDate: '2026-10-08' }), TODAY)?.kind, 'tomorrow')
  assert.equal(stripModel(res(tasks({ state: 'TODO' }), { status: 'ENDED' }), TODAY), null)
  assert.equal(stripModel({ challenge: null, today: null, recentlyEnded: null }, TODAY), null)
  const w = tasks({ state: 'TODO' }).tasks[0] as Parameters<typeof wordsCardKind>[0]
  assert.equal(wordsCardKind(w, { session: { topic: { id: 'tp1', title: '', aiCardCount: 0, lessonCardCount: 0 } } }, 'tp1'), 'wip')
  assert.equal(wordsCardKind(w, { session: { topic: null } }, 'tp1'), 'otherWip')
  assert.equal(wordsCardKind({ ...w, state: 'IN_PROGRESS' }, null, 'tp1'), 'ipDefense')
  assert.equal(wordsCardKind({ ...w, state: 'SHORT' }, null, 'tp1'), 'short')
  assert.equal(wordsCardKind(w, null, 'tp1'), 'todo')
  // 장수별 문구(§13-2 18)
  assert.equal(WORDS_CARD.todoHead('카페 주문', 10, 8), '「카페 주문」 새 단어 10장 · 오늘 0/8장')
  assert.equal(WORDS_CARD.todoHead('카페 주문', 5, 4), '「카페 주문」 새 단어 5장 · 오늘 0/4장')
  assert.equal(WORDS_CARD.shortHead(4, 8), '오늘 4/8장 — 4장 더 풀면 오늘 단어 완료')
  assert.equal(WORDS_CARD.shortHead(2, 4), '오늘 2/4장 — 2장 더 풀면 오늘 단어 완료')
})

test('시작 토큰·generation 해석, [단어장에 넣기] 본문', () => {
  const now = 1_000_000
  const tok = JSON.stringify({ v: 1, topicId: 'tp1', title: '카페 주문', count: 10, mode: 'CHOICE', wordsDone: false, at: now - 1000 })
  assert.equal(parseTopicStart(tok, now)?.topicId, 'tp1')
  assert.equal(parseTopicStart(tok, now + 61_000), null, '60초 지남')
  assert.equal(parseTopicStart('{bad', now), null)
  assert.equal(parseTopicStart(JSON.stringify({ v: 1, topicId: 'tp1', title: 't', count: 10, mode: 'X', at: now }), now), null)
  assert.deepEqual(parseGeneration(JSON.stringify({ source: 'TOPIC', generatedNow: false, reason: 'TIMEOUT' })), { source: 'TOPIC', generatedNow: false, reason: 'TIMEOUT' })
  assert.equal(parseGeneration(null), null)
  assert.deepEqual(addBody({ surface: 'お冷', reading: 'おひや', correctText: '찬물', meaning: null }), { surface: 'お冷', reading: 'おひや', meaning: '찬물' })
  assert.deepEqual(addBody({ surface: 'ください', reading: null, correctText: null, meaning: '주세요' }), { surface: 'ください', meaning: '주세요' })
  assert.equal(addBody({ surface: 'x', reading: null, correctText: null, meaning: '' }), null, '뜻이 비면 버튼 없음')
})

test('풀던 세트 카드(REV-125 M-1): 어제 시작한 주제 세트 · 오늘 시작한 주제 세트 · 내 단어장 세트 문구', () => {
  const YDAY = '2026-10-06'
  const saved = '답한 카드는 저장돼 있어요.'
  const past = '지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요.'
  assert.deepEqual(wipCardNotes('wip', YDAY, TODAY), [saved, past], '어제 시작한 주제 세트 — 시작한 날로 세므로 "오늘 합계" 줄 없음')
  assert.deepEqual(wipCardNotes('wip', TODAY, TODAY), [saved, WORDS_CARD.wipNote], '오늘 시작한 주제 세트')
  assert.deepEqual(wipCardNotes('otherWip', TODAY, TODAY), [saved, WORDS_CARD.otherWipNote], '내 단어장 세트(오늘)')
  assert.deepEqual(wipCardNotes('otherWip', YDAY, TODAY), [saved, past, WORDS_CARD.otherWipNote], '내 단어장 세트(어제) — 지금 카드의 지난 날 안내 유지')
  assert.deepEqual(wipCardNotes('wip', TODAY, ''), [saved], '오늘 날짜를 모르면 오늘 합계라고 말하지 않는다')

  const c = ctx(tasks({ state: 'TODO' }))
  const w = tasks({ state: 'TODO' }).tasks[0] as Parameters<typeof wordsCardKind>[0]
  const sess = (date: string, t: SessionSummary['topic']): SessionSummary => ({
    id: 's9', date, mode: 'CHOICE', cardCount: 10, correctCount: 2, wrongCount: 1, skippedCount: 0, status: 'IN_PROGRESS', keptAt: null, replayOfId: null, topic: t,
  })
  const noop = () => {}
  const card = (s: SessionSummary) =>
    renderToStaticMarkup(
      createElement(TopicWordsCard, {
        loadState: 'ready', loadError: null, ctx: c, task: w, inProgress: { session: s, answered: 3 }, today: TODAY,
        tally: { sets: 0, correct: 0, wrong: 0, skipped: 0 }, mode: 'CHOICE', starting: false, finishing: false, mineOpen: false,
        mineProps: {} as Parameters<typeof TopicWordsCard>[0]['mineProps'],
        onMode: noop, onStartTopic: noop, onFinish: noop, onShowResult: noop, onToggleMine: noop, onRetry: noop,
      }),
    )
  const y = card(sess(YDAY, topic(10)))
  assert.match(y, /풀던 세트가 있어요[\s\S]*「카페 주문」 새 단어 10장 · AI 가 만든 단어라[\s\S]*답한 카드는 저장돼 있어요\.[\s\S]*지난 날 시작한 세트예요\. 끝내면 그날 기록으로 남아요\./)
  assert.doesNotMatch(y, /오늘 합계에 더해져요/, '어제 세트에 "오늘 합계" 문구 금지')
  const t = card(sess(TODAY, topic(10)))
  assert.match(t, /답한 카드는 저장돼 있어요\.[\s\S]*끝내면 오늘 합계에 더해져요/)
  assert.doesNotMatch(t, /지난 날 시작한 세트예요/)
  const m = card(sess(YDAY, null))
  assert.match(m, /답한 카드는 저장돼 있어요\.[\s\S]*지난 날 시작한 세트예요\.[\s\S]*이 세트를 끝내면 챌린지 단어를 시작할 수 있어요/)
  assert.doesNotMatch(m, /오늘 합계에 더해져요/)
})

test('출처 줄 두 부분(REV-125 L-4): 좁은 화면 한 줄 강등에서 AI 주의는 자르지 않고 설명부터 줄인다', () => {
  const parts = topicSourceParts(topic(10), 10, null)
  assert.deepEqual(parts, { desc: '「카페 주문」 새 단어 10장', note: 'AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요' })
  assert.deepEqual(topicSourceParts(topic(6), 10, { source: 'MIXED', generatedNow: false, reason: null }), { desc: '오늘 만든 새 단어 중 안 푼 6장 + 「카페 주문」 표현 4장', note: 'AI 가 만든 단어는 틀릴 수 있어요' })
  assert.equal(topicSourceParts(topic(0, 3), 10, null).note, null, '새 단어 없는 세트는 주의 없음')
  const compact = renderToStaticMarkup(createElement(TopicDeckLines, { source: parts, challenge: null, compact: true }))
  assert.match(compact, /<span class="min-w-0 truncate">「카페 주문」 새 단어 10장<\/span><span class="([^"]*)">· AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요<\/span>/)
  const noteCls = /<span class="([^"]*)">· AI/.exec(compact)?.[1] ?? ''
  assert.ok(/\bflex-none\b/.test(noteCls) && !/truncate|line-clamp/.test(noteCls), '주의 부분은 줄어들지도 잘리지도 않는다')
  const wide = renderToStaticMarkup(createElement(TopicDeckLines, { source: parts, challenge: null, compact: false }))
  assert.match(wide, /line-clamp-2[^>]*>「카페 주문」 새 단어 10장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요</, '넓은 화면은 지금처럼 두 줄 한 문장')
  const b1 = renderToStaticMarkup(createElement(TopicDeckLines, { source: topicSourceParts(topic(0, 3), 10, null), challenge: null, compact: true }))
  assert.match(b1, /line-clamp-1[^>]*>「카페 주문」 표현으로 만든 오늘의 단어 10장 · 지난 수업 표현 3개 포함</)
})

test('일부 모양은 반원 글자가 아니라 그림(PartialMark) — 띠·결과 상자·수업 종료 줄, 화면 파일에 반원 글자 0', () => {
  const half = String.fromCodePoint(0x25d0)
  const strip = stripModel(res(tasks({ state: 'SHORT', answered: 4 })), TODAY)!
  const htmls = [
    renderToStaticMarkup(createElement(ChallengeStrip, { model: strip })),
    renderToStaticMarkup(createElement(ChallengeResultBox, { view: { kind: 'wordsDone', ans: 8, need: 8 }, title: '카페 주문', onOneMore: () => {}, oneMoreBusy: false })),
    renderToStaticMarkup(createElement(ChallengeEndLine, { challenge: { challengeId: 'ch1', date: TODAY, dayIndex: 4, goalMet: false, goalMetNow: false, words: null }, topicTitle: '카페 주문' })),
  ]
  for (const h of htmls) {
    assert.match(h, /data-mark="partial"/)
    assert.ok(!h.includes(half))
  }
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  const root = process.cwd()
  for (const d of [['src', 'components', 'vocab'], ['src', 'components', 'lesson'], ['src', 'app', '(app)', 'study', 'today']]) walk(join(root, ...d))
  assert.ok(files.length > 10)
  const hits = files.filter((f) => readFileSync(f, 'utf8').includes(half))
  assert.deepEqual(hits, [], '반원 글자가 남은 화면 파일')
})

test('화면 문구에 엔진·모델 이름·작업 번호가 없다(AI 까지만)', () => {
  const root = join(process.cwd(), 'src', 'components', 'vocab')
  const copy = readFileSync(join(root, 'topicCopy.ts'), 'utf8')
  const strings = copy.match(/'[^'\n]*'|`[^`\n]*`/g) ?? []
  const text = strings.join('\n')
  assert.ok(!/claude|haiku|sonnet|opus|qwen|whisper|reazon|style-?bert|sbv2|ollama|gpt/i.test(text), '엔진·모델명 0')
  assert.ok(!/task-\d|Phase\s?\d|A12|AiWord|refType/i.test(text), 'task·Phase·내부 이름 0')
})
