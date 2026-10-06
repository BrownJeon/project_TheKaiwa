import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import { parseCreateChat, parseTitle, parseTurnBody } from '../chats/validate'
import { isRetryableTurnError, shapeTurnResponse, turnErrorMessage } from '../orchestrator/shape'
import { TurnStream, type TurnEvent } from '../orchestrator/stream'
import { currentTurnLock, isStalePending, releaseTurnLock, STALE_PENDING_MS, tryAcquireTurnLock } from '../orchestrator/locks'
import { mergeReviewCandidates, serverOriginal } from '../review/filter'
import { isProposalExpired, parsePayloadOverride, PROPOSAL_TTL_MS } from '../proposals'
import { topWeaknesses } from '../turnContext'
import type { CorrectionUpdate } from '../corrections'
import type { ChatReviewResponse, ReviewItem, TutorResponse } from '../structuredResponse/schemas'

const code = (c: string) => (e: unknown) => e instanceof ApiError && e.code === c

test('턴 본문: 빈 문자열·공백/제어문자만·1,001자는 400, 1,000자·이모지는 통과(저장값 바이트 동일)', () => {
  assert.throws(() => parseTurnBody({ text: '' }), code('VALIDATION'))
  assert.throws(() => parseTurnBody({ text: ' \u0000\u0007 \n\t' }), code('VALIDATION'))
  assert.throws(() => parseTurnBody({ text: 'あ'.repeat(1001) }), code('VALIDATION'))
  assert.throws(() => parseTurnBody({}), code('VALIDATION'))
  const ok = parseTurnBody({ text: '😀'.repeat(1000) })
  assert.equal(ok.resume, false)
  const emoji = parseTurnBody({ text: '今日は😀楽しかった🎉' })
  assert.ok(!emoji.resume && emoji.text === '今日は😀楽しかった🎉' && emoji.inputSource === 'TEXT')
  const nl = parseTurnBody({ text: '一行目\r\n二行目\t終わり\u0000' })
  assert.ok(!nl.resume && nl.text === '一行目\n二行目\t終わり', 'D10: \\n·\\t 보존, 그 밖 제어문자 제거')
})

test('턴 본문: utteranceId 없는 REALTIME_STT 는 400, utteranceId 는 task-007 부터 받는다, resumePending 은 다른 필드 무시', () => {
  assert.throws(() => parseTurnBody({ text: 'はい', inputSource: 'REALTIME_STT' }), code('VALIDATION'))
  const voice = parseTurnBody({ text: 'はい', inputSource: 'REALTIME_STT', utteranceId: 'u_1' })
  assert.ok(!voice.resume && voice.utteranceId === 'u_1' && voice.inputSource === 'REALTIME_STT')
  assert.throws(() => parseTurnBody({ text: 'はい', inputSource: 'VOICE' }), code('VALIDATION'))
  assert.deepEqual(parseTurnBody({ resumePending: true, text: '' }), { resume: true })
  assert.throws(() => parseTurnBody({ resumePending: 'yes', text: 'a' }), code('VALIDATION'))
})

test('대화 생성: ASK 는 FEATURE_NOT_READY, 제목은 100 코드포인트(이모지 1자), 비면 null', () => {
  assert.throws(() => parseCreateChat({ kind: 'ASK' }), code('FEATURE_NOT_READY'))
  // task-010d A3b-1(G1 해제): 레슨·상황 칸은 여기서 보지 않는다 — parseRolePlayIds 로 따로 읽고, CHAT 이면 createRolePlayChat 이 400(task010d·task010dA3b 시험).
  assert.deepEqual(parseCreateChat({ kind: 'CHAT', lessonId: 'ls_1' }), { kind: 'CHAT', title: null, topicId: null, level: null })
  assert.throws(() => parseCreateChat({ kind: 'NOPE' }), code('VALIDATION'))
  assert.throws(() => parseCreateChat({ kind: 'CHAT', level: 'N6' }), code('VALIDATION'))
  assert.equal(parseCreateChat({ kind: 'CHAT', title: '🎉'.repeat(100) }).title, '🎉'.repeat(100))
  assert.throws(() => parseCreateChat({ kind: 'CHAT', title: '🎉'.repeat(101) }), code('VALIDATION'))
  assert.equal(parseCreateChat({ kind: 'CHAT', title: '  \n ' }).title, null)
  assert.throws(() => parseTitle('   ', { required: true }), code('VALIDATION'))
  assert.equal(parseTitle('여행\n계획', { required: true }), '여행계획', '제목은 한 줄')
})

const reply = { replyJa: 'そうですね。何を見ましたか？', replyKo: '그렇군요. 무엇을 봤나요?' }
const base: TutorResponse = { conversation: reply, correction: null, learning: { grammarPoint: null, difficulty: 'N5' }, speech: { style: 'NEUTRAL' }, endOfTopic: false, proposals: [], userKo: '어제 영화를 봤어요.' }
const corr = (original: string, corrected = '昨日映画を見に行きました') => ({ required: true, original, corrected, explanationKo: '설명', errorType: 'CONJUGATION' as const, severity: 'MINOR' as const, chunkType: 'ACTION' as const, hintKo: null })

