/**
 * task-010c 회화방 교정 표시(순수) — 모아 둔 교정은 대화 속에 그리지 않고, 코치 힌트 카드는 정답 공개 규칙(결정 b=B)을 따른다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correctionFromDone } from '@/components/chat/messages'
import type { ChatMessageView, CorrectionDto } from '@/types/chat'
import { applySelfCheck, coachCardView, isInlineCorrection, waitingCoach } from '../correctionView'

const cr = (over: Partial<CorrectionDto> = {}): CorrectionDto => ({
  id: 'cr_1',
  status: 'PROPOSED',
  original: '行くました',
  corrected: '行きました',
  explanation: '설명',
  errorType: 'CONJUGATION',
  severity: 'MINOR',
  chunkType: null,
  ...over,
})

const user = (id: string, corrections: CorrectionDto[] = []): ChatMessageView => ({ id, role: 'USER', content: 'x', status: 'DONE', createdAt: '2026-10-01T00:00:00Z', corrections })
const tutor = (id: string): ChatMessageView => ({ id, role: 'ASSISTANT', content: 'y', status: 'DONE', createdAt: '2026-10-01T00:00:01Z' })

test('대화 속 카드: LATER 만 빠진다(필드 없는 옛 교정 = NOW)', () => {
  assert.equal(isInlineCorrection(cr()), true)
  assert.equal(isInlineCorrection(cr({ deliver: 'NOW' })), true)
  assert.equal(isInlineCorrection(cr({ deliver: 'LATER' })), false)
})

test('코치 카드: 힌트 없으면 기존 카드 / 힌트 있으면 공개 전 닫힘 → [정답 보기] 뒤 "정답을 보고 다시 말해 보세요"', () => {
  assert.deepEqual(coachCardView(cr(), false), { open: true, badge: null, line: null })
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트' }), false), { open: false, badge: null, line: null })
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트' }), true), { open: true, badge: null, line: 'afterReveal' })
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트', status: 'ACCEPTED' }), true), { open: true, badge: null, line: null })
})

test('코치 카드 판정: SELF·REPEAT 는 배지+줄로 열림, MISSED 는 자동 공개(+안내 줄, 이미 열었으면 줄 없음)', () => {
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트', selfCheck: 'SELF' }), false), { open: true, badge: 'SELF', line: 'self' })
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트', selfCheck: 'REPEAT' }), true), { open: true, badge: 'REPEAT', line: 'repeat' })
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트', selfCheck: 'MISSED' }), false), { open: true, badge: null, line: 'missed' })
  assert.deepEqual(coachCardView(cr({ hintKo: '힌트', selfCheck: 'MISSED' }), true), { open: true, badge: null, line: null })
})

test('다시 말해 보기를 기다리는 카드: 마지막 저장된 사용자 말의 힌트·미판정·제안 교정만', () => {
  const hint = cr({ id: 'h', hintKo: '힌트' })
  assert.equal(waitingCoach([user('u1', [hint]), tutor('a1')])?.id, 'h')
  assert.equal(waitingCoach([user('u1', [hint]), tutor('a1'), user('u2'), tutor('a2')]), null, '직전 말이 아니면 지나간 힌트')
  assert.equal(waitingCoach([user('u1', [hint]), tutor('a1'), user('tmp_1')]), null, '보내는 중인 말이 있으면 판정은 그 턴 몫')
  assert.equal(waitingCoach([user('u1', [{ ...hint, selfCheck: 'MISSED' }])]), null)
  assert.equal(waitingCoach([user('u1', [{ ...hint, status: 'REJECTED' }])]), null)
  assert.equal(waitingCoach([user('u1', [cr()])]), null, '힌트 없는 교정')
})

test('done.selfCheck 를 그 교정에 단다 + done 교정의 deliver·hintKo 를 #29 모양으로 옮긴다', () => {
  const ms = [user('u1', [cr({ id: 'h', hintKo: '힌트' })]), tutor('a1')]
  const out = applySelfCheck(ms, { correctionId: 'h', result: 'SELF' })
  assert.equal(out[0].corrections?.[0].selfCheck, 'SELF')
  assert.equal(ms[0].corrections?.[0].selfCheck, undefined, '원본 불변')
  const c = correctionFromDone({ id: 'n', original: 'a', corrected: 'b', explanationKo: 'e', errorType: 'PARTICLE', severity: 'MINOR', deliver: 'LATER', hintKo: null })
  assert.equal(c.deliver, 'LATER')
  assert.equal(c.hintKo, null)
  const old = correctionFromDone({ id: 'o', original: 'a', corrected: 'b', errorType: 'PARTICLE', severity: 'MINOR' })
  assert.equal('deliver' in old, false, '옛 done(필드 없음)은 그대로')
})
