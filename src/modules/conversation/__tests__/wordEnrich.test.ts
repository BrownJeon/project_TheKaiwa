import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../engine/llm'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkWordEnrich } from '../structuredResponse/checks'
import { WORD_ENRICH_SCHEMA, type WordEnrichResponse } from '../structuredResponse/schemas'
import { buildWordEnrichRequest, WordEnrichInputError } from '../prompts/wordEnrich'

interface FixtureItem {
  id: string
  surface: string
  level: string | null
  valid: boolean
  expectedPartOfSpeech?: string
  expectedJlpt?: string | null
  expectedReading?: string
  meaningKeywords?: string[]
  note?: string
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/word-enrich.json'), 'utf8')) as { items: FixtureItem[] }

/** 픽스처의 valid 항목을 위한 스키마 통과용 합성 응답 — surface 를 표기 그대로 포함하는 예문이면 충분(자연스러움은 실측 몫). */
function syntheticValidResponse(it: FixtureItem): WordEnrichResponse {
  return {
    valid: true,
    invalidReason: null,
    reading: it.expectedReading ?? 'てすと',
    meaning: (it.meaningKeywords ?? ['뜻']).slice(0, 3).join(', '),
    partOfSpeech: (it.expectedPartOfSpeech as WordEnrichResponse['partOfSpeech']) ?? 'OTHER',
    jlpt: (it.expectedJlpt as WordEnrichResponse['jlpt']) ?? null,
    example: `${it.surface}のテスト文です。`,
    exampleKo: '테스트 문장입니다.',
  }
}

test('픽스처는 12건(유효 9·무효 3)', () => {
  assert.equal(fixture.items.length, 12)
  assert.equal(fixture.items.filter((x) => x.valid).length, 9)
  assert.equal(fixture.items.filter((x) => !x.valid).length, 3)
})

test('buildWordEnrichRequest: task·persona·jsonSchema·메시지 형태', () => {
  const req = buildWordEnrichRequest({ surface: '映画', level: 'N5' })
  assert.equal(req.task, 'wordEnrich')
  assert.equal(req.persona?.name, 'word-enrich')
  assert.equal(req.jsonSchema, WORD_ENRICH_SCHEMA)
  assert.equal(req.messages.length, 1)
  assert.equal(req.messages[0].role, 'user')
  assert.equal(req.messages[0].content, '[단어] 映画')
  assert.match(req.system, /\[모드\] WORD_ENRICH/)
  assert.match(req.system, /N5/, '학습자 수준이 시스템 프롬프트에 반영돼야 한다')
})

test('level 생략 시 수준 안내 줄이 없다', () => {
  const req = buildWordEnrichRequest({ surface: 'コーヒー' })
  assert.ok(!req.system.includes('학습자 수준은'))
})

test('surface 앞뒤 공백은 걷어 내고, 빈 문자열은 WordEnrichInputError', () => {
  const req = buildWordEnrichRequest({ surface: '  映画  ' })
  assert.equal(req.messages[0].content, '[단어] 映画')
  assert.throws(() => buildWordEnrichRequest({ surface: '   ' }), WordEnrichInputError)
})

test('프롬프트 총 길이 — A10 은 대화가 아니라 페르소나(tutor.md) 없이 짧게 유지된다(≤1,500자, TALK 3,000자보다 훨씬 작음)', () => {
  for (const it of fixture.items) {
    const req = buildWordEnrichRequest({ surface: it.surface, level: it.level })
    const prompt = renderTranscript(req.system, req.messages) + (req.persona?.prompt ?? '')
    assert.ok(prompt.length <= 1_500, `${it.id}: ${prompt.length}자`)
  }
})

test('WORD_ENRICH_SCHEMA: 유효 응답 통과, 스키마 밖 필드·필수 누락은 위반', () => {
  const ok: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', jlpt: 'N5',
    example: '昨日、映画を見ました。', exampleKo: '어제 영화를 봤어요.',
  }
  assert.deepEqual(validateOutput(ok, WORD_ENRICH_SCHEMA), { ok: true })
  assert.equal(validateOutput({ ...ok, extra: 1 }, WORD_ENRICH_SCHEMA).ok, false)
  const missingValid: Record<string, unknown> = { ...ok }
  delete missingValid.valid
  assert.equal(validateOutput(missingValid, WORD_ENRICH_SCHEMA).ok, false)
  const invalid: WordEnrichResponse = {
    valid: false, invalidReason: '한국어 문자열이라 일본어 단어로 볼 수 없어요', reading: null, meaning: null,
    partOfSpeech: null, jlpt: null, example: null, exampleKo: null,
  }
  assert.deepEqual(validateOutput(invalid, WORD_ENRICH_SCHEMA), { ok: true })
})

