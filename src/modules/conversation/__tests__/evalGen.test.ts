import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../engine/llm'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkEvalGenResponse, computeEvalItemHash, EVAL_GEN_MATERIAL_RATIO_MIN, repairEvalGenChunkTypeSync, repairEvalGenWordLinks } from '../structuredResponse/evalChecks'
import { buildEvalGenSchema, EVAL_SENTENCE_READING_PATTERN, type EvalGenItem, type EvalGenResponse } from '../structuredResponse/evalSchemas'
import {
  buildEvalGenRequest,
  EVAL_GEN_MATERIALS_MAX,
  EVAL_GEN_PROMPT_VERSION,
  EVAL_GEN_USER_PROMPT_CAP,
  type EvalGenInput,
  type EvalGenWordCandidate,
} from '../prompts/evalGen'

interface Fixture {
  level: string
  topic: { title: string; titleJa: string }
  materials: EvalGenWordCandidate[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/evalGen.json'), 'utf8')) as Fixture

function cloneData<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** WORDS 10문항(4·2·2·2) — 재료 6/10(60%) 링크, 스키마·후검증 모두 통과하는 최소 합성 응답. */
function validWordsResponse(): EvalGenResponse {
  const items: EvalGenItem[] = [
    { kind: 'MEANING_CHOICE', dims: ['vocabulary'], wordSurface: '注文', chunkType: null, prompt: { surface: '注文', reading: 'ちゅうもん', choices: ['주문', '학교', '병원', '공원'] }, expected: { answer: 0 } },
    { kind: 'MEANING_CHOICE', dims: ['vocabulary'], wordSurface: '冷たい', chunkType: null, prompt: { surface: '冷たい', reading: 'つめたい', choices: ['차갑다', '뜨겁다', '달다', '짜다'] }, expected: { answer: 0 } },
    { kind: 'MEANING_CHOICE', dims: ['vocabulary'], wordSurface: '持ち帰り', chunkType: null, prompt: { surface: '持ち帰り', reading: 'もちかえり', choices: ['포장(테이크아웃)', '매장', '배달', '예약'] }, expected: { answer: 0 } },
    { kind: 'MEANING_CHOICE', dims: ['vocabulary'], wordSurface: '会計', chunkType: null, prompt: { surface: '会計', reading: 'かいけい', choices: ['계산', '주문', '자리', '메뉴'] }, expected: { answer: 0 } },
    { kind: 'READING_INPUT', dims: ['vocabulary'], wordSurface: '席', chunkType: null, prompt: { surface: '席' }, expected: { reading: 'せき', accepted: ['せき'] } },
    { kind: 'READING_INPUT', dims: ['vocabulary'], wordSurface: '待つ', chunkType: null, prompt: { surface: '待つ' }, expected: { reading: 'まつ', accepted: ['まつ'] } },
    { kind: 'USAGE_CHOICE', dims: ['grammar', 'vocabulary'], wordSurface: null, chunkType: null, prompt: { sentenceJa: 'すみません、少し___いただけますか。', choices: ['待って', '食べて', '走って', '泳いで'] }, expected: { answer: 0 } },
    { kind: 'USAGE_CHOICE', dims: ['grammar'], wordSurface: null, chunkType: null, prompt: { sentenceJa: 'お店が___ので、少し待ちました。', choices: ['混んでいた', '静かだった', '閉まっていた', '新しかった'] }, expected: { answer: 0 } },
    { kind: 'CHUNK_CLASSIFY', dims: ['grammar', 'assembly'], wordSurface: null, chunkType: 'ACTION', prompt: { textJa: '注文する', reading: 'ちゅうもんする' }, expected: { chunkType: 'ACTION' } },
    { kind: 'CHUNK_CLASSIFY', dims: ['vocabulary'], wordSurface: null, chunkType: 'FEELING', prompt: { textJa: '楽しい', reading: 'たのしい' }, expected: { chunkType: 'FEELING' } },
  ]
  return { items }
}

/** TALK 6문항(2·1·2·1) — 재료 4/6(66.7%) 링크. */
function validTalkResponse(): EvalGenResponse {
  const items: EvalGenItem[] = [
    {
      kind: 'LISTEN_RESPOND', dims: ['accuracy', 'naturalness'], wordSurface: '空いている', chunkType: null,
      prompt: { textJa: 'すみません、こちらの席は空いていますか。', instructionKo: '들은 질문에 자연스럽게 답해 보세요' },
      expected: { expectedGistKo: '자리가 비어 있는지 답한다', modelAnswerJa: 'はい、どうぞ。', modelReading: 'はい、どうぞ。' },
    },
    {
      kind: 'LISTEN_RESPOND', dims: ['vocabulary', 'naturalness'], wordSurface: '注文', chunkType: null,
      prompt: { textJa: 'ご注文はお決まりですか。', instructionKo: '주문할 메뉴가 정해졌는지 묻는 질문에 답해 보세요' },
      expected: { expectedGistKo: '무엇을 주문할지 답한다', modelAnswerJa: 'はい、コーヒーをお願いします。', modelReading: 'はい、こーひーをおねがいします。' },
    },
    {
      kind: 'ASSEMBLE', dims: ['assembly', 'grammar'], wordSurface: null, chunkType: null,
      prompt: { promptKo: '다음 조각을 순서대로 배열해 "저는 커피를 마시고 싶습니다"를 만드세요', pieces: ['飲みたいです。', 'コーヒーが', '私は'] },
      expected: { order: ['私は', 'コーヒーが', '飲みたいです。'] },
    },
    {
      kind: 'SITUATION_RESPOND', dims: ['vocabulary', 'naturalness'], wordSurface: '持ち帰り', chunkType: null,
      prompt: { situationKo: '점원이 포장인지 매장에서 먹을지 물어봤어요. 포장이라고 답해 보세요.' },
      expected: { expectedGistKo: '포장(테이크아웃)이라고 답한다', modelAnswerJa: '持ち帰りでお願いします。', modelReading: 'もちかえりでおねがいします。' },
    },
    {
      kind: 'SITUATION_RESPOND', dims: ['vocabulary', 'naturalness'], wordSurface: '待つ', chunkType: null,
      prompt: { situationKo: '가게 안이 붐벼서 줄을 서야 해요. 얼마나 기다려야 하는지 물어보세요.' },
      expected: { expectedGistKo: '얼마나 기다려야 하는지 묻는다', modelAnswerJa: 'どのくらい待ちますか。', modelReading: 'どのくらいまちますか。' },
    },
    {
      kind: 'CORRECTION_SPOT', dims: ['grammar'], wordSurface: null, chunkType: null,
      prompt: { sentenceJa: 'コーヒーを飲むたいです。' },
      expected: { wrongSpan: '飲むたい', correctedJa: 'コーヒーを飲みたいです。', explanationKo: '희망 표현 たい는 ます형(飲み)에 붙습니다, 사전형(飲む)에는 붙지 않습니다' },
    },
  ]
  return { items }
}

test('버전·상수', () => {
  assert.equal(EVAL_GEN_PROMPT_VERSION, 'evalGen@v3')
  assert.equal(EVAL_GEN_MATERIALS_MAX, 15)
})

test('buildEvalGenRequest: task·jsonSchema·messages 형태(WORDS)', () => {
  const input: EvalGenInput = { todayKst: '2026-09-28', kind: 'WORDS', level: 'N4' as EvalGenInput['level'], topic: null, materials: fixture.materials, recentHashes: [] }
  const req = buildEvalGenRequest(input)
  assert.equal(req.task, 'evalGen')
  assert.ok(req.persona)
  assert.equal(req.messages.length, 1)
  assert.equal(req.messages[0].role, 'user')
  assert.ok(req.system.includes('[모드] EVAL_GEN'))
  assert.ok(req.system.includes('MEANING_CHOICE 4개'))
  assert.deepEqual(req.jsonSchema, buildEvalGenSchema('WORDS'))
})

test('buildEvalGenRequest: 재료 15개 초과분은 자른다', () => {
  const many: EvalGenWordCandidate[] = Array.from({ length: 20 }, (_, i) => ({ surface: `単語${i}`, reading: null, meaning: `뜻${i}`, wrongCount: 0 }))
  const req = buildEvalGenRequest({ todayKst: '2026-09-28', kind: 'WORDS', level: 'N4' as EvalGenInput['level'], topic: null, materials: many, recentHashes: [] })
  // [재료] 목록에는 상한(15) 만큼만 표기가 실려야 한다.
  const listed = many.slice(0, EVAL_GEN_MATERIALS_MAX).every((m) => (req.messages[0].content as string).includes(m.surface))
  assert.ok(listed)
  assert.ok(!(req.messages[0].content as string).includes('単語19'))
})

test('예산: 재료 15개 + 주제 최악 조합도 ≤ EVAL_GEN_USER_PROMPT_CAP', () => {
  const worstMaterials: EvalGenWordCandidate[] = Array.from({ length: EVAL_GEN_MATERIALS_MAX }, (_, i) => ({
    surface: `非常に長い単語表記${i}`.slice(0, 40), reading: 'ひじょうにながいたんごひょうき'.slice(0, 40), meaning: '아주 길게 늘려 쓴 뜻 설명입니다 '.repeat(3).slice(0, 60), wrongCount: 5,
  }))
  const req = buildEvalGenRequest({
    todayKst: '2026-09-28', kind: 'TALK', level: 'N1' as EvalGenInput['level'],
    topic: { title: '아주 긴 주제 제목을 넣어 최악의 경우를 만듭니다 '.repeat(2), titleJa: '非常に長いトピックタイトルを入れて最悪のケースを作ります' },
    materials: worstMaterials, recentHashes: [],
  })
  const prompt = renderTranscript(req.system, req.messages)
  assert.ok(prompt.length <= EVAL_GEN_USER_PROMPT_CAP, `최악 조합 ${prompt.length}자 > ${EVAL_GEN_USER_PROMPT_CAP}`)
})

test('합성 WORDS 응답 — 스키마·후검증 모두 통과', () => {
  const data = validWordsResponse()
  assert.deepEqual(validateOutput(data, buildEvalGenSchema('WORDS')), { ok: true })
  assert.deepEqual(checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: fixture.materials.map((m) => m.surface), recentHashes: new Set() }, data), [])
})

