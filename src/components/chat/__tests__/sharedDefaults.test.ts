import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChatMessageView, ProposalDto } from '@/types/chat'
import { DisplayBar } from '@/components/common/japanese/JapaneseText'
import { readCode } from '../../__tests__/sourceCode'
import Composer from '../Composer'
import { annotatedMessages } from '../messages'
import ProposalCard from '../ProposalCard'
import { buildTurnBody, DEFAULT_INPUT_SOURCE } from '../turnBody'

// task-064 §25-11 ⑯ (REV-064-U1 M-1) — 질문 방이 확장한 공용 부품은 옵션을 넘기지 않으면 회화·채팅 동작이 그대로다.
// 특히 요청 본문의 `scope`: 서버가 TALK·CHAT 의 `scope` 를 400 으로 거절하므로 옵션 없는 전송에 키가 새면 회화·채팅 전송이 깨진다.

const noop = () => {}

// ── useChatTurn — 요청 본문 ─────────────────────────────────────────────────────

test('⑯ buildTurnBody — 옵션이 없으면 text·inputSource 두 키뿐(scope 키 자체가 없다)', () => {
  const body = buildTurnBody('こんにちは')
  assert.deepEqual(body, { text: 'こんにちは', inputSource: 'TEXT' })
  assert.equal(DEFAULT_INPUT_SOURCE, 'TEXT')
  assert.equal('scope' in body, false)
  assert.deepEqual(buildTurnBody('a', {}), { text: 'a', inputSource: 'TEXT' })
  // 회화방이 늘 넘기는 옵션(입력 경로·발화 id·계측)에도 scope 는 없다
  const talk = buildTurnBody('a', { inputSource: 'REALTIME_STT', utteranceId: 'u1', clientTimings: { sttMs: 1 } as never, coachRevealed: true })
  assert.equal('scope' in talk, false)
  assert.deepEqual(Object.keys(talk).sort(), ['clientTimings', 'coachRevealed', 'inputSource', 'text', 'utteranceId'])
  // 비어 있는 값은 키를 만들지 않는다
  assert.deepEqual(buildTurnBody('a', { utteranceId: null, coachRevealed: false }), { text: 'a', inputSource: 'TEXT' })
})

test('⑯ buildTurnBody — scope 옵션이 있을 때만 {key} 로 싣는다(질문 방 되묻기 칩)', () => {
  assert.deepEqual(buildTurnBody('이번 주', { scope: { key: 'THIS_WEEK' } }), { text: '이번 주', inputSource: 'TEXT', scope: { key: 'THIS_WEEK' } })
  // 입력 객체의 다른 칸을 본문으로 흘리지 않는다
  const body = buildTurnBody('a', { scope: { key: 'ALL', extra: 'x' } as never })
  assert.deepEqual(body.scope, { key: 'ALL' })
})

