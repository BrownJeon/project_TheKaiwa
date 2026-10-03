/**
 * task-024(IMP-0010) — 회화 응답 문장 수 상한(sceneCap) 신호 함수와 오케스트레이터 연결.
 * ① 신호표(인사·맞장구·물음·평서·altText·경계) ② 픽스처(pe-024 실측 범위)를 넘지 않는다 ③ TALK 만 상한을 받고 CHAT·예열은 받지 않는다
 * ④ 상한이 persona(--system-prompt)·세션 캐시 키에 섞이지 않는다 ⑤ toolLog 에 상한·신호 코드만 남고 발화 원문은 없다.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dates } from '@/modules/infra'
import type { LlmJsonRequest } from '@/modules/engine'
import { computeSceneCap, type SceneCapInput, type SceneCapReason } from '../orchestrator/sceneCap'
import { prewarmTalkTurn, startTurn, turnDeps } from '../orchestrator'
import { buildChatRequest } from '../prompts/chat'
import { buildTalkRequest, replyJaInstructionLine, TALK_SCENE_CAP_DEFAULT, TALK_SCENE_CAP_MAX, TALK_SCENE_CAP_MIN } from '../prompts/talk'
import type { TutorResponse } from '../structuredResponse/schemas'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── 신호표 ───────────────────────────────────────────────────────────

type Row = [label: string, input: SceneCapInput, cap: number, reason: SceneCapReason]
const TABLE: Row[] = [
  // 인사·감사·맞장구 → 2 (글자 수가 8을 넘는 정형구·か 로 끝나는 맞장구 포함)
  ['인사', { text: 'こんにちは。' }, 2, 'SHORT'],
  ['긴 감사(11자)', { text: 'ありがとうございました。' }, 2, 'SHORT'],
  ['감사+앞말', { text: 'はい、ありがとうございます' }, 2, 'SHORT'],
  ['정형 인사(9자)', { text: 'よろしくお願いします' }, 2, 'SHORT'],
  ['맞장구', { text: 'なるほど' }, 2, 'SHORT'],
  ['か 로 끝나는 맞장구', { text: 'そうですか？' }, 2, 'SHORT'],
  ['안부 인사', { text: 'お元気ですか？' }, 2, 'SHORT'],
  ['부탁(8자)', { text: 'はい、お願いします。' }, 2, 'SHORT'],
  // 짧은 평서(≤8자) → 2
  ['짧은 평서(6자)', { text: 'はい、好きです。' }, 2, 'SHORT'],
  ['짧은 평서(경계 8자)', { text: '今日は寒いですね' }, 2, 'SHORT'],
  // 평서 → 3
  ['평서(경계 9자)', { text: '私は日本が好きです。' }, 3, 'STATEMENT'],
  ['평서(주말)', { text: '週末、ちょっと出かけました。' }, 3, 'STATEMENT'],
  ['오류 있는 서술도 3', { text: '昨日友だちを会いました' }, 3, 'STATEMENT'],
  ['ですから 는 물음이 아니다', { text: 'これですから、ありがとう' }, 3, 'STATEMENT'],
  // 물음 → 4 (N5·N4 는 3)
  ['? 로 끝남(수준 없음)', { text: 'これはいくらですか？' }, 4, 'QUESTION'],
  ['? 로 끝남(N4)', { text: 'これはいくらですか？', level: 'N4' }, 3, 'QUESTION_LOW_LEVEL'],
  ['? 로 끝남(N5·소문자)', { text: '駅はどこですか？', level: 'n5' }, 3, 'QUESTION_LOW_LEVEL'],
  ['구두점 없는 STT 의 か', { text: '駅はどこですか', level: 'N3' }, 4, 'QUESTION'],
  ['의문사로 끝남', { text: '駅はどこ', level: 'N3' }, 4, 'QUESTION'],
  ['긴 문법 질문(N3)', { text: '「食べられる」と「食べれる」はどう違うんですか？', level: 'N3' }, 4, 'QUESTION'],
  ['半角 ?', { text: '駅はどこですか?' }, 4, 'QUESTION'],
  ['かな 종결', { text: '明日は雨が降るかな' }, 4, 'QUESTION'],
  ['설명 요청', { text: 'この言葉の使い方を教えてください' }, 4, 'QUESTION'],
  ['문장 중간의 물음', { text: '昨日映画を見ました。あなたは見ましたか' }, 4, 'QUESTION'],
  ['구두점 없이 이어진 물음', { text: 'これは何ですかありがとうございます' }, 4, 'QUESTION'],
  // STT 두 번째 후보가 있으면 2(물음이어도) — 공백뿐인 후보는 없는 것으로 본다
  ['altText 있음', { text: '駅はどこですか？', altText: '駅はどこですか' }, 2, 'ALT_CANDIDATE'],
  ['altText 공백뿐', { text: '駅はどこですか？', altText: '   ' }, 4, 'QUESTION'],
  ['altText null', { text: '週末、ちょっと出かけました。', altText: null }, 3, 'STATEMENT'],
  // 경계 — 신호 없음은 v3 와 같은 2
  ['빈 문자열', { text: '' }, 2, 'NO_SIGNAL'],
  ['공백뿐(전각 포함)', { text: ' 　\n ' }, 2, 'NO_SIGNAL'],
  ['이모지뿐', { text: '😀😀' }, 2, 'NO_SIGNAL'],
  ['기호뿐', { text: '？？？' }, 2, 'NO_SIGNAL'],
  ['구두점뿐', { text: '。。。…' }, 2, 'NO_SIGNAL'],
  ['이모지 + 인사', { text: 'こんにちは😀' }, 2, 'SHORT'],
  ['숫자뿐', { text: '12345' }, 2, 'SHORT'],
  ['영어 물음', { text: 'How do you say this in Japanese?' }, 4, 'QUESTION'],
]

for (const [label, input, cap, reason] of TABLE) {
  test(`sceneCap 신호: ${label} → ${cap} (${reason})`, () => {
    assert.deepEqual(computeSceneCap(input), { cap, reason })
  })
}

test('sceneCap: 입력이 무엇이든 상한은 허용 범위의 정수이고 altText 없이는 ALT 신호가 나오지 않는다', () => {
  const samples = ['', '。', 'a', 'あ'.repeat(1000), `${'あ'.repeat(999)}か`, '？'.repeat(500), '\u0000\u0001', 'ｱｲｳｴｵ', '「', '\uD83D', '1'.repeat(2000)]
  for (const text of samples) {
    for (const level of [undefined, null, '', 'N5', 'N1', 'X']) {
      const r = computeSceneCap({ text, level })
      assert.ok(Number.isInteger(r.cap) && r.cap >= TALK_SCENE_CAP_MIN && r.cap <= TALK_SCENE_CAP_MAX, `${JSON.stringify(text.slice(0, 8))}: ${r.cap}`)
      assert.notEqual(r.reason, 'ALT_CANDIDATE')
    }
  }
})

test('sceneCap: 문자열이 아닌 값이 와도 던지지 않는다(방어)', () => {
  assert.deepEqual(computeSceneCap({ text: undefined as unknown as string }), { cap: TALK_SCENE_CAP_DEFAULT, reason: 'NO_SIGNAL' })
  assert.deepEqual(computeSceneCap({ text: null as unknown as string }), { cap: TALK_SCENE_CAP_DEFAULT, reason: 'NO_SIGNAL' })
})

test('sceneCap: 긴 입력에서도 빠르다(정규식 역추적 없음)', () => {
  const t = Date.now()
  computeSceneCap({ text: 'ああ'.repeat(500) })
  computeSceneCap({ text: 'はい'.repeat(500) })
  computeSceneCap({ text: `${'ですま'.repeat(330)}か` })
  assert.ok(Date.now() - t < 200, `${Date.now() - t}ms`)
})

test('sceneCap 은 pe-024 실측 범위를 넘지 않는다: 픽스처 발화마다 결과 ≤ 픽스처 상한, 짧은 대꾸는 픽스처와 같다', () => {
  const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-length.json'), 'utf8')) as {
    items: { id: string; scene: string; level: string; sceneCap: number; input: string }[]
  }
  assert.ok(fixture.items.length >= 12)
  for (const it of fixture.items) {
    const r = computeSceneCap({ text: it.input, level: it.level })
    assert.ok(r.cap <= it.sceneCap, `${it.id}: 계산 ${r.cap} > 실측 ${it.sceneCap}`)
    if (it.scene === 'SHORT') assert.equal(r.cap, it.sceneCap, `${it.id}: 짧은 대꾸는 실측 상한과 같아야 한다`)
  }
})

// ── 오케스트레이터 연결 ───────────────────────────────────────────────

const FINAL = {
  speech: { style: 'CALM' },
  conversation: { replyJa: 'いいですね。映画は好きですか？', replyReading: 'x', replyKo: 'y' },
  correction: null,
  learning: { grammarPoint: null, difficulty: 'N5' },
  endOfTopic: false,
  proposals: [],
} as unknown as TutorResponse

interface Seen {
  req: LlmJsonRequest<TutorResponse>
  toolLog: Record<string, unknown> | null
}

/** 한 턴을 끝까지 돌려 LLM 요청과 저장된 toolLog 를 돌려준다(DB·LLM 은 turnDeps 로 대체). */
async function runTurn(kind: 'TALK' | 'CHAT', text: string, level: string): Promise<Seen> {
  const seen: Seen = { req: null as never, toolLog: null }
  mock.method(turnDeps, 'precheckChat', async () => ({ kind, level }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  // task-010c — 교정 방식·코치 판정 재료도 DB 대신(공유 DB 를 건드리지 않게)
  mock.method(turnDeps, 'loadCorrectionMode', async () => 'FLUENCY' as const)
  mock.method(turnDeps, 'loadCoachPending', async () => null)
  mock.method(turnDeps, 'acceptTurn', async () => ({
    chatId: 'c-scenecap',
    kind,
    level,
    userMessage: { id: 'um-scenecap', content: text, createdAt: new Date(), inputSource: 'TEXT' },
    assistantMessageId: 'am-scenecap',
    pendingSince: new Date(),
    traceId: 't_scenecap',
    resumed: false,
  }))
  mock.method(turnDeps, 'saveTurn', async (_u: string, _a: unknown, _s: unknown, toolLog: Record<string, unknown>) => {
    seen.toolLog = toolLog
    return { correction: null, proposals: [] }
  })
  mock.method(turnDeps, 'completeJson', async (req: LlmJsonRequest<TutorResponse>) => {
    seen.req = req
    return { data: FINAL, connectionKey: 'k', model: 'm', elapsedMs: 5, promptChars: 10, attempts: 1, warm: 'HIT', firstDeltaMs: 2, residualViolations: [], candidates: [FINAL] }
  })
  const handle = await startTurn({
    userId: `u-scenecap-${kind}-${Math.random().toString(36).slice(2, 8)}`,
    chatId: 'c-scenecap',
    request: { resume: false, text, inputSource: 'TEXT', utteranceId: null, clientTimings: null },
  })
  await handle.done
  await sleep(20)
  mock.restoreAll()
  return seen
}

const sentences = (n: number) => Array.from({ length: n }, (_, i) => `文${'ぁあぃいぅうぇえぉお'[i]}です。`).join('')
const withReply = (n: number): TutorResponse => ({ ...FINAL, conversation: { ...FINAL.conversation, replyJa: sentences(n) } }) as TutorResponse

test('TALK 턴: 신호로 정한 상한이 [지시] 줄·후검증에 들어가고 toolLog 에 상한·신호 코드만 남는다(발화 원문 없음)', async (t) => {
  t.after(() => mock.restoreAll())
  const text = '駅はどこですか？'
  const s = await runTurn('TALK', text, 'N5')
  assert.ok(s.req.system.includes(replyJaInstructionLine(3)), 'N5 물음 → 상한 3 이 지시 줄에')
  assert.ok(!s.req.system.includes(replyJaInstructionLine(2)))
  assert.equal(s.toolLog?.sceneCap, 3)
  assert.equal(s.toolLog?.sceneCapReason, 'QUESTION_LOW_LEVEL')
  assert.ok(!JSON.stringify(s.toolLog).includes('駅'), 'toolLog 에 발화 원문이 없다')
  // 후검증 허용치 = 상한 + 1: 4문장은 통과, 5문장은 위반
  assert.deepEqual(s.req.extraCheck?.(withReply(4)), [])
  assert.ok((s.req.extraCheck?.(withReply(5)) ?? []).length > 0)
})

test('TALK 턴: 짧은 인사는 2(v3 와 같은 상한, 허용 3문장)', async (t) => {
  t.after(() => mock.restoreAll())
  const s = await runTurn('TALK', 'こんにちは。', 'N5')
  assert.ok(s.req.system.includes(replyJaInstructionLine(2)))
  assert.equal(s.toolLog?.sceneCap, 2)
  assert.equal(s.toolLog?.sceneCapReason, 'SHORT')
  assert.deepEqual(s.req.extraCheck?.(withReply(3)), [])
  assert.ok((s.req.extraCheck?.(withReply(4)) ?? []).length > 0)
})

test('CHAT 턴: 상한을 받지 않는다 — A2 요청은 buildChatRequest 와 같고 toolLog 에 sceneCap 이 없다', async (t) => {
  t.after(() => mock.restoreAll())
  const text = '駅はどこですか？'
  const s = await runTurn('CHAT', text, 'N5')
  const expected = buildChatRequest({ todayKst: dates.todayKst(), learner: { level: 'N5' } as never, history: [], text })
  assert.equal(s.req.system, expected.system)
  assert.deepEqual(s.req.persona, expected.persona)
  assert.ok(!('sceneCap' in (s.toolLog ?? {})) && !('sceneCapReason' in (s.toolLog ?? {})))
})

test('persona(--system-prompt)는 상한과 무관하다: 턴마다 상한이 달라도 바이트 같고, 예열도 같은 persona·기본 상한 2', async (t) => {
  t.after(() => mock.restoreAll())
  // persona 에는 학습자 수준 행이 들어 있어 수준이 다르면 달라진다(설계) — 같은 수준(N3)에서 상한만 바꿔 비교한다.
  const a = await runTurn('TALK', 'こんにちは。', 'N3') // 2
  const b = await runTurn('TALK', '週末、ちょっと出かけました。', 'N3') // 3
  const c = await runTurn('TALK', '「食べられる」と「食べれる」はどう違うんですか？', 'N3') // 4
  assert.deepEqual([a, b, c].map((x) => x.toolLog?.sceneCap), [2, 3, 4])
  assert.deepEqual(a.req.persona, b.req.persona)
  assert.deepEqual(b.req.persona, c.req.persona)
  assert.ok(a.req.persona && JSON.stringify(a.req.persona).length > 100)

  let warmed: LlmJsonRequest<TutorResponse> | null = null
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N3' }))
  mock.method(turnDeps, 'prewarm', async (req: LlmJsonRequest<TutorResponse>) => {
    warmed = req
    return 'WARMED'
  })
  assert.equal(await prewarmTalkTurn('u-scenecap-prewarm', { kind: 'TALK', level: 'N3' }), 'WARMED')
  assert.ok(warmed !== null)
  const w = warmed as unknown as LlmJsonRequest<TutorResponse>
  assert.ok(w.system.includes(replyJaInstructionLine(TALK_SCENE_CAP_DEFAULT)), '예열은 기본 상한 2')
  assert.deepEqual(w.persona, a.req.persona, '예열 persona = 실제 턴 persona')
  assert.deepEqual(w.persona, buildTalkRequest({ todayKst: dates.todayKst(), learner: { level: 'N3' } as never, history: [], text: 'x', sceneCap: 4 }).persona)
  assert.equal(await prewarmTalkTurn('u-scenecap-prewarm', { kind: 'CHAT', level: 'N5' }), 'NOT_TALK')
})
