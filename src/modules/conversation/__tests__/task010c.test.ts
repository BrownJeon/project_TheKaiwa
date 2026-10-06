/**
 * task-010c — 교정 방식(유창성·코치). ① 표시 시점(deliver) 판정 ② 코치 힌트 거르기 ③ 자기수정 판정(정규화 일치·포함 경계)
 * ④ 사용자 메시지 toolLog 메타 읽기·쓰기 ⑤ 입력 검증(#12 correctionMode·#32 coachRevealed) ⑥ 오케스트레이터 연결
 * (모드 → A1 `[교정]` 줄·저장 extras·done 이벤트, 역할극 = 코치, CHAT 불변) ⑦ 관측 훅 오류 정책 ⑧ 관측 행 만들기.
 * DB·LLM 은 쓰지 않는다(turnDeps 대체).
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import type { LlmJsonRequest } from '@/modules/engine'
import { observationRow, OBSERVATION_META_MAX } from '@/modules/learning'
import { parseProfilePatch } from '@/modules/preferences'
import { parseTurnBody } from '../chats/validate'
import {
  changedPieceOf,
  coachHintOf,
  correctionDeliver,
  isAwaitingSelfCheck,
  judgeSelfCorrection,
  normalizeForSelfCheck,
  readCorrectionMeta,
  resolveTalkCorrectionMode,
  talkCorrectionFields,
  writeCorrectionMeta,
} from '../corrections/talkDelivery'
import { recordSelfCorrectionSafely, startTurn, turnDeps, type TurnSaveExtras } from '../orchestrator'
import type { TurnEvent } from '../orchestrator/stream'
import type { CoachPending } from '../turnContext'
import type { TutorResponse } from '../structuredResponse/schemas'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const code = (c: string, field?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (!field || (e.details as { field?: string })?.field === field)

// ── ① 표시 시점 ─────────────────────────────────────────────────────

test('deliver: 유창성은 MAJOR 만 NOW·MINOR 는 LATER, 코치는 전부 NOW', () => {
  assert.equal(correctionDeliver('FLUENCY', 'MAJOR'), 'NOW')
  assert.equal(correctionDeliver('FLUENCY', 'MINOR'), 'LATER')
  assert.equal(correctionDeliver('COACH', 'MAJOR'), 'NOW')
  assert.equal(correctionDeliver('COACH', 'MINOR'), 'NOW')
})

test('모드 해석: 설정값(없으면 유창성), 역할극(scenarioId)은 설정과 무관하게 코치', () => {
  assert.equal(resolveTalkCorrectionMode(null, {}), 'FLUENCY')
  assert.equal(resolveTalkCorrectionMode('FLUENCY', { scenarioId: null }), 'FLUENCY')
  assert.equal(resolveTalkCorrectionMode('COACH', {}), 'COACH')
  assert.equal(resolveTalkCorrectionMode('FLUENCY', { scenarioId: 'sc_1' }), 'COACH')
})

// ── ② 코치 힌트 ────────────────────────────────────────────────────

test('코치 힌트: 유창성은 늘 null, 코치는 다듬어 싣고 정답 누출·빈 값·200자 초과는 null(카드는 바로 정답)', () => {
  const corrected = '週末に友だちと映画を見に行きました。'
  assert.equal(coachHintOf('FLUENCY', '힌트', corrected), null)
  assert.equal(coachHintOf('COACH', '  「行く」를 바꿔 보세요.  ', corrected), '「行く」를 바꿔 보세요.')
  assert.equal(coachHintOf('COACH', null, corrected), null)
  assert.equal(coachHintOf('COACH', '   ', corrected), null)
  assert.equal(coachHintOf('COACH', 'x'.repeat(201), corrected), null)
  assert.equal(coachHintOf('COACH', `정답은 ${corrected}`, corrected), null)
  // 문장부호·공백만 다르게 정답을 담아도 누출
  assert.equal(coachHintOf('COACH', '정답: 週末に 友だちと 映画を 見に 行きました', corrected), null)
})

// 결함 #3(QA 2차 s5 실 LLM 표본) — 교정문 전체가 아니라 바뀐 조각만 일본어로 흘린 힌트.
const S5_ORIG = '冷蔵庫の中にジュースがいます。'
const S5_FIXED = '冷蔵庫の中にジュースがあります。'
const S5_HINT = '「います」와 「あります」의 쓰임을 다시 봐요. 어떤 종류의 것에 어느 말을 써야 할까요?'

test('바뀐 조각: 정규화한 두 문자열의 공통 접두·접미를 떼고 남은 교정문 쪽 가운데(경계)', () => {
  assert.equal(changedPieceOf(S5_ORIG, S5_FIXED), 'あり', 'い→あり(뒤 ます 는 공통 접미)')
  assert.equal(changedPieceOf('机の上に本が。', '机の上に本があります。'), 'あります', '원문이 교정문의 접두')
  assert.equal(changedPieceOf('行きました。', '昨日行きました。'), '昨日', '원문이 교정문의 접미')
  assert.equal(changedPieceOf('ＡＢＣを買いました', 'ABCを買いました。'), '', '정규화하면 완전 동일')
  assert.equal(changedPieceOf('ねこ', 'いぬ'), 'いぬ', '완전 다름 = 교정문 전체')
  assert.equal(changedPieceOf('私はは学生です。', '私は学生です。'), '', '지우기만 한 교정은 교정문 쪽 조각이 비어 있다')
  assert.equal(changedPieceOf('ああ', 'あああ'), 'あ', '접두·접미가 겹쳐 세어지지 않는다')
  assert.equal(changedPieceOf('', 'こんにちは'), 'こんにちは')
  assert.equal(changedPieceOf('𠮷野家', '𠮟野家'), '𠮟', '서로게이트 쌍 한자를 반쪽으로 자르지 않는다')
})

test('코치 힌트(결함 #3): original 을 주면 바뀐 조각(2자↑)이 힌트에 그대로 있을 때도 null, 없거나 1자면 힌트 유지', () => {
  // ① 조각 노출 → null(카드는 바로 정답 — 데모 co-nohint)
  assert.equal(coachHintOf('COACH', S5_HINT, S5_FIXED, S5_ORIG), null)
  // ② 조각이 힌트에 없음 → 유지(학습자가 쓴 말 「います」를 짚는 것은 허용)
  assert.equal(coachHintOf('COACH', '「います」를 다시 봐요. 주스는 살아 있나요?', S5_FIXED, S5_ORIG), '「います」를 다시 봐요. 주스는 살아 있나요?')
  // ③ 조각 1자(조사) → 판정하지 않음(둘 중 고르기 힌트에 우연히 겹쳐도 살린다)
  assert.equal(coachHintOf('COACH', '「を」와 「に」 중 가는 곳에 붙는 조사는?', '学校に行きます。', '学校を行きます。'), '「を」와 「に」 중 가는 곳에 붙는 조사는?')
  // ④ original 미전달 → 기존 동작(교정문 전체만 본다)
  assert.equal(coachHintOf('COACH', S5_HINT, S5_FIXED), S5_HINT)
  // 유창성은 original 이 있어도 늘 null, 조각이 비면(같음·지우기) 조각 검사 없음
  assert.equal(coachHintOf('FLUENCY', '「ます」를 봐요', S5_FIXED, S5_ORIG), null)
  assert.equal(coachHintOf('COACH', 'ABC 앞뒤를 봐요', 'ABCを買いました。', 'ＡＢＣを買いました'), 'ABC 앞뒤를 봐요')
  assert.equal(coachHintOf('COACH', '「は」가 하나 많아요', '私は学生です。', '私はは学生です。'), '「は」가 하나 많아요')
})

test('코치 힌트(결함 #3): 공백·문장부호·전각/반각 차이에도 같은 판정', () => {
  // 교정문이 반각 가타카나여도 NFKC 로 맞추고, 힌트의 공백·괄호·전각 공백은 지운다(조각 = 飲み)
  assert.equal(coachHintOf('COACH', '『 飲　み 』를 써 보세요', 'ｼﾞｭｰｽを飲みます。', 'ジュースを食べます。'), null)
  assert.equal(coachHintOf('COACH', '「あ り ま す」의 쓰임을 봐요', S5_FIXED, '冷蔵庫の中に ジュースが　います!'), null)
  assert.equal(coachHintOf('COACH', '음료에 맞는 동사를 골라 보세요', 'ｼﾞｭｰｽを飲みます。', 'ジュースを食べます。'), '음료에 맞는 동사를 골라 보세요')
})

test('코치 힌트(결함 #3): 조각 길이 규칙의 직관 — いる→ある 는 조각 1자(あ)라 통과, います→あります 는 조각 2자(あり)라 거른다', () => {
  // 1자 규칙의 대가: 「ある」를 일본어로 말해도 조각이 「あ」 1자라 거르지 않는다(오탐 방지 쪽을 택함 — Leader 결정)
  assert.equal(changedPieceOf('ここにねこがいる。', 'ここにねこがある。'), 'あ')
  assert.equal(coachHintOf('COACH', '「いる」와 「ある」의 쓰임을 다시 봐요', 'ここにねこがある。', 'ここにねこがいる。'), '「いる」와 「ある」의 쓰임을 다시 봐요')
  // ます형이면 뒤의 ます 만 공통 접미라 조각이 「あり」 2자 → 「あります」를 말한 힌트는 거른다
  assert.equal(changedPieceOf('ここにねこがいます。', 'ここにねこがあります。'), 'あり')
  assert.equal(coachHintOf('COACH', S5_HINT, 'ここにねこがあります。', 'ここにねこがいます。'), null)
  // 조각이 통째로 「あります」인 경우(동사를 빠뜨린 문장)
  assert.equal(coachHintOf('COACH', S5_HINT, '机の上に本があります。', '机の上に本が。'), null)
})

// ── ③ 자기수정 판정 ─────────────────────────────────────────────────

const ORIG = '週末に友だちと映画を見に行くました。'
const FIXED = '週末に友だちと映画を見に行きました。'

test('자기수정: 교정문이 다음 말에 들어 있으면 SELF(정답을 열었으면 REPEAT) — 공백·문장부호·전각 차이는 무시', () => {
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: FIXED, revealed: false }), 'SELF')
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: FIXED, revealed: true }), 'REPEAT')
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: '週末に 友だちと 映画を見に行きました！', revealed: false }), 'SELF')
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: 'あ、週末に友だちと映画を見に行きました。楽しかったです。', revealed: false }), 'SELF', '앞뒤에 말이 더 붙어도 포함이면 고침')
  assert.equal(judgeSelfCorrection({ original: 'ＡＢＣを買いました', corrected: 'ABCを買いました。', text: 'ABCを買いました', revealed: false }), 'MISSED', '원문과 정규화가 같으면 판정 불가')
})

test('자기수정: 못 고침·다른 말·원문 반복은 MISSED', () => {
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: ORIG, revealed: false }), 'MISSED')
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: 'アクション映画を見ました。', revealed: false }), 'MISSED')
  assert.equal(judgeSelfCorrection({ original: ORIG, corrected: FIXED, text: '週末に友だちと映画を見に行きま', revealed: false }), 'MISSED', '교정문 일부만은 고침이 아니다')
})

test('자기수정 경계: 지우기 교정(원문이 교정문을 품음)에서 원문을 그대로 다시 말하면 MISSED, 넣기 교정(교정문이 원문을 품음)은 SELF', () => {
  const del = { original: 'すごいおいしいです。', corrected: 'おいしいです。' }
  assert.equal(judgeSelfCorrection({ ...del, text: 'すごいおいしいです', revealed: false }), 'MISSED')
  assert.equal(judgeSelfCorrection({ ...del, text: 'おいしいです', revealed: false }), 'SELF')
  const ins = { original: '学校行きます。', corrected: '学校に行きます。' }
  assert.equal(judgeSelfCorrection({ ...ins, text: '学校に行きます', revealed: false }), 'SELF')
  assert.equal(judgeSelfCorrection({ ...ins, text: '学校行きます', revealed: false }), 'MISSED')
  assert.equal(judgeSelfCorrection({ original: 'あ', corrected: 'え', text: 'え', revealed: false }), 'MISSED', '교정문 2자 미만은 판정하지 않는다')
})

test('정규화: NFKC·공백·문장부호·기호 제거, 장음(ー)은 남긴다', () => {
  assert.equal(normalizeForSelfCheck(' ラーメン、すごく おいしい！ '), 'ラーメンすごくおいしい')
  assert.equal(normalizeForSelfCheck('ＡＢＣ「本」・…'), 'ABC本')
})

// ── ④ 메타 읽기·쓰기 ───────────────────────────────────────────────

test('toolLog 메타: 쓰고 읽으면 같고, 다른 교정 id·모양이 어긋나면 null(옛 행 = NOW·힌트 없음)', () => {
  const meta = { id: 'cr_1', mode: 'COACH' as const, deliver: 'NOW' as const, hintKo: '힌트', selfCheck: null }
  const log = writeCorrectionMeta({ other: 1 }, meta)
  assert.equal(log.other, 1, '다른 키 보존')
  assert.deepEqual(readCorrectionMeta(log, 'cr_1'), meta)
  assert.equal(readCorrectionMeta(log, 'cr_2'), null)
  assert.equal(readCorrectionMeta(null), null)
  assert.equal(readCorrectionMeta({ correction: { id: 'cr_1', mode: 'X', deliver: 'NOW' } }), null)
  assert.equal(readCorrectionMeta({ correction: { id: 'cr_1', mode: 'FLUENCY', deliver: 'SOON' } }), null)
  assert.deepEqual(talkCorrectionFields(null), { deliver: 'NOW', hintKo: null, selfCheck: null })
  assert.ok(isAwaitingSelfCheck(meta))
  assert.ok(!isAwaitingSelfCheck({ ...meta, selfCheck: 'MISSED' }))
  assert.ok(!isAwaitingSelfCheck({ ...meta, hintKo: null }))
  assert.ok(!isAwaitingSelfCheck({ ...meta, mode: 'FLUENCY' }))
})

// ── ⑤ 입력 검증 ────────────────────────────────────────────────────

test('#12 correctionMode: FLUENCY|COACH 만, 그 밖은 400', () => {
  assert.deepEqual(parseProfilePatch({ correctionMode: 'COACH' }), { correctionMode: 'COACH' })
  assert.deepEqual(parseProfilePatch({ correctionMode: 'FLUENCY', strictness: 'STRICT' }), { correctionMode: 'FLUENCY', strictness: 'STRICT' })
  for (const bad of ['coach', 'STRICT', null, 1, ''])
    assert.throws(() => parseProfilePatch({ correctionMode: bad }), code('VALIDATION', 'correctionMode'), `correctionMode=${String(bad)}`)
})

test('#32 coachRevealed: 생략·null = false, true 만 true, 불리언이 아니면 400', () => {
  const t = (b: Record<string, unknown>) => parseTurnBody({ text: 'はい', ...b }) as { coachRevealed?: boolean }
  assert.equal(t({}).coachRevealed, false)
  assert.equal(t({ coachRevealed: null }).coachRevealed, false)
  assert.equal(t({ coachRevealed: true }).coachRevealed, true)
  assert.equal(t({ coachRevealed: false }).coachRevealed, false)
  assert.throws(() => t({ coachRevealed: 'true' }), code('VALIDATION', 'coachRevealed'))
})

// ── ⑥ 오케스트레이터 연결 ───────────────────────────────────────────

function reply(severity: 'MINOR' | 'MAJOR', hintKo: string | null, text = ORIG): TutorResponse {
  return {
    speech: { style: 'CALM' },
    conversation: { replyJa: 'いいですね！何の映画を見ましたか。', replyKo: 'y' },
    correction: { required: true, original: text, corrected: FIXED, explanationKo: '「行く」는 ました 앞에서 「行き」.', errorType: 'CONJUGATION', severity, chunkType: 'ACTION', hintKo },
    learning: { grammarPoint: null, difficulty: 'N5' },
    endOfTopic: false,
    proposals: [],
    userKo: '어제 영화를 보러 갔어요.',
  } as TutorResponse
}

interface Run {
  req: LlmJsonRequest<TutorResponse>
  extras: TurnSaveExtras | null
  toolLog: Record<string, unknown> | null
  events: TurnEvent[]
  modeCalls: number
  pendingCalls: number
}

async function runTurn(o: {
  kind?: 'TALK' | 'CHAT'
  profileMode: 'FLUENCY' | 'COACH'
  data: TutorResponse
  text?: string
  scenarioId?: string | null
  pending?: CoachPending | null
  coachRevealed?: boolean
}): Promise<Run> {
  const kind = o.kind ?? 'TALK'
  const text = o.text ?? ORIG
  const seen: Run = { req: null as never, extras: null, toolLog: null, events: [], modeCalls: 0, pendingCalls: 0 }
  mock.method(turnDeps, 'precheckChat', async () => ({ kind, level: 'N5', scenarioId: o.scenarioId ?? null }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N5' }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  mock.method(turnDeps, 'loadCorrectionMode', async () => {
    seen.modeCalls++
    return o.profileMode
  })
  mock.method(turnDeps, 'loadCoachPending', async () => {
    seen.pendingCalls++
    return o.pending ?? null
  })
  // task-010d A3b-1 — 역할극 대화는 상황 재료를 읽는다. 여기서는 재료 없음(상황이 사라짐 → [상황] 헤더 없이 코치 강제만 본다).
  mock.method(turnDeps, 'loadRolePlayMaterial', async () => null)
  mock.method(turnDeps, 'loadRolePlayLearnerTexts', async () => [])
  mock.method(turnDeps, 'acceptTurn', async () => ({
    chatId: 'c-010c',
    kind,
    level: 'N5',
    scenarioId: o.scenarioId ?? null,
    userMessage: { id: 'um-010c', content: text, createdAt: new Date(), inputSource: 'TEXT' },
    assistantMessageId: 'am-010c',
    pendingSince: new Date(),
    traceId: 't_010c',
    resumed: false,
  }))
  mock.method(turnDeps, 'saveTurn', async (_u: string, _a: unknown, shaped: { correction: { corrected: string } | null }, toolLog: Record<string, unknown>, extras: TurnSaveExtras | null) => {
    seen.extras = extras
    seen.toolLog = toolLog
    const m = extras?.correction
    return {
      correction: shaped.correction ? { id: 'cr-new', ...shaped.correction, status: 'PROPOSED', deliver: m?.deliver ?? 'NOW', hintKo: m?.hintKo ?? null, selfCheck: null } : null,
      proposals: [],
      selfCheck: extras?.selfCheck ? { correctionId: extras.selfCheck.pending.correction.id, result: extras.selfCheck.result } : null,
    }
  })
  mock.method(turnDeps, 'completeJson', async (req: LlmJsonRequest<TutorResponse>) => {
    seen.req = req
    return { data: o.data, connectionKey: 'k', model: 'm', elapsedMs: 5, promptChars: 10, attempts: 1, warm: 'HIT', firstDeltaMs: 2, residualViolations: [], candidates: [o.data] }
  })
  const handle = await startTurn({
    userId: `u-010c-${Math.random().toString(36).slice(2, 8)}`,
    chatId: 'c-010c',
    request: { resume: false, text, inputSource: 'TEXT', utteranceId: null, clientTimings: null, coachRevealed: o.coachRevealed === true },
  })
  await handle.subscribe((e) => seen.events.push(e))
  await handle.done
  await sleep(10)
  mock.restoreAll()
  return seen
}

const doneOf = (r: Run) => r.events.find((e) => e.event === 'done')?.data as Record<string, unknown> & { correction: Record<string, unknown> | null; selfCheck: unknown }

test('TALK 유창성: A1 에 [교정] 유창성, MINOR 는 LATER(힌트 없음)로 저장 extras·done·toolLog 에 실린다', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runTurn({ profileMode: 'FLUENCY', data: reply('MINOR', '힌트가 와도 버린다') })
  assert.ok(r.req.system.includes('[교정] 유창성'))
  assert.deepEqual(r.extras?.correction, { mode: 'FLUENCY', deliver: 'LATER', hintKo: null })
  assert.equal(r.toolLog?.correctionMode, 'FLUENCY')
  assert.equal(r.toolLog?.deliver, 'LATER')
  const d = doneOf(r)
  assert.equal(d.correction?.deliver, 'LATER')
  assert.equal(d.correction?.hintKo, null)
  assert.equal(d.correction?.status, 'PROPOSED', '교정 행 생성 규칙은 그대로(PROPOSED)')
  assert.equal(d.selfCheck, null)
})

test('TALK 유창성: MAJOR 는 NOW(그 자리 카드)', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runTurn({ profileMode: 'FLUENCY', data: reply('MAJOR', null) })
  assert.equal(r.extras?.correction?.deliver, 'NOW')
  assert.equal(doneOf(r).correction?.deliver, 'NOW')
})

test('TALK 코치: A1 에 [교정] 코치, MINOR 도 NOW 이고 힌트를 싣는다', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runTurn({ profileMode: 'COACH', data: reply('MINOR', '「行く」를 ました 앞에서 바꿔 보세요.') })
  assert.ok(r.req.system.includes('[교정] 코치'))
  assert.deepEqual(r.extras?.correction, { mode: 'COACH', deliver: 'NOW', hintKo: '「行く」를 ました 앞에서 바꿔 보세요.' })
  assert.equal(doneOf(r).correction?.hintKo, '「行く」를 ました 앞에서 바꿔 보세요.')
})

test('TALK 코치(결함 #3): 오케스트레이터가 원문을 넘겨 바뀐 조각을 흘린 힌트는 저장·done 모두 null', async (t) => {
  t.after(() => mock.restoreAll())
  const base = reply('MINOR', S5_HINT, S5_ORIG)
  const data: TutorResponse = { ...base, correction: { ...base.correction!, corrected: S5_FIXED, errorType: 'VOCABULARY' } }
  const r = await runTurn({ profileMode: 'COACH', text: S5_ORIG, data })
  assert.deepEqual(r.extras?.correction, { mode: 'COACH', deliver: 'NOW', hintKo: null })
  assert.equal(doneOf(r).correction?.hintKo, null)
  assert.equal(doneOf(r).correction?.status, 'PROPOSED', '교정 행은 그대로 — 힌트만 없앤다')
})

test('역할극 대화(scenarioId)는 설정이 유창성이어도 코치', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runTurn({ profileMode: 'FLUENCY', scenarioId: 'sc_1', data: reply('MINOR', '힌트') })
  assert.ok(r.req.system.includes('[교정] 코치'))
  assert.equal(r.extras?.correction?.deliver, 'NOW')
})

test('CHAT 은 불변: 교정 방식을 읽지 않고 판정 재료도 읽지 않으며 extras 없음', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runTurn({ kind: 'CHAT', profileMode: 'COACH', data: { ...reply('MINOR', null), correction: null } })
  assert.equal(r.modeCalls, 0)
  assert.equal(r.pendingCalls, 0)
  assert.equal(r.extras, null)
  assert.ok(!r.req.system.includes('[교정]'))
  assert.ok(!('correctionMode' in (r.toolLog ?? {})))
})

const pending: CoachPending = {
  userMessageId: 'um-prev',
  toolLog: { correction: { id: 'cr-prev', mode: 'COACH', deliver: 'NOW', hintKo: '힌트', selfCheck: null } },
  meta: { id: 'cr-prev', mode: 'COACH', deliver: 'NOW', hintKo: '힌트', selfCheck: null },
  correction: { id: 'cr-prev', original: ORIG, corrected: FIXED },
}

test('코치 자기수정: 직전 힌트 교정을 이번 말이 고쳤으면 SELF(정답 공개 보고면 REPEAT)가 저장 extras·done·toolLog 에, 관측 훅이 함께 넘어간다', async (t) => {
  t.after(() => mock.restoreAll())
  const ok = { ...reply('MINOR', null, FIXED), correction: null }
  const a = await runTurn({ profileMode: 'COACH', text: FIXED, data: ok, pending })
  assert.equal(a.extras?.selfCheck?.result, 'SELF')
  assert.equal(a.extras?.selfCheck?.revealed, false)
  assert.equal(a.toolLog?.selfCheck, 'SELF')
  assert.deepEqual(doneOf(a).selfCheck, { correctionId: 'cr-prev', result: 'SELF' })
  assert.equal(a.extras?.correction, null, '이번 말에는 교정이 없다')

  const b = await runTurn({ profileMode: 'COACH', text: FIXED, data: ok, pending, coachRevealed: true })
  assert.equal(b.extras?.selfCheck?.result, 'REPEAT')
  assert.equal(b.extras?.selfCheck?.revealed, true)

  const c = await runTurn({ profileMode: 'FLUENCY', text: 'アクション映画を見ました。', data: { ...ok, correction: null }, pending })
  assert.equal(c.extras?.selfCheck?.result, 'MISSED', '모드가 바뀌어도 직전 코치 힌트는 판정한다')
})

// ── ⑦ 관측 훅 오류 정책 ────────────────────────────────────────────

test('관측 훅: 문장 단위 오류는 삼키고(턴 저장 계속), 교착은 다시 던져 트랜잭션 전체 재시도', async (t) => {
  const warn = mock.method(console, 'warn', () => undefined)
  t.after(() => warn.mock.restore())
  const rec = { correctionId: 'cr', result: 'SELF' as const, revealed: false, inputSource: 'TEXT' as const }
  const tx = {} as never
  assert.equal(await recordSelfCorrectionSafely(tx, async () => undefined, rec), true)
  assert.equal(await recordSelfCorrectionSafely(tx, async () => { throw Object.assign(new Error('fk'), { code: 'P2003' }) }, rec), false)
  await assert.rejects(recordSelfCorrectionSafely(tx, async () => { throw Object.assign(new Error('deadlock'), { code: 'P2034' }) }, rec), (e: unknown) => (e as { code?: string }).code === 'P2034')
  await assert.rejects(
    recordSelfCorrectionSafely(tx, async () => { throw Object.assign(new Error('raw deadlock'), { code: 'P2010', meta: { code: '1213' } }) }, rec),
    (e: unknown) => (e as { code?: string }).code === 'P2010',
  )
})

// ── ⑧ 관측 행 ──────────────────────────────────────────────────────

test('관측 행: SELF_CORRECTION → CONVERSATION_MAINTAIN 축, 신뢰도 0~1 자름, meta 1KB 초과는 버림, CORRECTION_* 는 축을 직접 줘야 한다', () => {
  const r = observationRow('u1', { kind: 'SELF_CORRECTION', outcome: 'SUCCESS', refType: 'Correction', refId: 'cr_1', confidence: 3, meta: { revealed: false } })
  assert.equal(r.skill, 'CONVERSATION_MAINTAIN')
  assert.equal(r.confidence, 1)
  assert.deepEqual(r.meta, { revealed: false })
  const big = observationRow('u1', { kind: 'SELF_CORRECTION', outcome: 'PARTIAL', refType: 'Correction', refId: 'cr_1', meta: { note: 'x'.repeat(OBSERVATION_META_MAX) } })
  assert.equal('meta' in big, false)
  assert.throws(() => observationRow('u1', { kind: 'CORRECTION_ACCEPTED', outcome: 'SUCCESS', refType: 'Correction', refId: 'cr_1' }))
  assert.equal(observationRow('u1', { kind: 'CORRECTION_ACCEPTED', skill: 'GRAMMAR_PARTICLE', outcome: 'SUCCESS', refType: 'Correction', refId: 'cr_1' }).skill, 'GRAMMAR_PARTICLE')
})
