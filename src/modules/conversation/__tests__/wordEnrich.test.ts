import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../engine/llm'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkWordEnrich } from '../structuredResponse/checks'
import { CHUNK_TYPES, WORD_ENRICH_SCHEMA as WORD_ENRICH_BASE_SCHEMA } from '../structuredResponse/schemas'
import {
  buildWordEnrichRequest,
  checkWordEnrichV2,
  WORD_CHUNK_TYPES,
  WORD_ENRICH_OUTPUT_SCHEMA,
  WORD_ENRICH_PROMPT_VERSION,
  WordEnrichInputError,
  type WordEnrichResponseV2 as WordEnrichResponse,
} from '../prompts/wordEnrich'

interface FixtureItem {
  id: string
  surface: string
  level: string | null
  valid: boolean
  expectedPartOfSpeech?: string
  expectedChunkType?: string
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
    chunkType: (it.expectedChunkType as WordEnrichResponse['chunkType']) ?? 'NAME',
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
  assert.equal(req.jsonSchema, WORD_ENRICH_OUTPUT_SCHEMA)
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

test('프롬프트 총 길이 — A10 은 대화가 아니라 페르소나(tutor.md) 없이 짧게 유지된다(v1 1,423자 → v2 1,731자(+308) — 상한 ≤2,000자, TALK 3,000자보다 훨씬 작음)', () => {
  for (const it of fixture.items) {
    const req = buildWordEnrichRequest({ surface: it.surface, level: it.level })
    const prompt = renderTranscript(req.system, req.messages) + (req.persona?.prompt ?? '')
    assert.ok(prompt.length <= 2_000, `${it.id}: ${prompt.length}자`)
  }
})

test('WORD_ENRICH_OUTPUT_SCHEMA: 유효 응답 통과, 스키마 밖 필드·필수 누락은 위반', () => {
  const ok: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: 'N5',
    example: '昨日、映画を見ました。', exampleKo: '어제 영화를 봤어요.',
  }
  assert.deepEqual(validateOutput(ok, WORD_ENRICH_OUTPUT_SCHEMA), { ok: true })
  assert.equal(validateOutput({ ...ok, extra: 1 }, WORD_ENRICH_OUTPUT_SCHEMA).ok, false)
  const missingValid: Record<string, unknown> = { ...ok }
  delete missingValid.valid
  assert.equal(validateOutput(missingValid, WORD_ENRICH_OUTPUT_SCHEMA).ok, false)
  const invalid: WordEnrichResponse = {
    valid: false, invalidReason: '한국어 문자열이라 일본어 단어로 볼 수 없어요', reading: null, meaning: null,
    partOfSpeech: null, chunkType: null, jlpt: null, example: null, exampleKo: null,
  }
  assert.deepEqual(validateOutput(invalid, WORD_ENRICH_OUTPUT_SCHEMA), { ok: true })
})

