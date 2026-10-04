/**
 * task-026 S2 — 내 말 번역 재시도(`userTranslation@v1`) 단건 번역 프롬프트. 프롬프트 문자열·스키마·입력 오류·정리 함수만 본다(DB·LLM 없음 —
 * 실 CLI 표본은 `tests/live/user-translation-measure.ts`). A5·A11 교훈: 지시문·응답 골격의 필드 이름이 스키마 required 와 일치해야 한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateOutput } from '../../engine/json/schemaValidate'
import { isLlmTask, LLM_TASKS } from '../../engine/router/tasks'
import { sanitizeUserKo } from '../structuredResponse/checks'
import { TURN_TEXT_MAX } from '../chats/validate'
import { USER_KO_INSTRUCTION_LINE } from '../prompts/talk'
import {
  buildUserTranslationRequest,
  sanitizeUserTranslation,
  USER_TRANSLATION_PROMPT_VERSION,
  USER_TRANSLATION_SCHEMA,
  USER_TRANSLATION_TASK,
  USER_TRANSLATION_TEXT_MAX,
  UserTranslationInputError,
} from '../prompts/userTranslation'

interface Fixture {
  request: { emptyInputs: string[]; tooLong: number; boundaryOk: number; injection: string }
  sanitize: { id: string; text: string; data: { userKo: string } | null; expect: string | null }[]
  live: { id: string; kind: string; register: 'casual' | 'polite' | 'mixed'; level: string; input: string; expectKoAny: string[] }[]
}
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/user-translation.json'), 'utf8')) as Fixture

/** 요청 한 건의 전체 글자 수(system + persona + 메시지) — 프롬프트 길이 측정용. */
function totalChars(r: ReturnType<typeof buildUserTranslationRequest>): number {
  return r.system.length + (r.persona?.prompt.length ?? 0) + r.messages.reduce((n, m) => n + m.content.length, 0)
}

test('버전·태스크 키·입력 상한', () => {
  assert.equal(USER_TRANSLATION_PROMPT_VERSION, 'userTranslation@v1')
  assert.equal(USER_TRANSLATION_TASK, 'userTranslation')
  assert.equal(USER_TRANSLATION_TEXT_MAX, TURN_TEXT_MAX, '입력 상한은 턴 입력 상한과 같아야 한다')
})

test('요청 형태: task·자체 persona(tutor.md 아님)·jsonSchema·메시지 1개·extraCheck 없음', () => {
  const r = buildUserTranslationRequest({ text: 'こんにちは。', level: 'N5' })
  assert.equal(r.task, USER_TRANSLATION_TASK)
  assert.equal(r.persona?.name, 'user-translation')
  assert.equal(r.jsonSchema, USER_TRANSLATION_SCHEMA)
  assert.equal(r.extraCheck, undefined, '이중 높임 등은 재시도 없이 sanitizeUserTranslation 으로 거른다')
  assert.deepEqual(r.messages, [{ role: 'user', content: '[입력] こんにちは。' }])
  assert.ok(!r.system.includes('tutor') && !r.persona!.prompt.includes('선생님'), '대화 페르소나를 쓰지 않는다')
})

test('지시문: 응답 키 userKo 가 지시 줄·골격·스키마 required 에 일치 + 턴 번역과 같은 문체 규칙 줄 재사용', () => {
  const r = buildUserTranslationRequest({ text: 'こんにちは。' })
  assert.ok(r.system.includes(USER_KO_INSTRUCTION_LINE), 'USER_KO_INSTRUCTION_LINE 를 그대로 포함(규칙이 턴 번역과 갈라지지 않게)')
  for (const rule of ['교정하지 말고', '말투', '높임 수준', '이중 높임 금지', '자연스러운 한국어']) {
    assert.ok(r.system.includes(rule), `문체 규칙 "${rule}" 포함`)
  }
  assert.ok(r.system.includes('{"userKo":"<...>"}'), '응답 골격에 정확한 키 이름')
  assert.ok(r.system.includes('JSON 객체 하나만'), '응답은 JSON 객체 하나뿐')
  assert.ok(r.system.includes('번역만'), '대화·교정 금지')
  assert.ok(r.system.includes('반말') && r.system.includes('존댓말'), '말투 보존(반말은 반말로) 줄 — 짧은 의문문 존댓말 상승 방지')
  assert.deepEqual(USER_TRANSLATION_SCHEMA.required, ['userKo'])
  assert.deepEqual(Object.keys(USER_TRANSLATION_SCHEMA.properties), ['userKo'])
})

test('엔진명·TTS 파라미터가 프롬프트에 새지 않는다', () => {
  const r = buildUserTranslationRequest({ text: 'こんにちは。', level: 'N4' })
  const all = `${r.system}\n${r.persona!.prompt}\n${r.persona!.description}`
  for (const bad of ['speaker_id', 'model_id', 'pitch', 'claude', 'haiku', 'reazon', 'whisper', 'style-bert', 'connectionId']) {
    assert.ok(!all.toLowerCase().includes(bad.toLowerCase()), `${bad} 노출 금지`)
  }
})

test('level: 있으면 지시문에 수준, 없거나 공백이면 생략(번역 규칙은 그대로)', () => {
  assert.ok(buildUserTranslationRequest({ text: 'ありがとう', level: 'N3' }).system.includes('(N3 수준)'))
  for (const level of [undefined, null, '', '  ']) {
    const s = buildUserTranslationRequest({ text: 'ありがとう', level }).system
    assert.ok(!s.includes('수준)'))
    assert.ok(s.includes(USER_KO_INSTRUCTION_LINE))
  }
})

