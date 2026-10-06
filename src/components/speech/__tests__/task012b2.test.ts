/**
 * task-012b-2 화면 — 재확인 카드·내 발화 기록·평가 채점 글 출처의 순수 판정(가이드 §2·§4·§7)과 서버 렌더 한 번, 화면 파일 정적 경계.
 * 실제 화면(360/390/412 × 780/892, 터치 44px, 스크롤 1곳)은 `tests/live/task012b2-screens.ts` 가 개발 서버에서 본다.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { UtteranceListItem } from '@/types/speech'
import { answerSourceLabel, RESULT } from '@/components/eval/evalCopy'
import UtteranceReviewCard from '../UtteranceReviewCard'
import UtteranceLogEntry from '../UtteranceLogEntry'
import { mineStateOf } from '../useMinePlayback'
import { CHIP_COPY, CONTEXT_COPY, ENTRY_COPY, FIX_COPY, LOG_COPY, REVIEW_COPY, REVIEW_DONE } from '../utteranceCopy'
import {
  applyResolved,
  chipOf,
  contextOf,
  durationSec,
  fixChoice,
  hasRecentVoice,
  hasSecond,
  isReviewable,
  mergeReviews,
  needsDivider,
  resolveFailure,
  REVIEW_POLL_MS,
  REVIEW_WINDOW_MS,
  rowText,
  shouldPoll,
  type ReviewEntry,
} from '../utteranceReview'

const SPEECH = join(process.cwd(), 'src', 'components', 'speech')

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
    chatMessageId: 'msg1',
    context: { kind: 'TALK', id: 'chat1' },
    ...over,
  }
}

/* ── 띄우는 조건 ───────────────────────────────────────────── */

test('isReviewable: 분석 끝·다르게 들림·처음 들린 글 그대로·글 있음·보내는 중 아님일 때만', () => {
  assert.equal(isReviewable(item()), true)
  assert.equal(isReviewable(item({ status: 'QUEUED' })), false)
  assert.equal(isReviewable(item({ status: 'FAILED' })), false)
  assert.equal(isReviewable(item({ requiresReview: false })), false)
  assert.equal(isReviewable(item({ finalSource: 'USER' })), false)
  assert.equal(isReviewable(item({ finalSource: 'ANALYSIS' })), false)
  assert.equal(isReviewable(item({ realtimeText: '   ' })), false)
  assert.equal(isReviewable(item(), 'SENDING'), false)
  assert.equal(isReviewable(item(), 'FAILED'), true)
})

test('hasSecond: 다시 들어 본 글이 있고 처음 들린 글과 다를 때만 두 안(아니면 R3 한 안)', () => {
  assert.equal(hasSecond(item()), true)
  assert.equal(hasSecond(item({ analysisText: null })), false)
  assert.equal(hasSecond(item({ analysisText: '  ' })), false)
  assert.equal(hasSecond(item({ analysisText: ' 駅はどこですか ' })), false)
})

/* ── 직접 고치기 → #21a 본문 ──────────────────────────────── */

test('fixChoice: 빈칸·1,000자 초과는 요청 없음, 같은 글은 그 출처로, 그 밖은 USER(앞뒤 공백 제거)', () => {
  assert.deepEqual(fixChoice('  ', 'あ', 'い'), { ok: false, error: 'empty' })
  assert.deepEqual(fixChoice('あ'.repeat(1001), 'い', null), { ok: false, error: 'tooLong' })
  assert.deepEqual(fixChoice('あ'.repeat(1000), 'い', null), { ok: true, body: { choice: 'USER', text: 'あ'.repeat(1000) } })
  assert.deepEqual(fixChoice(' 駅はどこですか ', '駅はどこですか', '低級はどこですか'), { ok: true, body: { choice: 'REALTIME' } })
  assert.deepEqual(fixChoice('低級はどこですか', '駅はどこですか', '低級はどこですか'), { ok: true, body: { choice: 'ANALYSIS' } })
  assert.deepEqual(fixChoice(' 駅はどこでしょう ', '駅はどこですか', null), { ok: true, body: { choice: 'USER', text: '駅はどこでしょう' } })
})

test('fixChoice: 길이는 코드포인트로 센다(서로게이트 쌍 한 글자)', () => {
  const emoji = String.fromCodePoint(0x1f600)
  assert.equal(fixChoice(emoji.repeat(1000), 'い', null).ok, true)
})

/* ── 칩·쓰인 곳 ───────────────────────────────────────────── */