test('합성 TALK 응답 — 스키마·후검증 모두 통과', () => {
  const data = validTalkResponse()
  assert.deepEqual(validateOutput(data, buildEvalGenSchema('TALK')), { ok: true })
  assert.deepEqual(checkEvalGenResponse({ kind: 'TALK', candidateSurfaces: fixture.materials.map((m) => m.surface), recentHashes: new Set() }, data), [])
})

test('evalGen@v3: LISTEN_RESPOND·SITUATION_RESPOND 의 modelReading 은 가타카나 외래어를 허용한다(스키마 통과)', () => {
  const data = cloneData(validTalkResponse())
  const listen = data.items[1] as Extract<EvalGenItem, { kind: 'LISTEN_RESPOND' }>
  listen.expected.modelAnswerJa = 'はい、コーヒーをお願いします。'
  listen.expected.modelReading = 'はい、コーヒーをおねがいします。' // 가타카나 외래어(コーヒー)를 그대로 유지
  assert.deepEqual(validateOutput(data, buildEvalGenSchema('TALK')), { ok: true }, 'modelReading 에 가타카나가 섞여도 스키마를 통과해야 한다(evalGen@v3)')

  const situation = data.items[3] as Extract<EvalGenItem, { kind: 'SITUATION_RESPOND' }>
  situation.expected.modelAnswerJa = 'サイズは大丈夫です。'
  situation.expected.modelReading = 'サイズはだいじょうぶです。'
  assert.deepEqual(validateOutput(data, buildEvalGenSchema('TALK')), { ok: true })
})

