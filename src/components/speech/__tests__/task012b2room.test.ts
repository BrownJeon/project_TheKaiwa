/**
 * task-012b-2 회화방 삽입(TalkRoom ≈4줄) — 슬롯이 붙는 조건·턴 보호(`paused` = TalkState ≠ IDLE)·펼칠 때 목록 따라가기 멈춤(task-039 ⑧)과,
 * 회화 목록 안에서 내 말풍선(USER)마다 정확히 한 번만 붙는지. 실제 회화방(녹음·재생·스크롤)은 `tests/live/task012b2-screens.ts`·QA 가 본다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement, Fragment, useContext, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FollowHoldContext } from '@/components/chat/followHold'
import MessageList from '@/components/chat/MessageList'
import type { ChatTurn } from '@/components/chat/useChatTurn'
import { deriveTalkState, type TalkStateInput } from '@/components/talk/talkState'
import type { ChatMessageView } from '@/types/chat'
import type { UtteranceListItem } from '@/types/speech'
import { UtteranceReviewSlot } from '../UtteranceReviewCard'
import type { UtteranceReviews } from '../useUtteranceReviews'
import { REVIEW_COPY } from '../utteranceCopy'
import { expandHandler, shouldPoll, slotEntry, type ReviewEntry } from '../utteranceReview'

const ROOT = process.cwd()
const TALK_ROOM = readFileSync(join(ROOT, 'src/components/talk/TalkRoom.tsx'), 'utf8')
const CARD = readFileSync(join(ROOT, 'src/components/speech/UtteranceReviewCard.tsx'), 'utf8')
const noop = () => undefined

function item(over: Partial<UtteranceListItem> = {}): UtteranceListItem {
  return {
    id: 'utt1',
    createdAt: '2026-10-06T11:00:00.000Z',
    durationMs: 2400,
    status: 'ANALYZED',
    realtimeText: '駅はどこですか',
    analysisText: '低級はどこですか',
    finalText: null,
    finalSource: 'REALTIME',
    requiresReview: true,
    wasReviewTarget: true,
    audioAvailable: true,
    chatMessageId: 'u1',
    context: { kind: 'TALK', id: 'chat1' },
    ...over,
  }
}

/** 메시지 id → 확인 대상. 모든 id 에 같은 대상을 주면 "선생님 말에도 붙는가"를 볼 수 있다. */
function fakeReviews(map: Record<string, ReviewEntry>, calls: string[] = []): UtteranceReviews {
  return {
    entryFor: (id) => {
      calls.push(id)
      return map[id] ?? null
    },
    openId: null,
    setOpen: noop,
    pin: noop,
    markResolved: noop,
    release: noop,
  }
}

/* ── 붙는 조건 ─────────────────────────────────────────────── */

test('slotEntry: 내 말풍선(USER)·보내는 중 아님일 때만 그 메시지의 대상 — 선생님 말·SENDING 은 대상을 묻지도 않는다', () => {
  const e: ReviewEntry = { item: item(), resolved: null }
  const calls: string[] = []
  const r = fakeReviews({ u1: e, a1: e }, calls)
  assert.equal(slotEntry({ id: 'u1', role: 'USER' }, r.entryFor), e)
  assert.equal(slotEntry({ id: 'u1' }, r.entryFor), e, 'role 을 모르면(슬롯만 쓰는 곳) 메시지 id 로만')
  assert.equal(slotEntry({ id: 'a1', role: 'ASSISTANT' }, r.entryFor), null)
  assert.equal(slotEntry({ id: 'u1', role: 'USER', localStatus: 'SENDING' }, r.entryFor), null)
  assert.equal(slotEntry({ id: 'u2', role: 'USER' }, r.entryFor), null, '대상 없는 내 말 → 자리 0(R0)')
  assert.deepEqual(calls, ['u1', 'u1', 'u2'])
})

test('expandHandler: 넘겨받은 값이 우선, 없으면 목록의 따라가기 멈춤, 목록 밖(null)이면 없음', () => {
  const explicit = () => 'explicit'
  const hold = () => 'hold'
  assert.equal(expandHandler(explicit, hold), explicit)
  assert.equal(expandHandler(undefined, hold), hold)
  assert.equal(expandHandler(undefined, null), undefined)
})

/* ── 턴 보호 ───────────────────────────────────────────────── */

const BASE: TalkStateInput = {
  sttPhase: 'idle',
  turnPhase: 'idle',
  playbackPhase: 'idle',
  playbackSource: null,
  queued: false,
  rateLimitedSec: null,
  recordingSec: 0,
  askPermission: false,
  slowConnect: false,
  quietHint: null,
  idleHint: null,
}
/** TalkRoom 과 같은 식(아래 정적 검사가 같은 식인지 본다). */
const pausedOf = (over: Partial<TalkStateInput>) => deriveTalkState({ ...BASE, ...over }).state !== 'IDLE'