test('chipOf: 확인 대기 → 확인 필요 · 고친 말 · 다시 들어 본 말로 확인 · 처음 들린 말로 확인 · 할 일 없음 → 칩 없음(L14)', () => {
  assert.deepEqual(chipOf(item()), { tone: 'neutral', label: CHIP_COPY.pending })
  assert.deepEqual(chipOf(item({ finalSource: 'USER', requiresReview: false })), { tone: 'neutral', label: CHIP_COPY.user })
  assert.deepEqual(chipOf(item({ finalSource: 'ANALYSIS', requiresReview: false })), { tone: 'good', label: CHIP_COPY.analysis })
  assert.deepEqual(chipOf(item({ requiresReview: false })), { tone: 'good', label: CHIP_COPY.realtime })
  assert.equal(chipOf(item({ requiresReview: false, wasReviewTarget: false })), null)
  assert.equal(chipOf(item({ status: 'QUEUED', requiresReview: false, wasReviewTarget: false, analysisText: null })), null)
  assert.equal(chipOf(item({ status: 'FAILED', requiresReview: false, wasReviewTarget: false, analysisText: null })), null)
})

test('contextOf: 회화·수업·평가는 id 가 있을 때만 링크, 방만 있음(ROOM_ONLY)·연결 없음(UNSENT)·지운 대화는 링크 없음', () => {
  assert.deepEqual(contextOf({ kind: 'TALK', id: 'chat1' }), { label: '회화', href: '/study/ai/talk/chat1', linkLabel: '회화에서 보기' })
  assert.deepEqual(contextOf({ kind: 'TALK', id: null }), { label: '회화', href: null, linkLabel: null })
  assert.deepEqual(contextOf({ kind: 'LESSON', id: 'l1' }), { label: '오늘의 회화', href: '/study/today/talk/l1', linkLabel: '수업에서 보기' })
  assert.deepEqual(contextOf({ kind: 'EVALUATION', id: 'e1' }), { label: 'AI 평가', href: '/study/today/eval/e1', linkLabel: '평가에서 보기' })
  assert.deepEqual(contextOf({ kind: 'EVALUATION', id: null }), { label: 'AI 평가', href: null, linkLabel: null })
  // REV-135 L-B: 방은 남아 있는데 메시지로 가지 않은 말 — 방 id 가 와도 링크는 아직 없다(링크는 designer 결정).
  assert.deepEqual(contextOf({ kind: 'ROOM_ONLY', id: 'chat1' }), { label: '보내지 않은 말', href: null, linkLabel: null })
  // REV-132 M-3: 방 연결도 없는 말 — 방 밖 녹음·지운 대화·내지 않은 평가 답을 데이터로 가를 수 없어 원인을 단정하지 않는 문구.
  assert.deepEqual(contextOf({ kind: 'UNSENT', id: 'x' }), { label: '연결된 대화 없음', href: null, linkLabel: null })
  assert.doesNotMatch(CONTEXT_COPY.UNSENT.label, /보내지|안 보낸|지운|삭제/)
  assert.notEqual(CONTEXT_COPY.ROOM_ONLY.label, CONTEXT_COPY.UNSENT.label, '두 경우는 화면에서 갈린다')
  assert.deepEqual(contextOf({ kind: 'DELETED', id: null }), { label: '지운 대화', href: null, linkLabel: null })
  assert.equal(contextOf({ kind: 'TALK', id: 'a/b?c' }).href, '/study/ai/talk/a%2Fb%3Fc')
})

test('contextOf: 이 화면이 모르는 kind(서버가 나중에 늘린 값)는 UNSENT 중립 문구·링크 없음 — 화면이 죽지 않는다', () => {
  const neutral = { label: CONTEXT_COPY.UNSENT.label, href: null, linkLabel: null }
  for (const kind of ['SOMETHING_NEW', 'constructor', 'toString', '__proto__', '']) {
    assert.deepEqual(contextOf({ kind, id: 'chat1' } as unknown as Parameters<typeof contextOf>[0]), neutral, kind || '(빈 값)')
  }
})

/* ── 실패·성공 반영 ───────────────────────────────────────── */

test('resolveFailure: 409 이미 처리(R6) · 404 없음(R7) · 429·0·5xx·400 재시도(R8)', () => {
  assert.deepEqual(resolveFailure({ status: 409 }), { phase: 'gone', text: REVIEW_COPY.already })
  assert.deepEqual(resolveFailure({ status: 404 }), { phase: 'missing', text: REVIEW_COPY.missing })
  assert.deepEqual(resolveFailure({ status: 429 }), { phase: 'error', text: REVIEW_COPY.rate })
  assert.deepEqual(resolveFailure({ status: 0 }), { phase: 'error', text: REVIEW_COPY.offline })
  assert.deepEqual(resolveFailure({ status: 500 }), { phase: 'error', text: REVIEW_COPY.failed })
  assert.deepEqual(resolveFailure({ status: 400 }), { phase: 'error', text: REVIEW_COPY.failed })
})