test('evalGen@v3: modelReading 도 한자·로마자·한글은 여전히 금지(EVAL_SENTENCE_READING_PATTERN 은 히라가나+가타카나까지만)', () => {
  const data = cloneData(validTalkResponse())
  const listen = data.items[1] as Extract<EvalGenItem, { kind: 'LISTEN_RESPOND' }>
  listen.expected.modelReading = '漢字が混ざっている' // 한자
  assert.equal(validateOutput(data, buildEvalGenSchema('TALK')).ok, false)
  assert.ok(new RegExp(EVAL_SENTENCE_READING_PATTERN).test('こーひーコーヒー〜…、。'))
  assert.ok(!new RegExp(EVAL_SENTENCE_READING_PATTERN).test('漢字'))
  assert.ok(!new RegExp(EVAL_SENTENCE_READING_PATTERN).test('watashi'))
  assert.ok(!new RegExp(EVAL_SENTENCE_READING_PATTERN).test('한글'))
})

test('REV-032 M2: LISTEN_RESPOND 의 modelReading 에 대화체 인용부호(「」『』)가 있어도 스키마를 통과한다(LESSON_READING_PATTERN 과 같은 근거)', () => {
  const data = cloneData(validTalkResponse())
  const listen = data.items[1] as Extract<EvalGenItem, { kind: 'LISTEN_RESPOND' }>
  listen.expected.modelAnswerJa = '店員が「こちらへどうぞ」と言いました。'
  listen.expected.modelReading = 'てんいんが「こちらへどうぞ」といいました。'
  assert.deepEqual(validateOutput(data, buildEvalGenSchema('TALK')), { ok: true }, 'modelReading 의 「」 는 거부되면 안 된다')
  assert.ok(new RegExp(EVAL_SENTENCE_READING_PATTERN).test('『コーヒー』と「おちゃ」'))
})