test('paused: 녹음·인식·보내기 대기·생각 중·말하는 중(선생님·내 목소리)이면 멈춤, 쉬는 상태(대기·429·인식 불가)는 진행', () => {
  for (const [label, over] of [
    ['녹음 시작', { sttPhase: 'starting' }],
    ['녹음', { sttPhase: 'recording' }],
    ['인식', { sttPhase: 'finishing' }],
    ['보내기 대기', { queued: true }],
    ['보내는 중', { turnPhase: 'sending' }],
    ['생각 중', { turnPhase: 'streaming' }],
    ['연결 끊김 대기', { turnPhase: 'detached' }],
    ['선생님 말', { playbackPhase: 'playing', playbackSource: 'turn' }],
    ['다시 듣기', { playbackPhase: 'playing', playbackSource: 'replay' }],
    ['내 목소리', { playbackPhase: 'playing', playbackSource: 'mine' }],
  ] as const) {
    assert.equal(pausedOf(over), true, label)
    assert.equal(shouldPoll({ visible: true, paused: pausedOf(over), recentVoice: true }), false, `${label}: 주기 요청 0`)
  }
  for (const [label, over] of [
    ['대기', {}],
    ['429', { rateLimitedSec: 12 }],
    ['인식 불가', { sttPhase: 'unavailable' }],
    ['턴 실패', { turnPhase: 'failed' }],
  ] as const) {
    assert.equal(pausedOf(over), false, label)
  }
})

/* ── 렌더 ──────────────────────────────────────────────────── */

test('슬롯 렌더: 대상 있는 내 말 → 접힘 줄 1개, 대상 없음·선생님·SENDING → 빈 자리. 목록 Provider 안팎에서 마크업은 같다', () => {
  const r = fakeReviews({ u1: { item: item(), resolved: null }, a1: { item: item(), resolved: null } })
  const html = renderToStaticMarkup(createElement(UtteranceReviewSlot, { reviews: r, message: { id: 'u1', role: 'USER' } }))
  assert.equal(html.match(/aria-expanded="false"/g)?.length, 1)
  assert.ok(html.includes(REVIEW_COPY.title))
  const inList = renderToStaticMarkup(createElement(FollowHoldContext.Provider, { value: noop }, createElement(UtteranceReviewSlot, { reviews: r, message: { id: 'u1', role: 'USER' } })))
  assert.equal(inList, html)
  assert.equal(renderToStaticMarkup(createElement(UtteranceReviewSlot, { reviews: r, message: { id: 'u2', role: 'USER' } })), '')
  assert.equal(renderToStaticMarkup(createElement(UtteranceReviewSlot, { reviews: r, message: { id: 'a1', role: 'ASSISTANT' } })), '')
  assert.equal(renderToStaticMarkup(createElement(UtteranceReviewSlot, { reviews: r, message: { id: 'u1', role: 'USER', localStatus: 'SENDING' } })), '')
})

function msg(over: Partial<ChatMessageView>): ChatMessageView {
  return { id: 'x', role: 'USER', content: 'こんにちは', status: 'DONE', inputSource: 'REALTIME_STT', createdAt: '2026-10-06T11:00:00.000Z', ...over }
}

function HoldProbe({ id }: { id: string }) {
  const hold = useContext(FollowHoldContext)
  return createElement('i', { 'data-hold': `${id}:${typeof hold}` })
}