test('applyResolved: 줄 본문은 finalText 로, 칩은 결과로 — 다른 칸은 그대로(L12)', () => {
  const before = item()
  const after = applyResolved(before, { finalText: '低級はどこですか', finalSource: 'ANALYSIS', requiresReview: false })
  assert.equal(rowText(after), '低級はどこですか')
  assert.deepEqual(chipOf(after), { tone: 'good', label: CHIP_COPY.analysis })
  assert.equal(after.realtimeText, before.realtimeText)
  assert.equal(after.audioAvailable, before.audioAvailable)
  assert.equal(rowText(before), '駅はどこですか')
})

/* ── 회화방 갱신 규칙(D-4) ─────────────────────────────────── */

test('주기·창 값: 30초 주기, 6분 창(분석 디바운스 상한 5분 + 여유)', () => {
  assert.equal(REVIEW_POLL_MS, 30_000)
  assert.equal(REVIEW_WINDOW_MS, 360_000)
})

test('hasRecentVoice: 창 안에 만든 내 음성 메시지만 센다(글자 메시지·선생님 메시지·창 밖 제외)', () => {
  const now = Date.parse('2026-10-06T12:00:00Z')
  const at = (sec: number) => new Date(now - sec * 1000).toISOString()
  assert.equal(hasRecentVoice([{ role: 'USER', createdAt: at(30), inputSource: 'REALTIME_STT' }], now), true)
  assert.equal(hasRecentVoice([{ role: 'USER', createdAt: at(361), inputSource: 'REALTIME_STT' }], now), false)
  assert.equal(hasRecentVoice([{ role: 'USER', createdAt: at(10), inputSource: 'TEXT' }], now), false)
  assert.equal(hasRecentVoice([{ role: 'ASSISTANT', createdAt: at(10), inputSource: 'REALTIME_STT' }], now), false)
  assert.equal(hasRecentVoice([{ role: 'USER', createdAt: 'nope', inputSource: 'REALTIME_STT' }], now), false)
  assert.equal(hasRecentVoice([], now), false)
})

test('shouldPoll: 보이고·쉬는 중이고·최근 음성이 있을 때만(턴 중에는 요청 0 — 완료 기준 7)', () => {
  assert.equal(shouldPoll({ visible: true, paused: false, recentVoice: true }), true)
  assert.equal(shouldPoll({ visible: false, paused: false, recentVoice: true }), false)
  assert.equal(shouldPoll({ visible: true, paused: true, recentVoice: true }), false)
  assert.equal(shouldPoll({ visible: true, paused: false, recentVoice: false }), false)
})

test('mergeReviews: 새 대상은 메시지 id 로 붙고, 응답에서 빠진 카드는 사라지되 펼친·기록 중·방금 확정한 카드는 남는다', () => {
  const a = item({ id: 'ua', chatMessageId: 'ma' })
  const b = item({ id: 'ub', chatMessageId: 'mb' })
  const c = item({ id: 'uc', chatMessageId: 'mc' })
  const first = mergeReviews(new Map(), [a, b, c, item({ id: 'ud', chatMessageId: null }), item({ id: 'ue', chatMessageId: 'me', requiresReview: false })], new Set())
  assert.deepEqual([...first.keys()].sort(), ['ma', 'mb', 'mc'])
  const withResolved = new Map<string, ReviewEntry>(first)
  withResolved.set('mc', { item: c, resolved: 'USER' })
  const next = mergeReviews(withResolved, [], new Set(['ua']))
  assert.deepEqual([...next.keys()].sort(), ['ma', 'mc'])
  assert.equal(next.get('mc')?.resolved, 'USER')
  const refreshed = mergeReviews(first, [item({ id: 'ua', chatMessageId: 'ma', analysisText: '新しい' })], new Set(['ua']))
  assert.equal(refreshed.get('ma')?.item.analysisText, '低級はどこですか')
})

test('durationSec·needsDivider: 최소 1초 반올림 · KST 날짜가 바뀔 때만 구분선', () => {
  assert.equal(durationSec(0), 1)
  assert.equal(durationSec(2400), 2)
  assert.equal(durationSec(2600), 3)
  assert.equal(needsDivider(null, '2026-10-06T11:00:00Z'), true)
  assert.equal(needsDivider('2026-10-06T14:00:00Z', '2026-10-06T15:30:00Z'), true)
  assert.equal(needsDivider('2026-10-06T11:00:00Z', '2026-10-06T10:00:00Z'), false)
})