test('READING_INPUT 의 reading/accepted 는 여전히 히라가나만(가타카나 금지, evalGen@v3 에서도 유지)', () => {
  const data = cloneData(validWordsResponse())
  const readingItem = data.items[4] as Extract<EvalGenItem, { kind: 'READING_INPUT' }>
  readingItem.expected.reading = 'サイズ' // 가타카나 그대로 — 위반이어야 한다
  readingItem.expected.accepted = ['サイズ']
  assert.equal(validateOutput(data, buildEvalGenSchema('WORDS')).ok, false, 'READING_INPUT 은 히라가나만 허용해야 한다(단어 읽기 능력 평가 목적)')
})

test('checkEvalGenResponse: 개수·분배 위반', () => {
  const data = cloneData(validWordsResponse())
  data.items.pop() // 9개로 — 총 개수 위반 + MEANING_CHOICE 아니라 CHUNK_CLASSIFY 1개 부족
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('정확히 10개')))
  assert.ok(v.some((x) => x.includes("kind='CHUNK_CLASSIFY'")))
})

test('checkEvalGenResponse: READING_INPUT accepted 에 reading 자신이 없으면 위반', () => {
  const data = cloneData(validWordsResponse())
  const item = data.items[4] as Extract<EvalGenItem, { kind: 'READING_INPUT' }>
  item.expected.accepted = ['다른표기']
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('expected.accepted')))
})

test('checkEvalGenResponse: USAGE_CHOICE 빈칸 표시(___) 없으면 위반', () => {
  const data = cloneData(validWordsResponse())
  const item = data.items[6] as Extract<EvalGenItem, { kind: 'USAGE_CHOICE' }>
  item.prompt.sentenceJa = '빈칸이 없는 문장입니다.'
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('___')))
})

test('checkEvalGenResponse: ASSEMBLE pieces/order 다중집합 불일치 위반', () => {
  const data = cloneData(validTalkResponse())
  const item = data.items[2] as Extract<EvalGenItem, { kind: 'ASSEMBLE' }>
  item.expected.order = ['私は', 'コーヒーが', '飲みます。'] // pieces 에 없는 값으로 바꿈
  const v = checkEvalGenResponse({ kind: 'TALK', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('expected.order')))
})

test('checkEvalGenResponse: CORRECTION_SPOT wrongSpan 이 sentenceJa 부분 문자열 아니면 위반, correctedJa 가 원문과 같으면 위반', () => {
  const data = cloneData(validTalkResponse())
  const item = data.items[5] as Extract<EvalGenItem, { kind: 'CORRECTION_SPOT' }>
  item.expected.wrongSpan = '없는부분'
  item.expected.correctedJa = item.prompt.sentenceJa
  const v = checkEvalGenResponse({ kind: 'TALK', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('wrongSpan')))
  assert.ok(v.some((x) => x.includes('correctedJa')))
})

test('checkEvalGenResponse: 재료 사용 비율 60% 미만이면 위반', () => {
  const data = cloneData(validWordsResponse())
  for (const it of data.items) it.wordSurface = null
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: fixture.materials.map((m) => m.surface), recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('60%')))
})

test('checkEvalGenResponse: 14일 해시 중복(과거 출제) 위반', () => {
  const data = cloneData(validWordsResponse())
  const hash = computeEvalItemHash(data.items[0])
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set([hash]) }, data)
  assert.ok(v.some((x) => x.includes('최근 14일')))
})

test('checkEvalGenResponse: 이번 응답 안에서 두 문항이 같은 핵심이면 위반', () => {
  const data = cloneData(validWordsResponse())
  const a = data.items[0] as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>
  const b = data.items[1] as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>
  b.wordSurface = a.wordSurface
  b.prompt.surface = a.prompt.surface
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('이번 응답')))
})

test('checkEvalGenResponse: 엔진 식별 정보 누출 위반', () => {
  const data = cloneData(validWordsResponse())
  const item = data.items[0] as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>
  item.expected = { answer: 0 }
  item.prompt.choices[1] = 'Claude 가 만든 뜻'
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('엔진')))
})