test('턴 후처리: CHAT 교정은 항상 null, TALK 는 서버 text 와 바이트 일치할 때만 남기고 불일치는 경고', () => {
  const text = '昨日映画を見に行くました'
  assert.equal(shapeTurnResponse('CHAT', text, { ...base, correction: corr(text) }).correction, null)
  const ok = shapeTurnResponse('TALK', text, { ...base, correction: corr(text) })
  assert.equal(ok.correction?.original, text)
  assert.equal(ok.warning, null)
  const bad = shapeTurnResponse('TALK', text, { ...base, correction: corr('昨日映画を見に行くました。') })
  assert.equal(bad.correction, null)
  assert.equal(bad.warning, 'CORRECTION_ORIGINAL_MISMATCH')
  assert.equal(shapeTurnResponse('TALK', text, { ...base, correction: corr(text, text) }).correction, null, 'corrected==original 은 오류 없음')
})

test('턴 후처리: ADD_WORD 제안은 표현 중복 제거·최대 2개', () => {
  const p = (surface: string) => ({ kind: 'ADD_WORD' as const, payload: { surface, reading: '', meaning: 'm' } })
  const s = shapeTurnResponse('CHAT', 'x', { ...base, proposals: [p('映画'), p('映画'), p('駅'), p('本')] })
  assert.deepEqual(s.proposals.map((x) => x.payload.surface), ['映画', '駅'])
})

test('턴 오류 문구·재시도 가능 여부 — 엔진·모델 이름이 섞이지 않는다', () => {
  for (const c of ['ENGINE_TIMEOUT', 'ENGINE_UNAVAILABLE', 'ENGINE_ERROR', 'CONFLICT', 'INTERNAL']) {
    assert.doesNotMatch(turnErrorMessage(c), /claude|haiku|sonnet|opus|qwen|엔진/i)
    assert.equal(isRetryableTurnError(c), true)
  }
  assert.equal(isRetryableTurnError('VALIDATION'), false)
})

test('TurnStream: 늦게 붙은 구독자도 지난 이벤트를 받고, 구독을 놓아도 처리 쪽 emit/finish 는 계속된다', async () => {
  const s = new TurnStream()
  s.emit({ event: 'accepted', data: 1 })
  const got: TurnEvent[] = []
  const p = s.subscribe((e) => got.push(e))
  s.emit({ event: 'status', data: 2 })
  const thrower = s.subscribe(() => {
    throw new Error('끊긴 연결')
  })
  s.emit({ event: 'done', data: 3 })
  s.finish()
  await p
  await thrower
  assert.deepEqual(got.map((e) => e.event), ['accepted', 'status', 'done'])
  const late: TurnEvent[] = []
  await s.subscribe((e) => late.push(e))
  assert.equal(late.length, 3, '끝난 뒤 구독도 전부 재생')
})

test('사용자당 턴 락: 두 번째는 실패, 자기 락만 풀고, stale 은 180초 초과 + 로컬 미실행만', () => {
  const a = tryAcquireTurnLock('u_test', 'c1')
  assert.ok(a)
  assert.equal(tryAcquireTurnLock('u_test', 'c2'), null, '다른 채팅이어도 같은 사용자는 한 턴')
  releaseTurnLock({ ...a!, startedAt: 0 })
  assert.ok(currentTurnLock('u_test'), '남의 락 객체로는 풀리지 않는다')
  releaseTurnLock(a!)
  assert.equal(currentTurnLock('u_test'), null)
  const now = Date.now()
  assert.equal(isStalePending(new Date(now - STALE_PENDING_MS - 1), now, false), true)
  assert.equal(isStalePending(new Date(now - STALE_PENDING_MS - 1), now, true), false, '이 프로세스가 돌리는 턴은 오래돼도 건드리지 않는다')
  assert.equal(isStalePending(new Date(now - 60_000), now, false), false, '다른 인스턴스의 진행 중 턴(젊은 PENDING)은 건드리지 않는다')
})

const item = (message_id: string, original: string, corrected: string): ReviewItem => ({ message_id, original, corrected, explanation_ko: '설명', error_type: 'PARTICLE', severity: 'MINOR', chunk_type: null })
const resp = (items: ReviewItem[]): ChatReviewResponse => ({ items, summary_ko: '총평', strengths: [], focus: [] })

