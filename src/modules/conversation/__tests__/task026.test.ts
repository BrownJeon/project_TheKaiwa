/**
 * task-026(talk@v7·chat@v2) — 학습자 말 번역 `userKo` 응답 계약. 프롬프트 문자열·스키마·후검증·정리 함수만 본다(DB·LLM 없음 — 실 CLI 표본은
 * `tests/live/user-ko-measure.ts`). A5·A11 교훈: 지시문의 필드 나열·응답 골격에 정확한 이름 `userKo` 가 있어야 하고 스키마 required 와 맞아야 한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkChatResponse, checkTalkResponse, checkUserKoNaturalness, sanitizeUserKo, userKoStoreLimit, USER_KO_STORE_MAX } from '../structuredResponse/checks'
import { CHAT_SCHEMA, TALK_SCHEMA, USER_KO_PROMPT_MAX, type TutorResponse } from '../structuredResponse/schemas'
import { buildChatRequest, CHAT_PROMPT_VERSION } from '../prompts/chat'
import { buildTalkRequest, talkInstruction, TALK_PROMPT_VERSION, TALK_USER_PROMPT_CAP, USER_KO_INSTRUCTION_LINE } from '../prompts/talk'

interface Fixture {
  sanitize: { id: string; input: string; userKo: string | null; expect: string | null }[]
  naturalness: { bad: string[]; good: string[] }
  live: { id: string; level: string; input: string; history: { role: 'user' | 'assistant'; content: string }[]; expectKoAny: string[] }[]
}
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-userko.json'), 'utf8')) as Fixture
const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
const okResp = (over: Partial<TutorResponse> = {}): TutorResponse => ({
  speech: { style: 'NEUTRAL' },
  conversation: { replyJa: 'いいですね。何を見ましたか？', replyReading: 'いいですね。なにをみましたか？', replyKo: '좋네요. 무엇을 봤어요?' },
  correction: null,
  learning: { grammarPoint: null, difficulty: 'N5' },
  endOfTopic: false,
  proposals: [],
  userKo: '어제 영화를 봤어요.',
  ...over,
})

test('버전: talk@v7·chat@v2', () => {
  assert.equal(TALK_PROMPT_VERSION, 'talk@v7')
  assert.equal(CHAT_PROMPT_VERSION, 'chat@v2')
})

test('스키마(REV-086 M3): userKo 는 선택·맨 끝 선언·길이 무제한 — 누락·빈 값·null·초장문이어도 TALK·CHAT 응답이 스키마를 통과한다(턴 실패 없음)', () => {
  for (const s of [TALK_SCHEMA, CHAT_SCHEMA]) {
    assert.ok(!(s.required as readonly string[]).includes('userKo'), 'userKo 는 required 가 아니다')
    assert.ok('userKo' in s.properties, '지시 줄·골격과 짝인 properties 선언은 유지한다')
    const keys = Object.keys(s.properties)
    assert.equal(keys[keys.length - 1], 'userKo', '출력 순서 = 선언 순서(맨 끝)')
    const uk = s.properties.userKo as Record<string, unknown>
    assert.ok(!('minLength' in uk) && !('maxLength' in uk), '길이 규칙 없음')
    // 다른 필수 키는 그대로 required — 완화는 userKo 한 칸뿐이다
    for (const k of ['speech', 'conversation', 'correction', 'learning', 'endOfTopic', 'proposals']) assert.ok((s.required as readonly string[]).includes(k), k)
    const { userKo: _omit, ...missing } = okResp()
    void _omit
    assert.deepEqual(validateOutput(missing, s), { ok: true }, '누락')
    assert.deepEqual(validateOutput(okResp({ userKo: '' }), s), { ok: true }, '빈 값')
    assert.deepEqual(validateOutput(okResp({ userKo: '   ' }), s), { ok: true }, '공백뿐')
    assert.deepEqual(validateOutput(okResp({ userKo: null }), s), { ok: true }, 'null')
    assert.deepEqual(validateOutput(okResp({ userKo: '가'.repeat(5_000) }), s), { ok: true }, '초장문')
    assert.deepEqual(validateOutput(okResp({ userKo: '어제 영화를 봐 드려드렸어요.' }), s), { ok: true }, '이중 높임도 스키마는 통과(정리가 버림)')
  }
  assert.equal(validateOutput(okResp({ userKo: 123 as unknown as string }), TALK_SCHEMA).ok, false, '문자열·null 이 아닌 타입은 여전히 위반')
  assert.equal(validateOutput({ ...okResp(), conversation: { replyJa: '', replyReading: '', replyKo: '' } }, TALK_SCHEMA).ok, false, '본 응답 필드 검증은 그대로')
  assert.ok(USER_KO_PROMPT_MAX > 0)
})

test('TALK 지시문: userKo 가 순서 문구·필드 줄·응답 골격(맨 끝)에 정확한 이름으로 들어 있다', () => {
  const instr = talkInstruction('FLUENCY', 2, 'N5')
  assert.ok(instr.includes('endOfTopic → proposals → userKo'), '키 순서 문구')
  assert.ok(instr.includes(USER_KO_INSTRUCTION_LINE), '필드 지시 줄')
  const skeleton = instr.split('\n').find((l) => l.startsWith('[순서 예]'))!
  assert.ok(skeleton.endsWith('"proposals":[],"userKo":"<...>"}'), '골격 맨 끝에 userKo')
  assert.ok(skeleton.indexOf('"proposals"') < skeleton.indexOf('"userKo"'))
  for (const mode of ['FLUENCY', 'COACH'] as const) for (const cap of [1, 2, 3, 4]) assert.ok(talkInstruction(mode, cap, 'N3').includes('userKo(필수)'))
})

test('userKo 지시 줄: 번역 대상·문체 규칙(교정 없이 말한 그대로·이중 높임 금지·200자)', () => {
  assert.ok(USER_KO_INSTRUCTION_LINE.includes('[입력] 학습자 말'))
  assert.ok(USER_KO_INSTRUCTION_LINE.includes('교정하지 말고 말한 그대로'))
  assert.ok(USER_KO_INSTRUCTION_LINE.includes('이중 높임 금지'))
  assert.ok(USER_KO_INSTRUCTION_LINE.includes(`${USER_KO_PROMPT_MAX}자 이내`))
})

test('CHAT 지시문: 같은 userKo 줄이 들어 있다(필드 나열)', () => {
  const req = buildChatRequest({ todayKst: '2026-10-04', learner, history: [], text: 'こんにちは' })
  assert.ok(req.system.includes(USER_KO_INSTRUCTION_LINE))
  assert.equal(req.jsonSchema, CHAT_SCHEMA)
})

test('persona(--system-prompt)는 userKo 와 무관하다(바이트 불변 조건) · 엔진 파라미터 지시 없음', () => {
  const t = buildTalkRequest({ todayKst: '2026-10-04', learner, history: [], text: 'こんにちは' })
  assert.ok(!(t.persona?.prompt ?? '').includes('userKo'))
  for (const s of [t.system, buildChatRequest({ todayKst: '2026-10-04', learner, history: [], text: 'x' }).system]) {
    assert.ok(!/speaker_id|model_id|pitch/.test(s))
  }
})

test('예산: userKo 줄·골격이 들어간 뒤에도 TALK 사용자 프롬프트는 ≤3,000자(최악 조합은 task028·prompts 예산 회귀가 따로 본다)', () => {
  for (const it of fx.live) {
    const req = buildTalkRequest({ todayKst: '2026-10-04', learner: { ...learner, level: it.level }, history: it.history, text: it.input })
    const total = req.system.length + req.messages.reduce((n, m) => n + m.content.length, 0)
    assert.ok(total <= TALK_USER_PROMPT_CAP, `${it.id}: ${total}`)
  }
})

test('후검증(REV-086 M3): userKo 는 TALK·CHAT extraCheck 에 합성되지 않는다 — 이중 높임이어도 재시도 사유가 아니다(정리가 null 로 버림)', () => {
  const talk = buildTalkRequest({ todayKst: '2026-10-04', learner, history: [], text: '昨日映画を見ました' })
  const chat = buildChatRequest({ todayKst: '2026-10-04', learner, history: [], text: '昨日映画を見ました' })
  for (const bad of fx.naturalness.bad) {
    assert.deepEqual(talk.extraCheck!(okResp({ userKo: bad })), [], bad)
    assert.deepEqual(chat.extraCheck!(okResp({ userKo: bad })), [], bad)
    assert.equal(checkUserKoNaturalness(bad).length, 1, '검사 함수 자체는 이중 높임을 알아본다')
    assert.equal(sanitizeUserKo('昨日映画を見ました', bad), null, '정리가 버린다')
  }
  for (const good of fx.naturalness.good) {
    assert.deepEqual(talk.extraCheck!(okResp({ userKo: good })), [])
    assert.deepEqual(chat.extraCheck!(okResp({ userKo: good })), [])
    assert.equal(checkUserKoNaturalness(good).length, 0)
  }
  // replyKo 의 이중 높임은 여전히 재시도 대상(task-028)
  const badReply = okResp({ conversation: { ...okResp().conversation, replyKo: '가져다 드려드릴게요.' } })
  assert.ok(talk.extraCheck!(badReply).some((m) => m.includes('replyKo') && m.includes('이중 높임')))
  assert.deepEqual(checkTalkResponse('昨日映画を見ました', okResp()), [])
  assert.deepEqual(checkChatResponse('昨日映画を見ました', okResp()), [])
  assert.deepEqual(checkChatResponse('昨日映画を見ました', okResp({ userKo: '' })), [], '빈 userKo 는 CHAT 위반이 아니다')
  assert.deepEqual(checkUserKoNaturalness(undefined), [])
  assert.deepEqual(checkUserKoNaturalness(null), [])
})

test('sanitizeUserKo: 픽스처 13건(정상·공백·입력 베끼기·한글 없음·누락·혼합 입력·이중 높임·과길이)', () => {
  assert.equal(fx.sanitize.length, 13)
  for (const c of fx.sanitize) assert.equal(sanitizeUserKo(c.input, c.userKo), c.expect, `${c.id}`)
})

test('sanitizeUserKo(REV-086 M3): 어떤 값이 와도 던지지 않고 string|null — 누락·undefined·null·빈 값·비문자열·초장문 전부 null', () => {
  const input = 'こんにちは。'
  for (const bad of [undefined, null, '', '   ', '\n\t', 0, 123, true, {}, [], ['안녕']] as unknown[]) {
    assert.equal(sanitizeUserKo(input, bad), null, JSON.stringify(bad))
  }
  assert.equal(sanitizeUserKo(input, '가'.repeat(100_000)), null)
  assert.equal(sanitizeUserKo('', '안녕'), '안녕', '입력이 비어 있어도 던지지 않는다')
})

test('sanitizeUserKo(REV-086 M3): 1,000자 입력 경계 — 긴 입력의 정상 번역은 저장 상한 안에서 통과, 상한 초과(폭주)는 자르지 않고 null', () => {
  const long = '昨日映画を見ました。'.repeat(100) // 1,000자 = TURN_TEXT_MAX
  assert.equal(long.length, 1_000)
  assert.equal(userKoStoreLimit(long), 2_000)
  assert.equal(USER_KO_STORE_MAX, 2_000)
  const ok1000 = '어제 영화를 봤어요. '.repeat(100).trim() // ≈ 1,000자 — 지시문 권고(200자)를 훌쩍 넘지만 정상 번역
  assert.ok(ok1000.length > USER_KO_PROMPT_MAX * 4)
  assert.equal(sanitizeUserKo(long, ok1000), ok1000, '권고 상한을 넘는 긴 번역도 통과(자르지 않음)')
  assert.equal(sanitizeUserKo(long, '가'.repeat(2_000)), '가'.repeat(2_000), '경계 2,000 은 통과')
  assert.equal(sanitizeUserKo(long, '가'.repeat(2_001)), null, '2,001 은 폭주 → null(자르지 않음)')
  // 짧은 입력 한도: max(200, 입력×4)
  assert.equal(userKoStoreLimit('こんにちは'), 200)
  assert.equal(userKoStoreLimit('あ'.repeat(100)), 400)
  assert.equal(sanitizeUserKo('あ'.repeat(100), '가'.repeat(400)), '가'.repeat(400))
  assert.equal(sanitizeUserKo('あ'.repeat(100), '가'.repeat(401)), null)
})

test('TALK·CHAT 응답 전체(1,000자 입력 + 초장문 userKo 포함)가 스키마·extraCheck 를 통과하고 정리 결과만 null — 턴이 실패하지 않는다', () => {
  const long = '昨日映画を見ました。'.repeat(100)
  const talk = buildTalkRequest({ todayKst: '2026-10-04', learner, history: [], text: long })
  const chat = buildChatRequest({ todayKst: '2026-10-04', learner, history: [], text: long })
  for (const userKo of ['', null, undefined, '가'.repeat(5_000)]) {
    const resp = okResp({ userKo })
    if (userKo === undefined) delete (resp as Partial<TutorResponse>).userKo
    assert.deepEqual(validateOutput(resp, talk.jsonSchema), { ok: true })
    assert.deepEqual(validateOutput(resp, chat.jsonSchema), { ok: true })
    assert.equal(talk.extraCheck!(resp).filter((m) => m.startsWith('userKo')).length, 0)
    assert.equal(chat.extraCheck!(resp).filter((m) => m.startsWith('userKo')).length, 0)
    assert.equal(sanitizeUserKo(long, resp.userKo), null)
  }
})

test('live 픽스처: 12건, 각 항목에 핵심 키워드 후보가 있고 입력이 비어 있지 않다', () => {
  assert.equal(fx.live.length, 12)
  for (const it of fx.live) {
    assert.ok(it.input.length > 0 && it.expectKoAny.length >= 1, it.id)
  }
})
