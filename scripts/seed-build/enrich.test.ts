/** scripts/seed-build/enrich.ts 행 판정 시험 — `node --import tsx --test scripts/seed-build/enrich.test.ts` (미러에서). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHUNK_TYPES, PARTS_OF_SPEECH, checkRow, parseRows, serializeRecords, stemOf, toSeedRecord, type VocabSource } from './enrich'
import { checkRecord } from './validate'

const KAU: VocabSource = { word: '会う', reading: 'あう', pos: ['v5u', 'vi'], meanings: ['to meet'] }
const MADO: VocabSource = { word: '窓', reading: 'まど', pos: ['n'], meanings: ['window'] }

test('앱 enum 과 같다(words.ts 원문 대조 — DB·Prisma 를 불러오지 않으려고 import 하지 않는다)', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/learning/vocab/words.ts'), 'utf8')
  const list = (name: string) => JSON.parse(src.match(new RegExp(`${name} = (\\[[^\\]]*\\])`))![1]!.replace(/'/g, '"')) as string[]
  assert.deepEqual(list('PARTS_OF_SPEECH'), [...PARTS_OF_SPEECH])
  assert.deepEqual(list('WORD_CHUNK_TYPES'), [...CHUNK_TYPES])
})

test('정상 행 → ok, 뜻 쉼표 정규화, 어간만 포함은 soft', () => {
  const v = checkRow(['会う', '만나다,뵙다', 'VERB', 'ACTION', '駅で友達に会いました。', '역에서 친구를 만났어요.'], KAU)
  assert.equal(v.status, 'ok')
  if (v.status !== 'ok') return
  assert.equal(v.row.meaningKo, '만나다, 뵙다')
  assert.deepEqual(v.soft, ['EXJA_STEM_ONLY'])
  const rec = toSeedRecord(KAU, v.row)
  assert.deepEqual(Object.keys(rec), ['surface', 'reading', 'meaning', 'partOfSpeech', 'chunkType', 'example', 'exampleKo'])
  assert.deepEqual(checkRecord(rec, KAU), { hard: [], soft: ['EXJA_STEM_ONLY'] })
})

test('확신 없음(뜻 null)·예문 null → null, 계약 위반 → retry', () => {
  assert.equal(checkRow([null, null, 'NOUN', null, null, null], MADO).status, 'null')
  const exNull = checkRow(['窓', '창문', 'NOUN', 'NAME', null, null], MADO)
  assert.deepEqual(exNull, { status: 'null', hard: ['EXAMPLE_NULL'] })
  const mismatch = checkRow(['まど', '창문', 'NOUN', 'NAME', '窓を開けます。', '창문을 열어요.'], MADO)
  assert.equal(mismatch.status, 'retry')
  const noHead = checkRow(['窓', '창문', 'NOUN', 'NAME', 'ドアを開けます。', '문을 열어요.'], MADO)
  assert.deepEqual(noHead, { status: 'retry', hard: ['EXJA_NO_HEADWORD'] })
  const pair = checkRow(['窓', '창문', 'NOUN', 'NAME', '窓を開けます。', null], MADO)
  assert.deepEqual(pair, { status: 'retry', hard: ['EXAMPLE_PAIR'] })
  assert.equal(checkRow(['窓', '창문'], MADO).status, 'retry')
})

test('어간 규칙 — する 붙은 동작명사·来る 복합·いい 복합', () => {
  assert.equal(stemOf('コピーする', ['n', 'vs', 'vt']), 'コピー')
  assert.equal(stemOf('持って来る', ['vk']), '持って来')
  assert.equal(stemOf('持ってくる', ['vk']), null)
  assert.equal(stemOf('かっこいい', ['adj-ix']), 'かっこ')
  assert.equal(stemOf('食べる', ['v1', 'vt']), '食べ')
  assert.equal(stemOf('する', ['vs-i']), null)
  const copy: VocabSource = { word: 'コピーする', reading: 'コピーする', pos: ['n', 'vs', 'vt'], meanings: ['to copy'] }
  assert.equal(checkRow(['コピーする', '복사하다', 'VERB', 'ACTION', 'この紙をコピーしてください。', '이 종이를 복사해 주세요.'], copy).status, 'ok')
})

test('chunkType 이탈 값은 null 로 강제(soft)', () => {
  const v = checkRow(['窓', '창문', 'NOUN', 'EXPRESSION', '窓を開けます。', '창문을 열어요.'], MADO)
  assert.equal(v.status, 'ok')
  if (v.status === 'ok') { assert.equal(v.row.chunkType, null); assert.ok(v.soft.includes('CHUNK_COERCED')) }
})

test('parseRows — 코드펜스·앞뒤 설명 허용, 배열 아니면 null', () => {
  assert.deepEqual(parseRows('```json\n[["a"]]\n```'), [['a']])
  assert.deepEqual(parseRows('결과입니다: [[1,2]] 끝'), [[1, 2]])
  assert.equal(parseRows('{"a":1}'), null)
  assert.equal(parseRows('nope'), null)
})

test('checkRecord — 키 순서·가나 읽기·빈 예문', () => {
  const base = { surface: '窓', reading: 'まど', meaning: '창문', partOfSpeech: 'NOUN', chunkType: 'NAME', example: '窓を開けます。', exampleKo: '창문을 열어요.' }
  assert.deepEqual(checkRecord(base, MADO).hard, [])
  assert.ok(checkRecord({ ...base, reading: 'mado' }, null).hard.includes('READING_KANA'))
  assert.ok(checkRecord({ ...base, example: '' }, MADO).hard.includes('EMPTY_example'))
  const { surface, ...rest } = base
  assert.ok(checkRecord({ ...rest, surface }, MADO).hard.includes('KEYS'))
  const line = serializeRecords([base as never])
  assert.equal(JSON.parse(line).length, 1)
})