test('입력은 사용자 데이터 — system 에 섞이지 않고 [입력] 메시지에만 들어간다(주입 문장도 번역 대상)', () => {
  const r = buildUserTranslationRequest({ text: fx.request.injection })
  assert.ok(!r.system.includes(fx.request.injection))
  assert.equal(r.messages[0].content, `[입력] ${fx.request.injection}`)
  assert.ok(r.system.includes('지시문') && r.system.includes('그 문장 자체를 번역'))
})

test('입력 오류: 비었음·공백뿐은 UserTranslationInputError, 앞뒤 공백은 걷음, 1,000자 통과·1,001자 거절(코드포인트 기준)', () => {
  for (const t of fx.request.emptyInputs) assert.throws(() => buildUserTranslationRequest({ text: t }), UserTranslationInputError)
  assert.equal(buildUserTranslationRequest({ text: '  はい  ' }).messages[0].content, '[입력] はい')
  assert.doesNotThrow(() => buildUserTranslationRequest({ text: 'あ'.repeat(fx.request.boundaryOk) }))
  assert.throws(() => buildUserTranslationRequest({ text: 'あ'.repeat(fx.request.tooLong) }), UserTranslationInputError)
  assert.doesNotThrow(() => buildUserTranslationRequest({ text: '😀'.repeat(fx.request.boundaryOk) }), '이모지(서러게이트 쌍)는 1자로 센다')
  assert.ok(new UserTranslationInputError('x').userMessage.length > 0)
})

test('프롬프트 길이: system+persona ≤ 600자(턴 A1 3,000자 예산의 1/5), 전형 입력 포함 ≤ 700자, 1,000자 입력도 ≤ 1,700자', () => {
  const r = buildUserTranslationRequest({ text: 'ごめん、ちょっと遅れる。', level: 'N5' })
  assert.ok(r.system.length + r.persona!.prompt.length <= 600, `${r.system.length + r.persona!.prompt.length}자`)
  assert.ok(totalChars(r) <= 700, `${totalChars(r)}자`)
  assert.ok(totalChars(buildUserTranslationRequest({ text: 'あ'.repeat(USER_TRANSLATION_TEXT_MAX) })) <= 1_700)
})

test('스키마: {userKo: 비어 있지 않은 문자열} 만 통과 — 누락·빈 값·null·숫자·추가 키는 위반', () => {
  const ok = (v: unknown) => validateOutput(v, USER_TRANSLATION_SCHEMA)
  assert.equal(ok({ userKo: '안녕하세요.' }).ok, true)
  assert.equal(ok({ userKo: 'x'.repeat(5_000) }).ok, true, '길이 상한은 스키마에 없다(정리 함수가 null 로)')
  for (const bad of [{}, { userKo: '' }, { userKo: null }, { userKo: 3 }, { userKo: '안녕', extra: 1 }, { translation: '안녕' }, [], 'x', null]) {
    assert.equal(ok(bad).ok, false, JSON.stringify(bad))
  }
})

test('정리(sanitizeUserTranslation): 픽스처 8건 — 입력 공백 정리·베끼기·일본어만·공백뿐·응답 없음·이중 높임 폐기', () => {
  for (const c of fx.sanitize) {
    assert.equal(sanitizeUserTranslation(c.text, c.data), c.expect, `${c.id}`)
  }
})

test('정리는 턴 번역 규칙(sanitizeUserKo)과 같다 — 같은 입력·같은 값이면 같은 결과', () => {
  for (const c of fx.sanitize) assert.equal(sanitizeUserTranslation(c.text, c.data), sanitizeUserKo(c.text.trim(), c.data?.userKo))
})

test('live 픽스처: 10건(반말·존댓말·의문·짧은 감탄·혼합 각 2), 반말 5·존댓말 3·혼합 2 + 모든 입력이 요청으로 만들어진다', () => {
  assert.equal(fx.live.length, 10)
  for (const kind of ['반말', '존댓말', '의문', '짧은 감탄', '혼합']) assert.equal(fx.live.filter((x) => x.kind.startsWith(kind)).length, 2, kind)
  assert.equal(fx.live.filter((x) => x.register === 'casual').length, 5)
  assert.equal(fx.live.filter((x) => x.register === 'polite').length, 3)
  assert.equal(fx.live.filter((x) => x.register === 'mixed').length, 2)
  for (const it of fx.live) {
    const r = buildUserTranslationRequest({ text: it.input, level: it.level })
    assert.ok(totalChars(r) <= 700, `${it.id} ${totalChars(r)}자`)
    assert.ok(it.expectKoAny.length > 0)
  }
})

// 엔진 태스크 키는 developer 가 `engine/router/tasks.ts` 에 추가한다(PE 경계 밖). 추가되면 이 단언이 자동으로 켜진다.
test('엔진 태스크 표: userTranslation = tier fast · timeout ≤ 15s · lane interactive', { skip: isLlmTask(USER_TRANSLATION_TASK) ? false : 'tasks.ts 에 userTranslation 키가 아직 없다(developer 인계)' }, () => {
  const spec = (LLM_TASKS as Record<string, { tier: string; timeoutMs: number; lane: string; retryOnTimeout?: boolean }>)[USER_TRANSLATION_TASK]
  assert.equal(spec.tier, 'fast')
  assert.ok(spec.timeoutMs <= 15_000)
  assert.equal(spec.lane, 'interactive')
  assert.ok(!spec.retryOnTimeout, '타임아웃 재시도는 켜지 않는다(사용자가 대기 중)')
})