test('mineStateOf: 다른 줄·쉼 → idle, 첫 소리 전 → loading, 재생 중 → playing', () => {
  assert.equal(mineStateOf({ phase: 'idle', messageId: null, chunkIndex: null }, 'u1'), 'idle')
  assert.equal(mineStateOf({ phase: 'playing', messageId: 'u2', chunkIndex: 0 }, 'u1'), 'idle')
  assert.equal(mineStateOf({ phase: 'waiting', messageId: 'u1', chunkIndex: null }, 'u1'), 'loading')
  assert.equal(mineStateOf({ phase: 'playing', messageId: 'u1', chunkIndex: null }, 'u1'), 'loading')
  assert.equal(mineStateOf({ phase: 'playing', messageId: 'u1', chunkIndex: 0 }, 'u1'), 'playing')
})

/* ── 평가 채점 글 출처(§2-E, D-B7) ─────────────────────────── */

test('answerSourceLabel: TEXT(발화 없음) 글자로 답함 · TEXT+voiced 내가 고친 말 · SERVER_STT 다시 들어 본 말 · REALTIME_STT 처음 들린 말 · null 줄 없음', () => {
  assert.equal(answerSourceLabel({ inputSource: 'TEXT' }), RESULT.byText)
  assert.equal(answerSourceLabel({ inputSource: 'TEXT', voiced: false }), '글자로 답함')
  assert.equal(answerSourceLabel({ inputSource: 'TEXT', voiced: true }), '말로 답함 · 내가 고친 말로 채점했어요')
  assert.equal(answerSourceLabel({ inputSource: 'SERVER_STT', voiced: true }), '말로 답함 · 다시 들어 본 말로 채점했어요')
  assert.equal(answerSourceLabel({ inputSource: 'REALTIME_STT', voiced: true }), '말로 답함 · 처음 들린 말로 채점했어요')
  assert.equal(answerSourceLabel({ inputSource: null }), null)
})

/* ── 서버 렌더 ─────────────────────────────────────────────── */

const noop = () => undefined

test('카드(방·접힘 R1): 44px 접힘 줄 하나, aria-expanded=false, 두 안·버튼은 아직 없음', () => {
  const html = renderToStaticMarkup(createElement(UtteranceReviewCard, { item: item(), variant: 'room', open: false, onToggle: noop, onResolved: noop }))
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-controls="urc-utt1"/)
  assert.match(html, /min-h-11/)
  assert.ok(html.includes(REVIEW_COPY.title) && html.includes(REVIEW_COPY.teaser))
  assert.ok(!html.includes(REVIEW_COPY.save))
  assert.ok(!html.includes('type="radio"'))
})

test('카드(방·펼침 R2): 두 안 라디오·주 버튼·직접 고치기·나중에·효과 안내·소리 힌트, 일본어는 lang="ja"', () => {
  const html = renderToStaticMarkup(createElement(UtteranceReviewCard, { item: item(), variant: 'room', open: true, onToggle: noop, onResolved: noop }))
  assert.match(html, /aria-expanded="true"/)
  assert.equal(html.match(/type="radio"/g)?.length, 2)
  for (const s of [REVIEW_COPY.intro, REVIEW_COPY.realtimeHead, REVIEW_COPY.analysisHead, REVIEW_COPY.save, REVIEW_COPY.fix, REVIEW_COPY.later, REVIEW_COPY.effect, REVIEW_COPY.audioHint]) assert.ok(html.includes(s), s)
  const plain = html.replace(/<[^>]+>/g, '')
  assert.ok(plain.includes('駅はどこですか') && plain.includes('低級はどこですか'))
  assert.match(html, /<span class="underline decoration-accent[^"]*">駅<\/span>/, '다른 곳 밑줄')
  assert.match(html, /lang="ja"/)
  assert.match(html, /aria-disabled="true"/)
})

test('카드(한 안 R3): 둘째 안이 없으면 라디오 없이 [이대로 기록하기]와 안내', () => {
  const html = renderToStaticMarkup(createElement(UtteranceReviewCard, { item: item({ analysisText: '' }), variant: 'log', open: true, onResolved: noop }))
  assert.ok(!html.includes('type="radio"'))
  assert.ok(html.includes(REVIEW_COPY.noSecond) && html.includes(REVIEW_COPY.keepAsIs))
  assert.ok(!html.includes(REVIEW_COPY.later), '기록 화면에는 [나중에] 없음')
  assert.ok(!html.includes(REVIEW_COPY.audioHint), '소리 힌트는 방에서만')
})

