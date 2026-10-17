/**
 * task-073 W-3 — 뜻 채우기(`wordEnrich@v3`) valid=false 의 `invalidReason` 말투 규칙(단정·오타 지목 금지, 확실할 때만 질문형 후보 한 번).
 * 라이브 호출 0 · DB 0 — 실제 모델 응답 실측은 `tests/prompts/word-enrich-invalid-live.ts`(기록 `task-073-pe-record.md`).
 *
 * 세 겹으로 고정한다:
 *  (1) 규칙 줄이 시스템 프롬프트에 실려 있고 필요한 문구(금지 표현·질문형 한 번·추측 생략·언어 입력 안내)가 모두 있다.
 *  (2) **L4 불변** — 규칙 줄을 뺀 나머지 시스템 프롬프트·페르소나·스키마는 v2 와 바이트 단위로 같다(해시). valid 판정 기준·valid=true 경로(읽기·뜻·품사·조각·예문)·jlpt 규칙이
 *      한 글자라도 바뀌면 여기서 걸린다(그 경우는 이 task 범위 밖 변경이므로 의도한 것인지 먼저 확인한다).
 *  (3) 말투 점검기(`tests/prompts/wordEnrichInvalidCheck.ts`)가 실제 사례(v2 응답)를 잡고 완화된 문장은 통과시킨다 — 점검기가 빈 증명이 아님.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateOutput } from '../../engine/json/schemaValidate'
import { buildWordEnrichRequest, WORD_ENRICH_OUTPUT_SCHEMA, WORD_ENRICH_PROMPT_VERSION, type WordEnrichResponseV2 } from '../prompts/wordEnrich'
import { analyzeReason, ASSERTIVE_RULES, reasonProblems, sentenceCount } from '../../../../tests/prompts/wordEnrichInvalidCheck'

interface Fx {
  version: string
  level: string
  invalid: Array<{ id: string; surface: string; kind: string }>
  valid: Array<{ id: string; surface: string; expectedChunkType?: string }>
  borderline: Array<{ id: string; surface: string; expectedChunkType?: string }>
}
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/word-enrich-invalid.json'), 'utf8')) as Fx

const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const RULE_HEAD = '- invalidReason(valid=false 일 때만) 작성 규칙'
const system = buildWordEnrichRequest({ surface: '映画', level: 'N5' }).system
const ruleLine = system.split('\n').find((l) => l.startsWith(RULE_HEAD)) ?? ''

// ── (1) 픽스처 구조 ─────────────────────────────────────────────────────────────────────────────────────

test('픽스처: invalid 8종·valid 8종, id/표기 중복 없음, 의뢰서가 요구한 입력이 모두 있다', () => {
  assert.equal(fx.version, 'word-enrich-invalid@v1')
  assert.equal(fx.invalid.length, 8)
  assert.equal(fx.valid.length, 8)
  assert.equal(new Set([...fx.invalid, ...fx.valid].map((x) => x.id)).size, 16, 'id 중복')
  assert.equal(new Set([...fx.invalid, ...fx.valid].map((x) => x.surface)).size, 16, '표기 중복')
  assert.deepEqual(fx.invalid.map((x) => x.surface), ['インペクト', 'impact', '임팩트', 'inspect', 'こんにちわ', 'あああ', '나는 학교에 간다', 'asdf'])
  assert.deepEqual(fx.valid.map((x) => x.surface), ['映画', '温い', 'インパクト', '食べる', 'よろしくお願いします', 'ぬるい', 'コーヒー', 'ありがとう'])
  // 보조 집합: 구어·인사말처럼 valid=true 여야 하는 낱말 6종(과잉 거절 점검) — 위 16종과 겹치지 않는다.
  assert.equal(fx.borderline.length, 6)
  assert.equal(new Set([...fx.invalid, ...fx.valid, ...fx.borderline].map((x) => x.surface)).size, 22, '표기 중복')
})

// ── (2) 규칙 줄 ─────────────────────────────────────────────────────────────────────────────────────────

test('wordEnrich@v3: 버전 상수', () => {
  assert.equal(WORD_ENRICH_PROMPT_VERSION, 'wordEnrich@v3')
})

test('규칙 줄: 시스템 프롬프트에 정확히 1줄, 판정 기준 줄 바로 다음에 온다', () => {
  const lines = system.split('\n')
  assert.equal(lines.filter((l) => l.startsWith(RULE_HEAD)).length, 1)
  const judge = lines.findIndex((l) => l.startsWith('- 가장 먼저 이 표현이 실제 일본어 단어·관용 표현인지 판단합니다.'))
  assert.ok(judge >= 0, '판정 기준 줄')
  assert.ok(lines[judge + 1].startsWith(RULE_HEAD), '판정 기준 줄 바로 다음이 invalidReason 규칙')
})

test('규칙 줄: 단정 금지 표현·부드러운 대안·오타 추측 금지·질문형 한 번·확신 없으면 생략·언어 입력 안내가 모두 있다', () => {
  assert.ok(ruleLine.length > 0)
  for (const must of [
    '한국어 한 문장', // 형식 — 한 문장·한국어
    '~어요', // 부드러운 말투
    '「~가 아닙니다」', '「~의 오타입니다」', // 금지 단정 예
    '일본어 단어로 확인되지 않았어요', '~처럼 보여요', // 허용 완화 예
    '오타라고 짐작해 말하지 않습니다', // 다른 언어 오타 추측 금지(inspect 사례)
    '분명할 때만', '혹시 ○○를 말씀하신 걸까요?', '한 번만 묻고', // 후보는 단 하나로 분명할 때만·질문형 한 번
    '후보가 둘 이상 떠오르거나', '추측 없이 생략', // 후보가 갈리거나 확신 없으면 생략(インペクト → インパクト/インスペクト 사례)
    '원어 병기 없이', // 후보는 가나·한자 표기만(「英語の…をカタカナで表記した…」 풀어쓰기 금지)
    '같은 문장에서', // 한 문장 안에서 안내
    '영어 단어로 보여서', '한글로 적혀 있어서', '일본어 표현으로 적어 주시면', // 한국어·영어 입력 안내(알파벳/한글 구분)
  ]) assert.ok(ruleLine.includes(must), `규칙에 「${must}」가 있어야 한다`)
})

test('규칙 줄: 화면 틀(DRAFT_INVALID)을 되풀이하라는 말이 없고, 엔진·TTS 지시를 끌어오지 않으며, 후보 목록·별도 필드를 요구하지 않는다(L6)', () => {
  assert.ok(!ruleLine.includes('표현을 확인해 주세요'), '화면 틀 문구 반복 금지')
  assert.ok(!/speaker|pitch|model_id|styleWeight|connectionId|claude|haiku|qwen/i.test(ruleLine))
  assert.ok(!/목록|후보들|여러 개|candidates|suggest/i.test(ruleLine), '후보 목록 금지(문장 안 질문 한 번뿐)')
  assert.ok(ruleLine.includes('한 번만'))
})

test('L4 불변: 규칙 줄을 뺀 시스템 프롬프트·페르소나·출력 스키마는 v2 와 같다(판정 기준·valid=true 경로·jlpt·chunkType·예문 규칙 포함)', () => {
  const withoutRule = (level?: string) =>
    buildWordEnrichRequest({ surface: '映画', level }).system.split('\n').filter((l) => !l.startsWith(RULE_HEAD)).join('\n')
  // v2 기준값(2026-10-16 미러 실측 — git HEAD 746d54c 의 wordEnrich.ts 에서 계산)
  assert.equal(h(withoutRule('N5')), '0d3d5091c505a847', 'N5 수준 줄 포함 시스템 프롬프트(규칙 줄 제외)가 v2 와 달라졌다 — valid 판정·valid=true 경로 변경은 이 task 범위 밖')
  assert.equal(h(withoutRule(undefined)), '0fe926c55cafe597', '수준 없는 시스템 프롬프트(규칙 줄 제외)가 v2 와 달라졌다')
  const req = buildWordEnrichRequest({ surface: '映画', level: 'N5' })
  assert.equal(h(JSON.stringify(req.persona)), '6fdac9bacae8404f', '페르소나가 v2 와 달라졌다')
  assert.equal(h(JSON.stringify(WORD_ENRICH_OUTPUT_SCHEMA)), 'cb0ebf590148ca8d', '출력 스키마가 v2 와 달라졌다(JSON 스키마·응답 구조 불변)')
  // 읽기 쉬운 핵심 문장은 따로도 고정(해시가 깨졌을 때 무엇이 중요한지 알 수 있게).
  assert.ok(system.includes('한국어·영어·오타·의미 없는 문자열이면 valid=false 로 하고 invalidReason 에 한국어로 이유를 한 문장 적습니다.'))
  assert.ok(system.includes('valid=true 면 reading·meaning·partOfSpeech·chunkType·example·exampleKo 를 모두 채웁니다(null 금지).'))
  assert.ok(system.includes('jlpt 는 확신이 있을 때만 채우고, 모르면 지어내지 말고 null 로 둡니다.'))
})

test('규칙이 valid 입력에 닿지 않는다: 규칙 줄은 「valid=false 일 때만」이고 valid=true 줄은 그대로(둘이 다른 줄)', () => {
  const validLine = system.split('\n').find((l) => l.startsWith('- valid=true 면 reading')) ?? ''
  assert.ok(validLine && !validLine.includes('invalidReason 작성 규칙'))
  assert.ok(ruleLine.startsWith('- invalidReason(valid=false 일 때만)'))
})

test('invalidReason 스키마는 그대로 — 문자열 1~200자 또는 null, 완화된 후보 질문 문장도 한도 안', () => {
  const ok: WordEnrichResponseV2 = {
    valid: false, invalidReason: '일본어 단어로는 확인되지 않았는데, 혹시 インパクト를 말씀하신 걸까요?', reading: null, meaning: null,
    partOfSpeech: null, chunkType: null, jlpt: null, example: null, exampleKo: null,
  }
  assert.deepEqual(validateOutput(ok, WORD_ENRICH_OUTPUT_SCHEMA), { ok: true })
  assert.equal(validateOutput({ ...ok, invalidReason: 'あ'.repeat(201) }, WORD_ENRICH_OUTPUT_SCHEMA).ok, false)
  assert.equal(validateOutput({ ...ok, invalidReason: '' }, WORD_ENRICH_OUTPUT_SCHEMA).ok, false)
  const req = buildWordEnrichRequest({ surface: 'インペクト', level: 'N5' })
  assert.deepEqual(req.extraCheck?.(ok), [], '완화된 후보 질문 이유는 후검증을 통과한다')
})

// ── (3) 말투 점검기 ─────────────────────────────────────────────────────────────────────────────────────

test('점검기: 실제 사례(v2, 2026-10-15)는 단정으로 잡힌다 — 부정 단정·오타 지목·합쇼체 끝·두 문장·원어 짐작(inspect)', () => {
  const v2 = "일본어 단어가 아닙니다. 영어 단어 'inspect'의 오타로 보입니다."
  const r = analyzeReason('インペクト', v2)
  assert.deepEqual(r.assertive.sort(), ['formal-end', 'negation', 'typo'])
  assert.equal(r.sentences, 2)
  assert.deepEqual(r.latinGuess, ['inspect'])
  const p = reasonProblems('インペクト', v2)
  assert.ok(p.some((x) => x.startsWith('단정 표현')) && p.some((x) => x.includes('2문장')), p.join(' | '))
})

test('점검기: 완화된 문장은 통과 — 확인되지 않았어요 · 처럼 보여요 · 질문형 후보 한 번 · 언어 안내(한 문장)', () => {
  for (const [surface, reason] of [
    ['インペクト', '일본어 단어로는 확인되지 않았는데, 혹시 インパクト를 말씀하신 걸까요?'],
    ['インペクト', '일본어 단어로 확인되지 않았어요.'],
    ['impact', '영어 단어처럼 보여서, 일본어 표현으로 적어 주시면 확인할 수 있어요.'],
    ['임팩트', '한글 표기로 보여요, 일본어 표현으로 적어 주시면 확인할 수 있어요.'],
    ['あああ', '의미를 알 수 있는 일본어 단어로 확인되지 않았어요.'],
    ['asdf', '일본어 단어처럼 보이지 않아요.'],
  ] as const) {
    assert.deepEqual(reasonProblems(surface, reason), [], `${surface}: ${reason}`)
  }
  // 질문형 후보는 후보 질문 1회로 센다.
  assert.equal(analyzeReason('インペクト', '확인되지 않았는데, 혹시 インパクト를 말씀하신 걸까요?').candidateQuestions, 1)
})

test('점검기: 각 단정 규칙이 빈 증명이 아니다(규칙마다 그 규칙만 걸리는 문장을 잡는다) · 질문형은 합쇼체 끝으로 오탐하지 않는다', () => {
  const cases: Array<[string, string]> = [
    ['negation', '일본어 단어가 아니에요.'],
    ['negation', '일본어 단어가 아니네요.'],
    ['typo', '인식이 흔들려 오타처럼 보여요.'],
    ['wrong', '표기가 틀렸어요.'],
    ['wrong', '잘못된 표기로 보여요.'],
    ['nonexistent', '존재하지 않는 표현이에요.'],
    ['nonexistent', '일본어에 없는 단어예요.'],
    ['formal-end', '일본어 표현으로 확인되지 않았습니다.'],
  ]
  for (const [rule, text] of cases) assert.ok(analyzeReason('x', text).assertive.includes(rule), `${rule} ← ${text}`)
  assert.equal(ASSERTIVE_RULES.length, 5, '규칙 5종')
  assert.deepEqual(analyzeReason('x', '혹시 インパクト를 말씀하신 걸까요?').assertive, [])
  assert.deepEqual(analyzeReason('x', '일본어 단어처럼 보이지 않아요').assertive, [], '마침표가 없어도 해요체는 단정이 아니다')
})

test('점검기: 한국어 아님·빈 이유·문장 수·후보 질문 2회를 문제로 잡는다', () => {
  assert.ok(reasonProblems('x', '').some((m) => m.includes('비어')))
  assert.ok(reasonProblems('x', null).some((m) => m.includes('비어')))
  assert.ok(reasonProblems('x', 'Not a Japanese word.').some((m) => m.includes('한국어')))
  assert.ok(reasonProblems('x', '확인되지 않았어요. 일본어로 적어 주세요.').some((m) => m.includes('2문장')))
  assert.ok(reasonProblems('x', '혹시 A를 말씀하신 걸까요, 혹시 B를 말씀하신 걸까요?').some((m) => m.includes('후보 질문')))
  assert.equal(sentenceCount('한 문장이에요.'), 1)
  assert.equal(sentenceCount('하나예요. 둘이에요?'), 2)
  assert.equal(sentenceCount('쉼표, 가 있어도 한 문장이에요'), 1)
})