test('checkWordEnrich: 유효 판정에서 필수 필드 누락·형식 위반을 잡는다', () => {
  const ok: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', jlpt: 'N5',
    example: '昨日、映画を見ました。', exampleKo: '어제 영화를 봤어요.',
  }
  assert.deepEqual(checkWordEnrich('映画', ok), [])

  const noSurfaceInExample = { ...ok, example: '昨日、いい天気でした。' }
  assert.ok(checkWordEnrich('映画', noSurfaceInExample).some((v) => v.includes('example')))

  const katakanaReading = { ...ok, reading: 'エイガ' }
  assert.ok(checkWordEnrich('映画', katakanaReading).some((v) => v.includes('reading')))

  const kanjiReading = { ...ok, reading: '映画' }
  assert.ok(checkWordEnrich('映画', kanjiReading).some((v) => v.includes('reading')))

  const inconsistentInvalidReason = { ...ok, invalidReason: '이유' }
  assert.ok(checkWordEnrich('映画', inconsistentInvalidReason).some((v) => v.includes('invalidReason')))

  const missingMeaning = { ...ok, meaning: null }
  assert.ok(checkWordEnrich('映画', missingMeaning).some((v) => v.includes('meaning')))
})

test('checkWordEnrich: VERB·ADJ_I 는 활용형(어간만 유지)도 통과 — 2026-09-27 실측에서 かける(w08)가 재시도 후에도 계속 드롭돼 결정 변경', () => {
  const verb: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'かける', meaning: '걸다', partOfSpeech: 'VERB', jlpt: 'N3',
    example: 'いすにかけました。', exampleKo: '의자에 걸었습니다.', // 사전형 그대로가 아니라 활용형(かけました)
  }
  assert.deepEqual(checkWordEnrich('かける', verb), [], '어간(かけ)이 살아 있으면 VERB 는 활용형도 통과해야 한다')

  const adjI: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'いそがしい', meaning: '바쁘다', partOfSpeech: 'ADJ_I', jlpt: 'N4',
    example: '昨日は忙しかったです。', exampleKo: '어제는 바빴어요.', // 忙しい → 忙しかった
  }
  assert.deepEqual(checkWordEnrich('忙しい', adjI), [], '어간(忙し)이 살아 있으면 ADJ_I 도 활용형(かった)을 허용해야 한다')

  // 활용이 없는 품사(NOUN 등)는 여전히 리터럴 전체 일치만 인정 — 어간 근사를 쓰면 한자→가나 이탈(진짜 위반)을 놓친다.
  const nounStemOnly = { ...adjI, partOfSpeech: 'NOUN' as const, reading: 'えいが', example: '映画館に行きました。' }
  assert.ok(checkWordEnrich('忙しい', nounStemOnly).some((v) => v.includes('example')), 'NOUN 은 어간만으로는 통과하면 안 된다(활용 없는 품사는 리터럴 전체 일치)')

  // surface.length>=2 가드: 1글자 표기는 어간 근사를 시도하지 않는다 — 시도하면 slice(0,-1)이 빈 문자열이 되어
  // (빈 문자열은 어떤 example 에도 포함된 것으로 판정돼) 사실상 모든 example 을 통과시켜 버리는 구멍이 생긴다.
  const singleCharVerb = { ...verb, reading: 'ぬ', example: '猫が好きです。' } // '누구/무엇을 -하다' 류 가상 1글자 동사
  assert.ok(checkWordEnrich('ぬ', singleCharVerb).some((v) => v.includes('example')), '1글자 표기는 어간 근사(빈 문자열)를 적용하면 안 되므로 리터럴 전체 일치가 유지돼야 한다')
})

test('checkWordEnrich: valid=false 는 invalidReason 유무만 본다(다른 필드 null 여부는 강제하지 않는다)', () => {
  const invalid: WordEnrichResponse = {
    valid: false, invalidReason: '한국어 문자열이라 일본어 단어로 볼 수 없어요', reading: null, meaning: null,
    partOfSpeech: null, jlpt: null, example: null, exampleKo: null,
  }
  assert.deepEqual(checkWordEnrich('사과', invalid), [])
  const noReason = { ...invalid, invalidReason: null }
  assert.ok(checkWordEnrich('사과', noReason).some((v) => v.includes('invalidReason')))
})

test('픽스처의 유효 9건 — 합성 응답이 스키마·후검증을 모두 통과한다(reading 정규화·example 포함 규칙 회귀)', () => {
  for (const it of fixture.items.filter((x) => x.valid)) {
    const data = syntheticValidResponse(it)
    assert.deepEqual(validateOutput(data, WORD_ENRICH_SCHEMA), { ok: true }, `${it.id} 스키마 통과 실패`)
    assert.deepEqual(checkWordEnrich(it.surface, data), [], `${it.id} 후검증 실패`)
  }
})