test('wordEnrich@v2: 버전 상수·조각 5유형(앞 4개는 교정·수업·평가·주제와 같은 CHUNK_TYPES)', () => {
  assert.equal(WORD_ENRICH_PROMPT_VERSION, 'wordEnrich@v2')
  assert.deepEqual([...WORD_CHUNK_TYPES], ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'])
  assert.deepEqual([...WORD_CHUNK_TYPES].slice(0, 4), [...CHUNK_TYPES], '앞 4개는 CHUNK_TYPES 와 같은 순서·이름')
})

test('chunkType: 필수 키 — 5유형 각각 통과, 그 밖의 값·키 누락은 스키마 위반, 무효 입력은 null', () => {
  const ok: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: 'N5',
    example: '昨日、映画を見ました。', exampleKo: '어제 영화를 봤어요.',
  }
  for (const ct of WORD_CHUNK_TYPES) assert.deepEqual(validateOutput({ ...ok, chunkType: ct }, WORD_ENRICH_OUTPUT_SCHEMA), { ok: true }, ct)
  for (const bad of ['EXPRESSIONS', 'expression', 'NOUN', 'NONE', '', 'OTHER', 3, true]) {
    assert.equal(validateOutput({ ...ok, chunkType: bad }, WORD_ENRICH_OUTPUT_SCHEMA).ok, false, `허용 밖 값 ${String(bad)}`)
  }
  const noKey: Record<string, unknown> = { ...ok }
  delete noKey.chunkType
  assert.equal(validateOutput(noKey, WORD_ENRICH_OUTPUT_SCHEMA).ok, false, 'chunkType 키가 없으면 위반(필수 칸)')
  // v1 응답(chunkType 없음)은 v2 스키마를 통과하지 못한다 — 옛 모델 응답이 조용히 null 조각으로 저장되지 않게 하는 것이 아니라 재시도로 바로잡는다.
  assert.equal(validateOutput({ valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', jlpt: 'N5', example: '昨日、映画を見ました。', exampleKo: '어제 영화를 봤어요.' }, WORD_ENRICH_OUTPUT_SCHEMA).ok, false)
})

test('v2 스키마는 v1 칸을 그대로 물려받는다 — 달라진 것은 chunkType 필수 키 하나뿐(순서: partOfSpeech 다음)', () => {
  const { chunkType, ...v2Rest } = WORD_ENRICH_OUTPUT_SCHEMA.properties
  assert.deepEqual(v2Rest, WORD_ENRICH_BASE_SCHEMA.properties, 'chunkType 를 뺀 칸은 v1 과 같다')
  assert.deepEqual(chunkType, { anyOf: [{ type: 'null' }, { type: 'string', enum: [...WORD_CHUNK_TYPES] }] })
  assert.deepEqual(
    WORD_ENRICH_OUTPUT_SCHEMA.required.filter((k) => k !== 'chunkType'),
    [...WORD_ENRICH_BASE_SCHEMA.required],
  )
  assert.ok(WORD_ENRICH_OUTPUT_SCHEMA.required.includes('chunkType'))
  assert.equal(WORD_ENRICH_OUTPUT_SCHEMA.additionalProperties, false)
  assert.deepEqual(Object.keys(WORD_ENRICH_OUTPUT_SCHEMA.properties), ['valid', 'invalidReason', 'reading', 'meaning', 'partOfSpeech', 'chunkType', 'jlpt', 'example', 'exampleKo'])
})

test('checkWordEnrichV2: valid=true 인데 chunkType 이 null 이면 위반(재시도), valid=false 의 null 은 정상, v1 위반은 그대로 보고', () => {
  const ok: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'べんきょう', meaning: '공부', partOfSpeech: 'NOUN', chunkType: 'ACTION', jlpt: 'N5',
    example: '毎日、勉強します。', exampleKo: '매일 공부해요.',
  }
  assert.deepEqual(checkWordEnrichV2('勉強', ok), [])
  assert.ok(checkWordEnrichV2('勉強', { ...ok, chunkType: null }).some((m) => m.includes('chunkType')))
  // v1 위반(예문에 표기 없음)과 chunkType 위반이 함께 보고된다.
  const both = checkWordEnrichV2('勉強', { ...ok, chunkType: null, example: '毎日、べんきょうします。' })
  assert.ok(both.some((m) => m.includes('chunkType')) && both.some((m) => m.includes('example')), both.join(' | '))
  const invalid: WordEnrichResponse = {
    valid: false, invalidReason: '한국어 문자열이라 일본어 단어로 볼 수 없어요', reading: null, meaning: null,
    partOfSpeech: null, chunkType: null, jlpt: null, example: null, exampleKo: null,
  }
  assert.deepEqual(checkWordEnrichV2('사과', invalid), [])
  // 요청에 실린 extraCheck 도 같은 경로를 쓴다.
  const req = buildWordEnrichRequest({ surface: '勉強', level: 'N5' })
  assert.ok(req.extraCheck?.({ ...ok, chunkType: null }).some((m) => m.includes('chunkType')))
  assert.deepEqual(req.extraCheck?.(ok), [])
})

test('프롬프트: 5유형 이름·동작성 명사 예(勉強・準備・挨拶)·무효 입력 null 규칙이 실려 있고, 조각이 TTS·엔진 지시를 끌어오지 않는다', () => {
  const req = buildWordEnrichRequest({ surface: '映画', level: 'N5' })
  for (const ct of WORD_CHUNK_TYPES) assert.match(req.system, new RegExp(`\\b${ct}\\b`), `${ct} 가 지시문에 있다`)
  for (const label of ['이름', '액션', '느낌', '꾸밈', '표현']) assert.ok(req.system.includes(`(${label})`), `한국어 이름 ${label}`)
  for (const w of ['勉強', '準備', '挨拶']) assert.ok(req.system.includes(w), `동작성 명사 예 ${w}`)
  assert.match(req.system, /partOfSpeech·chunkType·jlpt·example·exampleKo 는 전부 null/, '무효 입력이면 chunkType 도 null')
  assert.match(req.system, /valid=true 면 reading·meaning·partOfSpeech·chunkType·example·exampleKo 를 모두 채웁니다/)
  assert.ok(!/speaker|pitch|model_id|styleWeight|connectionId/i.test(req.system))
})

test('checkWordEnrich: 유효 판정에서 필수 필드 누락·형식 위반을 잡는다', () => {
  const ok: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: 'N5',
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
    valid: true, invalidReason: null, reading: 'かける', meaning: '걸다', partOfSpeech: 'VERB', chunkType: 'ACTION', jlpt: 'N3',
    example: 'いすにかけました。', exampleKo: '의자에 걸었습니다.', // 사전형 그대로가 아니라 활용형(かけました)
  }
  assert.deepEqual(checkWordEnrich('かける', verb), [], '어간(かけ)이 살아 있으면 VERB 는 활용형도 통과해야 한다')

  const adjI: WordEnrichResponse = {
    valid: true, invalidReason: null, reading: 'いそがしい', meaning: '바쁘다', partOfSpeech: 'ADJ_I', chunkType: 'FEELING', jlpt: 'N4',
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
    partOfSpeech: null, chunkType: null, jlpt: null, example: null, exampleKo: null,
  }
  assert.deepEqual(checkWordEnrich('사과', invalid), [])
  const noReason = { ...invalid, invalidReason: null }
  assert.ok(checkWordEnrich('사과', noReason).some((v) => v.includes('invalidReason')))
})

test('픽스처의 유효 9건 — 합성 응답이 스키마·후검증을 모두 통과한다(reading 정규화·example 포함 규칙 회귀)', () => {
  for (const it of fixture.items.filter((x) => x.valid)) {
    const data = syntheticValidResponse(it)
    assert.deepEqual(validateOutput(data, WORD_ENRICH_OUTPUT_SCHEMA), { ok: true }, `${it.id} 스키마 통과 실패`)
    assert.deepEqual(checkWordEnrichV2(it.surface, data), [], `${it.id} 후검증 실패`)
    assert.ok(WORD_CHUNK_TYPES.includes(data.chunkType as (typeof WORD_CHUNK_TYPES)[number]), `${it.id} 조각 기대값(${it.expectedChunkType}) 이 5유형 안`)
  }
})
