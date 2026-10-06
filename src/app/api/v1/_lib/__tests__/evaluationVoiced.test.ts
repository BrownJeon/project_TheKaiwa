/**
 * task-012b-2 REV-132 M-2·L-2 — #66 `items[].voiced` 라우트 조합(`_lib/evaluationVoiced`) 판정과 실패 흡수(DB 없음).
 * 발화 대조(speech `voicedEvaluationItems` — 답 글이 붙은 녹음의 확정 글 또는 처음 들린 글과 같은가)는 가짜로 끼운다.
 * 그 대조 자체(사용자 범위·50개 상한·`answerCameFrom`)는 `src/modules/speech/__tests__/task012b2.test.ts` 가 본다.
 * 결과 화면 문구까지 한 번에 확인하려고 `answerSourceLabel` 로 끝을 맺는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { answerSourceLabel, RESULT } from '@/components/eval/evalCopy'
import type { EvalInputSource } from '@/types/evaluation'
// 화이트박스(테스트 전용) — learning index 가 공개하지 않는 채점 기준 집합과 맞춰 보려고 내부 파일을 상대 경로로 읽는다(eslint.config 의 테스트 관례).
import { SUBJECTIVE_ITEM_KINDS } from '../../../../../modules/learning/evaluation/scoring'
import { markVoiced, VOICE_ANSWER_KINDS, voicedLookupInputs, withVoiced, type VoicedItemInput, type VoicedLookup, type VoicedLookupInput } from '../evaluationVoiced'

const USER = 'cuser0000000000000000001'
const ALL_KINDS = ['MEANING_CHOICE', 'READING_INPUT', 'USAGE_CHOICE', 'CHUNK_CLASSIFY', 'LISTEN_RESPOND', 'ASSEMBLE', 'SITUATION_RESPOND', 'CORRECTION_SPOT'] as const
const VOICE_KINDS = ['LISTEN_RESPOND', 'SITUATION_RESPOND', 'CORRECTION_SPOT']

interface Item extends VoicedItemInput {
  inputSource: EvalInputSource | null
  score: number | null
}

const item = (over: Partial<Item> = {}): Item => ({ id: 'item1', kind: 'SITUATION_RESPOND', inputSource: 'TEXT', answerText: '駅はどこですか', score: 7, ...over })

/** speech 대조와 같은 규칙의 가짜 — 이 문항에 붙은 녹음의 확정 글(없으면 처음 들린 글만)과 답이 같으면 그 문항. 부른 값을 남긴다. */
function fakeLookup(linked: Record<string, { finalText: string | null; realtimeText: string }>) {
  const calls: { userId: string; items: VoicedLookupInput[] }[] = []
  const lookup: VoicedLookup = async (userId, items) => {
    calls.push({ userId, items })
    const out = new Set<string>()
    for (const it of items) {
      const u = linked[it.evaluationItemId]
      const a = it.answerText.trim()
      if (u && a && (a === (u.finalText ?? '').trim() || a === u.realtimeText.trim())) out.add(it.evaluationItemId)
    }
    return out
  }
  return { lookup, calls }
}

const silent = () => undefined

test('음성으로 답함: REALTIME_STT·SERVER_STT 답은 대조 없이 voiced=true — 결과 화면은 처음 들린 말·다시 들어 본 말로 채점', async () => {
  const { lookup, calls } = fakeLookup({})
  const out = await withVoiced(USER, [item({ id: 'rt', inputSource: 'REALTIME_STT' }), item({ id: 'sv', inputSource: 'SERVER_STT' })], lookup, silent)
  assert.deepEqual(
    out.map((it) => [it.id, (it as { voiced?: boolean }).voiced]),
    [
      ['rt', true],
      ['sv', true],
    ],
  )
  assert.equal(calls.length, 0, '음성 출처 답은 녹음과 대조하지 않는다')
  assert.equal(answerSourceLabel(out[0]), RESULT.byRealtimeStt)
  assert.equal(answerSourceLabel(out[1]), RESULT.byServerStt)
})

