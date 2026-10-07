import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COPY } from '../challengeCopy'
import { blockedNoteText, resultNextView, type RetryGate } from '../logic'

/**
 * REV-165 M-1(task-045 T5-polish) — 주제가 지워진 챌린지의 결과 화면은 같은 주제 [다시 도전]이 없으므로,
 * 다른 챌린지가 진행 중이어도 「끝나면 다시 도전할 수 있어요」 라고 약속하지 않는다. 위 줄과 아래 상자가 서로 어긋나지 않게
 * (주제 있음/없음 × 다른 챌린지 진행 중 유무) 네 조합의 글을 고정한다.
 */
const show: RetryGate = { kind: 'show' }
const blocked: Extract<RetryGate, { kind: 'blocked' }> = { kind: 'blocked', id: 'ch2', title: '병원', dayIndex: 2 }
const present = { id: 't1', exists: true }
const gone = { id: null, exists: false }

/** 화면(`ChallengeScreen`)이 그리는 「다음 챌린지」 글 — 위 줄 + 아래 상자(진행 중일 때만). */
function nextText(topic: { id: string | null; exists: boolean }, retry: RetryGate) {
  const next = resultNextView(topic, retry)
  return { body: next.topicGone ? COPY.nextBodyNoTopic : COPY.nextBody, retryButton: next.showRetry, note: retry.kind === 'blocked' ? blockedNoteText(retry, next.topicGone) : null }
}

test('네 조합 문구 고정: 주제 있음/없음 × 다른 챌린지 진행 중 유무', () => {
  assert.deepEqual(nextText(present, show), { body: '같은 주제로 한 번 더 하거나, 다음 주제로 넘어가 보세요.', retryButton: true, note: null })
  assert.deepEqual(nextText(gone, show), { body: '다음 주제로 넘어가 보세요.', retryButton: false, note: null })
  assert.deepEqual(nextText(present, blocked), {
    body: '같은 주제로 한 번 더 하거나, 다음 주제로 넘어가 보세요.',
    retryButton: false,
    note: '지금은 「병원」(2일째)를 하고 있어요. 진행 중인 챌린지가 끝나면 다시 도전할 수 있어요.',
  })
  assert.deepEqual(nextText(gone, blocked), { body: '다음 주제로 넘어가 보세요.', retryButton: false, note: '지금은 「병원」(2일째)를 하고 있어요.' })
})

test('주제가 지워졌으면 아래 상자에 「다시 도전할 수 있어요」 가 없다(모순 방지) · exists:false 만 있어도 같다', () => {
  for (const topic of [gone, { id: 't1', exists: false }]) {
    const t = nextText(topic, blocked)
    assert.ok(!/다시 도전/.test(t.note ?? ''), '같은 주제 [다시 도전]이 없으니 약속하지 않는다')
    assert.ok(!/삭제/.test(t.note ?? ''), '「삭제됨」 표기는 하지 않는다')
  }
})

test('진행 중 챌린지가 오늘 시작 전이면 「내일 시작」 으로 쓴다(기존 글 그대로)', () => {
  assert.equal(blockedNoteText({ ...blocked, dayIndex: 0 }, false), '지금은 「병원」(내일 시작)를 하고 있어요. 진행 중인 챌린지가 끝나면 다시 도전할 수 있어요.')
  assert.equal(blockedNoteText({ ...blocked, dayIndex: 0 }, true), '지금은 「병원」(내일 시작)를 하고 있어요.')
})

test('화면이 이 함수를 쓰고 옛 글이 인라인으로 남아 있지 않다 · 새 문구에 「세요」(세다) 오독 표현이 없다', () => {
  const src = readFileSync(join(__dirname, '..', 'ChallengeScreen.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  assert.match(src, /blockedNoteText\(retry, next\.topicGone\)/)
  assert.ok(!/끝나면 다시 도전할 수 있어요/.test(src), '화면에 인라인 문구가 없다')
  for (const t of [COPY.blockedAgain, COPY.blockedNow('병원', 2)]) assert.ok(!/세요/.test(t), t)
})