test('⑯ useChatTurn.send 는 본문을 buildTurnBody 로만 만든다(scope 를 따로 싣는 길이 없다)', () => {
  const code = readCode('src/components/chat/useChatTurn.ts')
  assert.match(code, /await this\.run\(buildTurnBody\(text, opts\), ctx\)/)
  assert.ok(!/body\.scope|scope:\s*\{/.test(code), 'send 안에서 scope 를 직접 싣는 코드가 있다')
  const body = readCode('src/components/chat/turnBody.ts')
  assert.match(body, /if \(opts\.scope\) body\.scope = \{ key: opts\.scope\.key \}/)
})

// ── MessageList — 분석 요청 대상 ───────────────────────────────────────────────

const m = (id: string, role: 'USER' | 'ASSISTANT', status: ChatMessageView['status']): ChatMessageView =>
  ({ id, role, content: `본문 ${id}`, status, createdAt: '2026-10-12T03:00:00.000Z' }) as ChatMessageView

test('⑯ annotatedMessages — 기본(annotate 생략) = 내 말 + 끝난 선생님 말만, false 면 하나도 없다', () => {
  const ms = [m('u1', 'USER', 'DONE'), m('a1', 'ASSISTANT', 'DONE'), m('a2', 'ASSISTANT', 'PENDING'), m('a3', 'ASSISTANT', 'FAILED'), m('u2', 'USER', 'DONE')]
  assert.deepEqual(annotatedMessages(ms).map((x) => x.id), ['u1', 'a1', 'u2'])
  assert.deepEqual(annotatedMessages(ms, true).map((x) => x.id), ['u1', 'a1', 'u2'])
  assert.deepEqual(annotatedMessages(ms, false), [])
  assert.deepEqual(annotatedMessages([]), [])
})

test('⑯ MessageList — annotate 기본값 true · 분석 대상은 annotatedMessages 한 곳 · 기본 슬롯(PendingBubble·FailedBubble)이 그대로', () => {
  const code = readCode('src/components/chat/MessageList.tsx')
  assert.match(code, /\bannotate = true,/)
  assert.match(code, /annotatedMessages\(messages, annotate\)/)
  // 슬롯을 안 넘기면 기본 말풍선
  assert.match(code, /renderTrailingPending \? \(\s*renderTrailingPending\(\)\s*\) : \(\s*<PendingBubble /)
  assert.match(code, /else if \(isLast\) \{\s*node = <FailedBubble /)
  assert.match(code, /focusable = false,/)
  assert.match(code, /tabIndex=\{focusable \? -1 : undefined\}/)
})

// ── Composer ──────────────────────────────────────────────────────────────────

const composer = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(Composer, { chatId: 'c1', busy: false, blockedUntil: null, placeholder: '메시지', onSend: noop, onBlocked: noop, handleRef: { current: null }, ...props } as never),
  )

test('⑯ Composer — 기본은 lang="ja" · 이름 「메시지 입력」 · 기다리는 동안 보내기 이름 「선생님 답을 기다리는 중이에요」', () => {
  const html = composer()
  assert.match(html, /<textarea[^>]*\blang="ja"/)
  assert.match(html, /<textarea[^>]*aria-label="메시지 입력"/)
  assert.match(html, /<button type="submit" aria-label="보내기"/)
  const busy = composer({ busy: true })
  assert.match(busy, /<button type="submit" aria-label="선생님 답을 기다리는 중이에요"/)
})

test('⑯ Composer — lang="ko" 는 lang 속성을 달지 않고, inputLabel·busyReason 은 넘긴 값', () => {
  const html = composer({ lang: 'ko', inputLabel: '질문 입력', busy: true, busyReason: '답을 만드는 중이에요' })
  assert.ok(!/<textarea[^>]*\blang=/.test(html))
  assert.match(html, /aria-label="질문 입력"/)
  assert.match(html, /<button type="submit" aria-label="답을 만드는 중이에요"/)
  assert.ok(!html.includes('메시지 입력') && !html.includes('선생님 답을 기다리는 중이에요'))
})

// ── ProposalCard ──────────────────────────────────────────────────────────────

const proposal = (kind: string, payload: Record<string, unknown> = {}, status = 'PROPOSED'): ProposalDto => ({ id: 'p1', kind, payload, status, messageId: 'a1' }) as ProposalDto
const card = (p: ProposalDto, context?: 'chat' | 'ask') => renderToStaticMarkup(createElement(ProposalCard, { proposal: p, onChange: noop, onToast: noop, ...(context ? { context } : {}) }))

test('⑯ ProposalCard — 기본 context 는 chat: 공부 기록 제안 문구가 채팅 문구 그대로(메시지·교정 수 줄 포함)', () => {
  const p = proposal('ADD_STUDY_LOG', { messageCount: 12, correctionCount: 3 })
  const html = card(p)
  assert.ok(html.includes('이 채팅을 공부 기록으로 남길까요?'))
  assert.ok(html.includes('메시지 12개 · 교정 3건'))
  assert.ok(html.includes('남기면 달력과 통계에 기록돼요. 선생님 제안이라 남기기를 눌러야 저장돼요.'))
  assert.equal(card(p, 'chat'), html, "context='chat' 은 생략과 같다")
  // 질문 방에서는 문구와 수 줄이 갈린다
  const ask = card(p, 'ask')
  assert.ok(!ask.includes('이 채팅을 공부 기록으로 남길까요?') && !ask.includes('메시지 12개'))
})

test('⑯ ProposalCard — 모르는 종류는 어떤 context 에서도 아무것도 그리지 않는다(공부 기록 카드로 잘못 그리지 않음)', () => {
  for (const kind of ['ADD_TOPIC', 'SCHEDULE_REVIEW', 'WHATEVER']) {
    assert.equal(card(proposal(kind)), '', kind)
    assert.equal(card(proposal(kind), 'ask'), '', kind)
  }
  // 레벨 제안은 레벨 값이 없으면 그리지 않는다
  assert.equal(card(proposal('SET_LEVEL', {})), '')
  assert.ok(card(proposal('SET_LEVEL', { level: 'N4' })).includes('N4'))
  // 단어 제안(채팅이 늘 쓰던 종류)은 그대로
  assert.ok(card(proposal('ADD_WORD', { surface: '駅', reading: 'えき', meaning: '역' })).includes('駅'))
})

test('⑯ ProposalCard — context 기본값 chat · 모르는 종류 가드 · 채택 알림은 단어 → 레벨 → 기록 순(소스)', () => {
  const code = readCode('src/components/chat/ProposalCard.tsx')
  assert.match(code, /context = 'chat',/)
  assert.match(code, /if \(proposal\.kind !== 'ADD_STUDY_LOG'\) return null/)
  assert.match(code, /onToast\(isWord \? '단어장에 추가했어요' : level \? ASK_COPY\.level\.toast\(levelRo\(level\.to\)\) : '공부 기록에 남겼어요'\)/)
})

// ── DisplayBar ────────────────────────────────────────────────────────────────

const bar = (keys?: ('fu' | 'hg' | 'tr')[]) => renderToStaticMarkup(createElement(DisplayBar, { onToast: noop, ...(keys ? { keys } : {}) }))
const switches = (html: string) => (html.match(/<button [^>]*aria-pressed=/g) ?? []).length

test('⑯ DisplayBar — keys 기본은 세 토글(히라가나·한글·번역), 질문 방은 둘', () => {
  assert.equal(switches(bar()), 3)
  for (const label of ['히라가나', '한글', '번역']) assert.ok(bar().includes(label), label)
  assert.equal(bar(), bar(['fu', 'hg', 'tr']), '생략 = 세 토글')
  assert.equal(switches(bar(['fu', 'hg'])), 2)
  const code = readCode('src/components/common/japanese/JapaneseText.tsx')
  assert.match(code, /keys = \['fu', 'hg', 'tr'\],/)
  assert.match(code, /<DisplayToggles keys=\{keys\} onToast=\{onToast\} \/>/)
})