test('D-B7 음성 답을 직접 고쳐 채점: 녹음은 붙었고 답은 TEXT(고친 글) → 고친 글이 녹음의 확정 글과 같으면 voiced=true("내가 고친 말로 채점했어요")', async () => {
  // 처음 들린 글 「駅はどこですか」 → 학습자가 #21a USER 로 「駅はどこにありますか」 로 고침 → 채점이 그 글을 답으로 저장(inputSource TEXT).
  const { lookup, calls } = fakeLookup({ fixed: { finalText: '駅はどこにありますか', realtimeText: '駅はどこですか' } })
  const out = await withVoiced(USER, [item({ id: 'fixed', answerText: '駅はどこにありますか' })], lookup, silent)
  assert.equal((out[0] as { voiced?: boolean }).voiced, true)
  assert.equal(answerSourceLabel(out[0]), RESULT.byUserFix)
  assert.deepEqual(calls, [{ userId: USER, items: [{ evaluationItemId: 'fixed', answerText: '駅はどこにありますか' }] }], '세션 사용자 범위로 한 번만 묻는다')
})

test('글자로 답함: 붙은 녹음이 없거나 녹음 글과 다른 TEXT 답 → voiced=false("글자로 답함")', async () => {
  const { lookup } = fakeLookup({ other: { finalText: null, realtimeText: '別の話' } })
  const out = await withVoiced(USER, [item({ id: 'typed' }), item({ id: 'other', answerText: '手で書いた答え' })], lookup, silent)
  assert.deepEqual(
    out.map((it) => (it as { voiced?: boolean }).voiced),
    [false, false],
  )
  assert.equal(answerSourceLabel(out[0]), RESULT.byText)
})

test('대조 실패 흡수(L-2): #66 은 그대로 응답 — voiced 칸만 통째로 빠진 옛 응답 모양, 경고 1줄(오류 이름만)', async () => {
  const lines: string[] = []
  const boom: VoicedLookup = async () => {
    const e = new Error(`connect ECONNREFUSED ${USER} 駅はどこにありますか`)
    e.name = 'PrismaClientInitializationError'
    throw e
  }
  const input = [item({ id: 'rt', inputSource: 'REALTIME_STT' }), item({ id: 'fixed', answerText: '駅はどこにありますか' }), item({ id: 'mc', kind: 'MEANING_CHOICE', answerText: '2' })]
  const out = await withVoiced(USER, input, boom, (l) => lines.push(l))
  assert.deepEqual(out, input, '다른 칸은 바이트 그대로')
  assert.ok(
    out.every((it) => !('voiced' in it)),
    '음성 출처 답에도 voiced 를 싣지 않는다(일부만 싣으면 TEXT 답이 "글자로 답함"으로 단정된다)',
  )
  assert.equal(answerSourceLabel(out[1]), RESULT.byText, '옛 응답과 같은 문구')
  assert.equal(lines.length, 1)
  assert.match(lines[0], /PrismaClientInitializationError/)
  for (const secret of [USER, 'fixed', '駅', 'ECONNREFUSED']) assert.ok(!lines[0].includes(secret), `경고 줄에 ${secret} 없음`)
})

test('대조할 TEXT 답이 없으면 대조를 부르지 않는다 — 실패할 일도 없고 voiced 는 출처로만', async () => {
  let called = 0
  const lines: string[] = []
  const out = await withVoiced(
    USER,
    [item({ id: 'mc', kind: 'MEANING_CHOICE', answerText: '1' }), item({ id: 'none', inputSource: null, answerText: null }), item({ id: 'rt', inputSource: 'REALTIME_STT' })],
    async () => {
      called++
      throw new Error('x')
    },
    (l) => lines.push(l),
  )
  assert.equal(called, 0)
  assert.equal(lines.length, 0)
  assert.deepEqual(
    out.map((it) => (it as { voiced?: boolean }).voiced),
    [false, false, true],
  )
  assert.equal(answerSourceLabel(out[1]), null, '미답 문항은 출처 줄 없음')
})