test('카드(R0·R5): 대상이 아니면 자리 0, 이 방에서 확정했으면 성공 줄(role=status)', () => {
  assert.equal(renderToStaticMarkup(createElement(UtteranceReviewCard, { item: item({ requiresReview: false }), variant: 'room', open: false, onResolved: noop })), '')
  assert.equal(renderToStaticMarkup(createElement(UtteranceReviewCard, { item: item({ status: 'QUEUED' }), variant: 'log', open: true, onResolved: noop })), '')
  const done = renderToStaticMarkup(createElement(UtteranceReviewCard, { item: item(), variant: 'room', open: false, resolved: 'ANALYSIS', onResolved: noop }))
  assert.match(done, /role="status"/)
  assert.ok(done.includes(REVIEW_DONE.ANALYSIS))
})

test('설정 진입 줄: 늘 보이는 56px 링크(/settings/utterances), 받기 전엔 배지 없음', () => {
  const html = renderToStaticMarkup(createElement(UtteranceLogEntry))
  assert.match(html, /href="\/settings\/utterances"/)
  assert.match(html, /min-h-14/)
  assert.ok(html.includes(ENTRY_COPY.title) && html.includes(ENTRY_COPY.sub))
  assert.ok(!html.includes('확인 '))
})

/* ── 정적 경계 ─────────────────────────────────────────────── */

const NEW_FILES = ['UtteranceReviewCard.tsx', 'UtteranceFixSheet.tsx', 'UtteranceLog.tsx', 'UtteranceLogEntry.tsx', 'useUtteranceReviews.ts', 'useMinePlayback.ts', 'utteranceReview.ts', 'utteranceCopy.ts']

test('화면 파일은 서버 모듈을 import 하지 않는다(클라이언트 안전 재생 큐 `speech/tts/client` 만 예외)', () => {
  for (const f of NEW_FILES) {
    const src = readFileSync(join(SPEECH, f), 'utf8')
    const mods = [...src.matchAll(/from '(@\/modules\/[^']+)'/g)].map((m) => m[1])
    assert.deepEqual(mods.filter((m) => m !== '@/modules/speech/tts/client'), [], f)
    assert.doesNotMatch(src, /@\/types\/chat'/, `${f}: types/chat 금지`)
  }
  const page = readFileSync(join(process.cwd(), 'src/app/(app)/settings/utterances/page.tsx'), 'utf8')
  assert.match(page, /redirect\(`\/login\?callbackUrl=/)
})

test('문구·화면에 엔진 이름·신뢰도 숫자·"분석"·"인식률" 없음', () => {
  const copy = JSON.stringify({ REVIEW_COPY, REVIEW_DONE, FIX_COPY: { ...FIX_COPY, count: FIX_COPY.count(3) }, LOG_COPY: { ...LOG_COPY, review: LOG_COPY.review(2), seconds: LOG_COPY.seconds(3), mineAria: LOG_COPY.mineAria('10:00') }, CHIP_COPY, ENTRY_COPY: ENTRY_COPY.title })
  for (const banned of ['분석', '인식률', '0.85', '0.9', 'reazon', 'whisper', 'style-bert', 'claude', 'sherpa', 'confidence']) assert.ok(!copy.toLowerCase().includes(banned.toLowerCase()), banned)
  for (const f of readdirSync(SPEECH).filter((n) => NEW_FILES.includes(n))) {
    const src = readFileSync(join(SPEECH, f), 'utf8').toLowerCase()
    for (const banned of ['reazon', 'whisper', 'style-bert', 'sbv2', 'transcriptconfidence', 'engineversions']) assert.ok(!src.includes(banned), `${f}: ${banned}`)
  }
})

test('카드는 conversation·채팅 DTO 를 바꾸지 않는다 — #21a 만 부르고 말풍선·교정 글은 건드리지 않는다(D-B6)', () => {
  const card = readFileSync(join(SPEECH, 'UtteranceReviewCard.tsx'), 'utf8')
  const calls = [...card.matchAll(/api(Get|Post|Patch|Put|Delete)\b/g)].map((m) => m[1])
  assert.deepEqual([...new Set(calls)], ['Patch'])
  assert.match(card, /`\/api\/v1\/speech\/utterances\/\$\{encodeURIComponent\(item\.id\)\}`/)
})
