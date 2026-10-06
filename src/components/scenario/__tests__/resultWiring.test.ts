import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import ChatListItem from '@/components/chat/ChatListItem'
import type { ChatSummary } from '@/types/chat'
import { lessonCardSourceOf } from '../resultLogic'
import { LIST } from '../scenarioCopyResult'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (s: string, needle: string) => s.split(needle).length - 1

test('수업 종료 카드 자리(§3-I): 주제 있는 새 수업 분기 안 — 다음 수업 카드 아래·[이어서 말하기] 위, 복습·붙여넣기 분기에는 없음', () => {
  const src = read('src/components/lesson/LessonEnd.tsx')
  assert.equal(count(src, '<LessonScenarioCard'), 1)
  const review = src.indexOf('{isReview ? (')
  const topic = src.indexOf(') : topic ? (')
  const nextLesson = src.lastIndexOf('END.nextLesson}')
  const card = src.indexOf('<LessonScenarioCard lesson={lesson} />')
  const talk = src.indexOf('{END.talk}')
  const pasted = src.indexOf('{END.otherText}')
  assert.ok(review >= 0 && topic > review, '복습 분기가 먼저')
  assert.ok(topic < nextLesson && nextLesson < card, '다음 수업 카드 아래')
  assert.ok(card < talk, '[이어서 말하기] 위')
  assert.ok(talk < pasted, '붙여넣은 수업 분기 앞(그 분기에는 없음)')
})

test('회화 목록 뱃지(§3-J): 답하는 중이 먼저, 그다음 역할극, 그다음 점검 완료', () => {
  const src = read('src/components/chat/ChatListItem.tsx')
  const running = src.indexOf('{chat.running ? (')
  const rp = src.indexOf(') : rp ? (')
  const reviewed = src.indexOf(') : chat.reviewedAt ? (')
  assert.ok(running >= 0 && running < rp && rp < reviewed)
  assert.match(src, /const status = chat\.running \? '답하는 중' : rp \?/)
})

/* ── 회화 목록 행 정적 렌더(REV-141 L-6·P7) ─────────────────────────── */

const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
const row = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: 'c1',
  kind: 'TALK',
  title: '카페에서',
  lastMessageAt: null,
  preview: 'いらっしゃいませ',
  messageCount: 2,
  reviewedAt: null,
  running: false,
  ...over,
})
const item = (chat: ChatSummary) => render(createElement(ChatListItem, { chat, href: '/study/ai/talk/c1', now: null }))

test('ChatListItem: 일반 행(보통·답하는 중·점검 완료·채팅)에는 "역할극" 글자가 어디에도 없다', () => {
  const plain = item(row())
  assert.ok(!plain.includes(LIST.rolePlay) && !plain.includes(LIST.ended))
  assert.ok(plain.includes('aria-label="카페에서"'), '라벨 = 제목뿐')
  assert.ok(!plain.includes('<span class="flex flex-none items-center gap-1">'), '뱃지 묶음 없음')
  const running = item(row({ running: true }))
  assert.ok(running.includes('답하는 중') && !running.includes(LIST.rolePlay))
  const reviewed = item(row({ reviewedAt: '2026-10-06T00:00:00.000Z' }))
  assert.ok(reviewed.includes('점검 완료') && !reviewed.includes(LIST.rolePlay))
  assert.ok(!item(row({ kind: 'CHAT' })).includes(LIST.rolePlay))
})

test('ChatListItem: 역할극 행만 뱃지 — 하는 중 "역할극", 마친 것 "역할극·마침", 답하는 중이 먼저', () => {
  const doing = item(row({ scenario: { id: 'sc1', ended: false } }))
  assert.ok(doing.includes(`aria-label="카페에서, ${LIST.rolePlay}"`))
  assert.ok(doing.includes(`>${LIST.rolePlay}<`) && !doing.includes(`>${LIST.ended}<`))
  const done = item(row({ scenario: { id: 'sc1', ended: true }, reviewedAt: '2026-10-06T00:00:00.000Z' }))
  assert.ok(done.includes(`aria-label="카페에서, ${LIST.rolePlay} ${LIST.ended}"`))
  assert.ok(done.includes(`>${LIST.ended}<`) && !done.includes('점검 완료'))
  const running = item(row({ scenario: { id: 'sc1', ended: false }, running: true }))
  assert.ok(running.includes('답하는 중') && !running.includes(`>${LIST.rolePlay}<`))
})

/* ── 수업 종료 카드 — 상황 수업(le-scenario-lesson) ────────────────────── */

test('lessonCardSourceOf: 상황 수업이면 그 상황(추천 요청 없음), 아니면 주제 추천, 둘 다 없으면 카드 없음', () => {
  assert.deepEqual(lessonCardSourceOf({ scenarioId: 'sc9', topic: { id: 't1' } }), { kind: 'scenario', id: 'sc9' })
  assert.deepEqual(lessonCardSourceOf({ scenarioId: 'sc9', topic: null }), { kind: 'scenario', id: 'sc9' })
  assert.deepEqual(lessonCardSourceOf({ scenarioId: null, topic: { id: 't1' } }), { kind: 'topic', topicId: 't1' })
  assert.deepEqual(lessonCardSourceOf({ topic: { id: 't1' } }), { kind: 'topic', topicId: 't1' }, '옛 응답(칸 없음)')
  assert.deepEqual(lessonCardSourceOf({ scenarioId: '', topic: { id: 't1' } }), { kind: 'topic', topicId: 't1' })
  assert.equal(lessonCardSourceOf({ scenarioId: null, topic: null }), null)
})

test('LessonScenarioCard 배선: 상황 수업이면 추천(#161)을 부르지 않고 그 상황 상세(#162)로 카드를 그린다', () => {
  const src = read('src/components/scenario/LessonScenarioCard.tsx')
  assert.ok(src.includes('const source = lessonCardSourceOf(lesson)'))
  assert.ok(src.includes("useKeyedResource<ScenarioListResponse>(source?.kind === 'topic' ? source.topicId : null, recoPath)"))
  assert.ok(src.includes("const pickId = source?.kind === 'scenario' ? source.id :"))
  assert.ok(src.includes("const item = source?.kind === 'scenario' ? (detail.status === 'ready' ? (detail.data ?? undefined) : undefined) :"))
  assert.ok(src.includes('fromLesson={{ lessonId: lesson.id, title: lesson.content.title }}'), '수업 카드에서 시작하면 수업 연결을 싣는다')
})