test('말로 답할 수 있는 문항 집합: 듣고 답하기·상황 답하기·틀린 곳 찾기만 녹음과 대조한다 — 고르기·읽기 입력·조립은 대조 대상이 아니다', async () => {
  assert.deepEqual([...VOICE_ANSWER_KINDS].sort(), [...VOICE_KINDS].sort())
  const items = ALL_KINDS.map((kind) => item({ id: `k-${kind}`, kind, answerText: '駅はどこですか' }))
  assert.deepEqual(
    voicedLookupInputs(items).map((i) => i.evaluationItemId),
    ['k-LISTEN_RESPOND', 'k-SITUATION_RESPOND', 'k-CORRECTION_SPOT'],
  )
  // 대조가 "모두 녹음과 같다"고 해도 말로 답할 수 없는 문항은 묻지 않으니 false 로 남는다.
  const everything: VoicedLookup = async (_u, asked) => new Set(asked.map((a) => a.evaluationItemId))
  const out = await withVoiced(USER, items, everything, silent)
  for (const it of out) assert.equal((it as { voiced?: boolean }).voiced, VOICE_KINDS.includes(it.kind), it.kind)
})

test('REV-135 L-A: 대조 종류 집합 = learning 채점·음성 답 검증의 서술형 집합(SUBJECTIVE_ITEM_KINDS) — 한쪽만 바뀌면 실패', () => {
  assert.deepEqual([...VOICE_ANSWER_KINDS].sort(), [...SUBJECTIVE_ITEM_KINDS].sort())
  assert.equal(VOICE_ANSWER_KINDS.size, SUBJECTIVE_ITEM_KINDS.size, '중복 없이 같은 개수')
})

test('voicedLookupInputs: TEXT 답만, 빈 답·null 답·음성 출처·미답은 묻지 않는다', () => {
  assert.deepEqual(
    voicedLookupInputs([
      item({ id: 'a' }),
      item({ id: 'b', answerText: '' }),
      item({ id: 'c', answerText: null }),
      item({ id: 'd', inputSource: 'REALTIME_STT' }),
      item({ id: 'e', inputSource: 'SERVER_STT' }),
      item({ id: 'f', inputSource: null }),
    ]),
    [{ evaluationItemId: 'a', answerText: '駅はどこですか' }],
  )
})

test('markVoiced: 음성 출처 또는 대조 결과에 있는 문항만 true, 나머지 칸은 그대로', () => {
  const src = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c', inputSource: 'SERVER_STT' })]
  const out = markVoiced(src, new Set(['b']))
  assert.deepEqual(
    out.map((it) => it.voiced),
    [false, true, true],
  )
  assert.deepEqual(
    out.map((it) => {
      const rest: Partial<typeof it> = { ...it }
      delete rest.voiced
      return rest
    }),
    src,
  )
})

test('#66 라우트: voiced 판정은 이 조합 하나로 — speech 공개 API 를 주입하고 라우트에 판정식이 남지 않는다', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/v1/evaluations/[id]/route.ts'), 'utf8')
  assert.match(route, /import \{ voicedEvaluationItems \} from '@\/modules\/speech'/)
  assert.match(route, /import \{ withVoiced \} from '\.\.\/\.\.\/_lib\/evaluationVoiced'/)
  assert.match(route, /const items = await withVoiced\(s\.user\.id, dto\.items, voicedEvaluationItems\)/)
  assert.match(route, /ok\(\{ \.\.\.dto, items, result \}/)
  assert.doesNotMatch(route, /REALTIME_STT|SERVER_STT|LISTEN_RESPOND|SITUATION_RESPOND|CORRECTION_SPOT|\.has\(/, '라우트에 판정식이 다시 들어오지 않는다')
})