test('점검 D11: 위반 항목만 버리고(dropped) 정상 항목은 남긴다, original 은 서버 원문(메시지 전체 또는 문장 하나)', () => {
  const msgs = [
    { id: 'm1', text: '昨日は学校を行きました。友達と話しました。' },
    { id: 'm2', text: '今日は😀楽しかったです🎉' },
    { id: 'm3', text: 'パンを食べます' },
  ]
  const r = mergeReviewCandidates(msgs, [
    resp([
      item('m1', '昨日は学校を行きました。', '昨日は学校に行きました。'),
      item('m2', '今日は😀楽しかったです🎉', '今日は😀楽しかった🎉'),
      item('m1', '学校を行きました', '学校に行きました'), // 문장 안의 조각 — 인정 안 함
      item('mX', 'パンを食べます', 'パンを食べました'), // 점검 대상 아닌 id
      item('m3', 'パンを食べます', 'パンを食べます'), // no-op
    ]),
  ])
  assert.equal(r.dropped, 3)
  assert.deepEqual(r.items.map((d) => [d.messageId, d.original]), [
    ['m1', '昨日は学校を行きました。'],
    ['m2', '今日は😀楽しかったです🎉'],
  ])
  assert.equal(serverOriginal(msgs[0].text, '友達と話しました。'), '友達と話しました。')
  assert.equal(serverOriginal(msgs[0].text, ' 友達と話しました。'), null, '공백을 걷어 내고 비교하지 않는다')
})

test('점검 D11: 재시도가 정상 항목을 빠뜨려도 1차의 정상 항목을 살리고, 같은 (메시지·원문)은 재시도 값을 쓴다', () => {
  const msgs = [
    { id: 'm1', text: '駅で待ちます' },
    { id: 'm2', text: '本が読みたいです' },
  ]
  const first = resp([item('m1', '駅で待ちます', '駅で待っています'), item('m2', '本が読みたいでs', '本を読みたいです')])
  const second = resp([item('m2', '本が読みたいです', '本を読みたいです'), item('m1', '駅で待ちます', '駅で待ちましょう')])
  const r = mergeReviewCandidates(msgs, [first, second])
  assert.equal(r.dropped, 0, 'dropped 는 마지막 시도의 위반만 센다')
  assert.deepEqual(r.items.map((d) => [d.messageId, d.corrected]), [
    ['m1', '駅で待ちましょう'],
    ['m2', '本を読みたいです'],
  ], '메시지 순서, 같은 문장은 재시도 값')
  const r2 = mergeReviewCandidates(msgs, [first, resp([item('m2', '本が読みたいです', '本を読みたいです')])])
  assert.deepEqual(r2.items.map((d) => d.messageId), ['m1', 'm2'], '재시도가 빠뜨린 m1 은 1차에서 살린다')
  const dup = mergeReviewCandidates(msgs, [resp([item('m1', '駅で待ちます', 'A'), item('m1', '駅で待ちます', 'A')])])
  assert.equal(dup.items.length, 1, '완전히 같은 항목은 한 번만')
})

test('제안: payloadOverride 화이트리스트(ADD_WORD 는 meaning·reading), 30일 만료', () => {
  assert.deepEqual(parsePayloadOverride('ADD_WORD', { meaning: '영화(명사)' }), { meaning: '영화(명사)' })
  assert.deepEqual(parsePayloadOverride('ADD_WORD', undefined), {})
  assert.throws(() => parsePayloadOverride('ADD_WORD', { surface: 'x' }), code('VALIDATION'))
  assert.throws(() => parsePayloadOverride('ADD_STUDY_LOG', { summaryKo: 'x' }), code('VALIDATION'))
  assert.throws(() => parsePayloadOverride('ADD_WORD', { meaning: 3 }), code('VALIDATION'))
  const now = Date.now()
  assert.equal(isProposalExpired({ status: 'PROPOSED', expiresAt: new Date(now - 1), createdAt: new Date(now - 1000) }, now), true)
  assert.equal(isProposalExpired({ status: 'PROPOSED', expiresAt: null, createdAt: new Date(now - PROPOSAL_TTL_MS - 1) }, now), true)
  assert.equal(isProposalExpired({ status: 'ACCEPTED', expiresAt: new Date(now - 1), createdAt: new Date(0) }, now), false)
})

test('학습자 헤더 약점: 유형별 합계 top3', () => {
  const at = new Date().toISOString()
  assert.deepEqual(
    topWeaknesses([
      { type: 'PARTICLE', pattern: 'chunk:NAME', count: 2, lastAt: at },
      { type: 'CONJUGATION', pattern: 'general', count: 3, lastAt: at },
      { type: 'PARTICLE', pattern: 'general', count: 2, lastAt: at },
      { type: 'VOCABULARY', pattern: 'general', count: 1, lastAt: at },
      { type: 'OTHER', pattern: 'general', count: 1, lastAt: at },
    ]),
    ['PARTICLE(4)', 'CONJUGATION(3)', 'OTHER(1)'],
  )
})

test('원문 보존(규칙 3): 교정 갱신 데이터 타입에 original 이 없다(타입 검사) + 교정 UPDATE 는 corrections 모듈 한 곳뿐', () => {
  // @ts-expect-error — original 은 갱신 데이터에 넣을 수 없다(넣을 수 있게 바뀌면 typecheck 가 이 줄에서 실패한다)
  const bad: CorrectionUpdate = { original: 'x' }
  void bad
  const root = join(process.cwd(), 'src')
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (/\.tsx?$/.test(name) && /\.correction\.(update|updateMany|upsert)\(/.test(readFileSync(p, 'utf8'))) hits.push(p.slice(root.length + 1))
    }
  }
  walk(root)
  assert.deepEqual(hits, ['modules/conversation/corrections/index.ts'])
})