test('checkEvalGenResponse: WORDS 에 TALK 전용 kind 가 섞이면 위반', () => {
  const data = cloneData(validWordsResponse())
  data.items[0] = { ...validTalkResponse().items[0] }
  const v = checkEvalGenResponse({ kind: 'WORDS', candidateSurfaces: [], recentHashes: new Set() }, data)
  assert.ok(v.some((x) => x.includes('쓸 수 없는 종류')))
})

test('repairEvalGenWordLinks: MEANING_CHOICE·READING_INPUT·CHUNK_CLASSIFY 는 표기가 재료와 같으면 wordSurface 를 채운다', () => {
  const data = cloneData(validWordsResponse())
  for (const it of data.items) it.wordSurface = null
  const candidateSurfaces = fixture.materials.map((m) => m.surface)
  const result = repairEvalGenWordLinks({ candidateSurfaces }, data)
  assert.equal(result.linked, 6) // MEANING_CHOICE 4 + READING_INPUT 2(표기가 재료와 일치) — CHUNK_CLASSIFY 2개는 재료에 없는 단어라 링크되지 않는다
  assert.equal((data.items[0] as EvalGenItem).wordSurface, '注文')
  assert.equal((data.items[4] as EvalGenItem).wordSurface, '席')
})

test('repairEvalGenWordLinks: USAGE_CHOICE·서술형(TALK)은 손대지 않는다', () => {
  const data = cloneData(validTalkResponse())
  for (const it of data.items) it.wordSurface = null
  const result = repairEvalGenWordLinks({ candidateSurfaces: fixture.materials.map((m) => m.surface) }, data)
  assert.equal(result.linked, 0)
  assert.ok(data.items.every((it) => it.wordSurface === null))
})

test('repairEvalGenWordLinks: 이미 채워진 wordSurface 는 덮어쓰지 않는다', () => {
  const data = cloneData(validWordsResponse())
  const item = data.items[0] as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>
  item.wordSurface = '이미채워짐'
  const result = repairEvalGenWordLinks({ candidateSurfaces: fixture.materials.map((m) => m.surface) }, data)
  assert.equal(item.wordSurface, '이미채워짐')
  assert.ok(result.linked < 6)
})

test('repairEvalGenChunkTypeSync: expected.chunkType 과 top-level chunkType 이 어긋나면 top-level 을 expected 기준으로 맞춘다', () => {
  const data = cloneData(validWordsResponse())
  const item = data.items[8] as Extract<EvalGenItem, { kind: 'CHUNK_CLASSIFY' }>
  assert.equal(item.chunkType, 'ACTION')
  item.chunkType = 'MODIFIER' // 모델이 top-level 만 다르게 냈다고 가정
  const result = repairEvalGenChunkTypeSync(data)
  assert.equal(result.synced, 1)
  assert.equal(item.chunkType, 'ACTION', 'expected.chunkType 기준으로 되돌아가야 한다')
})

test('repairEvalGenChunkTypeSync: 이미 같으면 손대지 않는다', () => {
  const data = cloneData(validWordsResponse())
  const result = repairEvalGenChunkTypeSync(data)
  assert.equal(result.synced, 0)
})

test('computeEvalItemHash: 같은 핵심(공백·문장부호만 다름)은 같은 해시, 다른 kind 는 같은 표기라도 다른 해시', () => {
  const a = (validWordsResponse().items[0] as EvalGenItem)
  const b = cloneData(a)
  const aItem = { ...a } as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>
  const bItem = { ...b, wordSurface: `${(b as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>).wordSurface} ` } as Extract<EvalGenItem, { kind: 'MEANING_CHOICE' }>
  assert.equal(computeEvalItemHash(aItem), computeEvalItemHash(bItem), '공백만 다르면 정규화 후 같은 해시')

  const readingItem: EvalGenItem = { kind: 'READING_INPUT', dims: ['vocabulary'], wordSurface: aItem.wordSurface, chunkType: null, prompt: { surface: aItem.wordSurface! }, expected: { reading: 'てすと', accepted: ['てすと'] } }
  assert.notEqual(computeEvalItemHash(aItem), computeEvalItemHash(readingItem), 'kind 가 다르면 표기가 같아도 다른 해시')
})

test('EVAL_GEN_MATERIAL_RATIO_MIN 은 0.6', () => {
  assert.equal(EVAL_GEN_MATERIAL_RATIO_MIN, 0.6)
})