test('회화 목록 안: 슬롯은 renderUser 자리(USER 행)에서만, 대상 있는 내 말 수만큼 정확히 한 번씩 — 그 자리에서 따라가기 멈춤이 보인다', () => {
  const e = (id: string, u: string): ReviewEntry => ({ item: item({ id: u, chatMessageId: id }), resolved: null })
  // 선생님 말 id 에도 대상을 넣어 둔다 — renderTutor 자리에는 슬롯이 없으므로 붙지 않아야 한다.
  const reviews = fakeReviews({ u1: e('u1', 'utt1'), a1: e('a1', 'utt9'), u3: e('u3', 'utt3') })
  const messages = [
    msg({ id: 'u1', createdAt: '2026-10-06T11:00:00.000Z' }),
    msg({ id: 'a1', role: 'ASSISTANT', content: 'はい', inputSource: null, createdAt: '2026-10-06T11:00:05.000Z' }),
    msg({ id: 'u2', inputSource: 'TEXT', createdAt: '2026-10-06T11:00:10.000Z' }),
    msg({ id: 'u3', createdAt: '2026-10-06T11:00:20.000Z' }),
  ]
  const turn = { phase: 'idle', stage: null, startedAt: null, notice: null, failure: null, blockedUntil: null, endOfTopic: false, resume: async () => undefined } as unknown as ChatTurn
  const html = renderToStaticMarkup(
    createElement(MessageList, {
      chatId: 'chat1',
      messages,
      proposals: [],
      teacherName: '先生',
      turn,
      hasOlder: false,
      loadingOlder: false,
      onLoadOlder: noop,
      onPick: noop,
      onProposalChange: noop,
      onToast: noop,
      handleRef: { current: null },
      renderUser: (m: ChatMessageView): ReactNode =>
        createElement(Fragment, null, createElement('b', { 'data-bubble': m.id }), createElement(HoldProbe, { id: m.id }), createElement(UtteranceReviewSlot, { reviews, message: m })),
      renderTutor: (m: ChatMessageView): ReactNode => createElement('s', { 'data-tutor': m.id }),
      followContent: true,
    }),
  )
  assert.equal(html.match(/aria-expanded="false"/g)?.length, 2, '대상 있는 내 말 u1·u3 에만')
  assert.ok(html.includes('aria-controls="urc-utt1"') && html.includes('aria-controls="urc-utt3"'))
  assert.ok(!html.includes('urc-utt9'), '선생님 말 자리에는 없음')
  // 말풍선 바로 다음에 그 메시지의 카드(교정 카드보다 위)
  assert.match(html, /data-bubble="u1"[\s\S]*?data-hold="u1:function"[\s\S]*?aria-controls="urc-utt1"[\s\S]*?data-tutor="a1"/)
  assert.match(html, /data-bubble="u2"[\s\S]*?data-bubble="u3"[\s\S]*?aria-controls="urc-utt3"/)
  for (const id of ['u1', 'u2', 'u3']) assert.ok(html.includes(`data-hold="${id}:function"`), `${id}: 목록 Provider 아래`)
  assert.equal(renderToStaticMarkup(createElement(HoldProbe, { id: 'out' })), '<i data-hold="out:object"></i>', '목록 밖은 null')
})

/* ── TalkRoom 삽입 정적 경계 ───────────────────────────────── */

test('TalkRoom: import 2 · 훅 1(paused = view.state !== IDLE, 조건부 return 앞) · 슬롯 1(renderUser 의 UserBubble 바로 다음, 교정 카드 위)', () => {
  assert.match(TALK_ROOM, /^import \{ useUtteranceReviews \} from '@\/components\/speech\/useUtteranceReviews'$/m)
  assert.match(TALK_ROOM, /^import \{ UtteranceReviewSlot \} from '@\/components\/speech\/UtteranceReviewCard'$/m)
  const hookAt = TALK_ROOM.indexOf("const reviews = useUtteranceReviews({ chatId, messages, paused: view.state !== 'IDLE' })")
  assert.ok(hookAt > 0, '훅 호출 식')
  assert.ok(TALK_ROOM.indexOf('const view = deriveTalkState(') < hookAt, 'view 를 만든 뒤')
  assert.ok(hookAt < TALK_ROOM.indexOf("if (load === 'loading') {"), '첫 조건부 return 앞(훅 순서 고정)')
  assert.equal(TALK_ROOM.match(/useUtteranceReviews\(/g)?.length, 1)
  assert.equal(TALK_ROOM.match(/<UtteranceReviewSlot /g)?.length, 1)
  const renderUser = TALK_ROOM.slice(TALK_ROOM.indexOf('const renderUser ='), TALK_ROOM.indexOf('const speakingFor ='))
  assert.match(renderUser, /<UserBubble[\s\S]*?\n {8}\/>\n {8}<UtteranceReviewSlot reviews=\{reviews\} message=\{m\} \/>\n {8}\{list\.length > 0/)
})

test('TalkRoom 은 선생님 말·재생·SSE 를 그대로 둔다 — 따라가기 멈춤은 슬롯이 읽고, 방 안 재생 큐는 useTalkPlayback 하나', () => {
  assert.doesNotMatch(TALK_ROOM, /FollowHoldContext|followHold/, '컨텍스트는 슬롯이 읽는다')
  assert.doesNotMatch(TALK_ROOM, /useMinePlayback/, '내 목소리 재생은 기존 replayMine(useTalkPlayback) 하나')
  for (const f of ['renderTutor', 'renderPending']) {
    const start = TALK_ROOM.indexOf(`const ${f} =`)
    const body = TALK_ROOM.slice(start, TALK_ROOM.indexOf('\n  }\n', start))
    assert.doesNotMatch(body, /UtteranceReview/, `${f} 에는 슬롯 없음`)
  }
  // 카드·슬롯은 소리를 내지 않는다(방에서는 말풍선 아래 ▶ 를 쓰라는 안내만) — 두 번째 재생 경로가 생기지 않게.
  assert.doesNotMatch(CARD, /useMinePlayback|playWav|createTtsPlaybackQueue|apiGetAudio|unlockTtsAudio/)
  assert.match(CARD, /const hold = useContext\(FollowHoldContext\)/)
  assert.match(CARD, /onExpand=\{expandHandler\(onExpand, hold\)\}/)
  assert.match(CARD, /if \(!open\) onExpand\?\.\(\)/, '펼칠 때만(접을 때는 부르지 않음)')
})
