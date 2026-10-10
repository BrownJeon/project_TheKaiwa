/** scripts/seed-build/enrich.ts 행 판정 시험 — `node --import tsx --test scripts/seed-build/enrich.test.ts` (미러에서). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkpointMismatch } from './build'
import {
  CHUNK_TYPES, LEGACY_SPELLING_VARIANTS, PARTS_OF_SPEECH, VOCAB_ENRICH_PROMPT_VERSION, checkRow, mergeLegacyN5, nonCp932Chars, parseRows, serializeRecords, stemOf, toSeedRecord,
  type SeedRecord, type VocabSource,
} from './enrich'
import { checkRecord, validateLevels } from './validate'

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

// ── REV-179 반영(A3) ─────────────────────────────────────────────────────────────────────────────────────────
const OTOUSAN: VocabSource = { word: 'お父さん', reading: 'おとうさん', pos: ['n'], meanings: ['father'] }

test('cp932 — 중국어 간체자(员)는 거절, 일본 한자(員)·전각 기호·cp932 확장(～∥－)은 통과', () => {
  assert.deepEqual(nonCp932Chars('会社员です。'), ['员'])
  assert.deepEqual(nonCp932Chars('会社員です。～∥－「」！？々ヶ'), [])
  const bad = checkRow(['お父さん', '아버지', 'NOUN', 'NAME', 'お父さんは会社员です。', '아버지는 회사원이에요.'], OTOUSAN)
  assert.equal(bad.status, 'retry')
  if (bad.status === 'retry') assert.ok(bad.hard.includes('EXJA_NOT_CP932'))
  assert.equal(checkRow(['お父さん', '아버지', 'NOUN', 'NAME', 'お父さんは会社員です。', '아버지는 회사원이에요.'], OTOUSAN).status, 'ok')
  const rec = { surface: '会社员', reading: 'かいしゃいん', meaning: '회사원', partOfSpeech: 'NOUN', chunkType: 'NAME', example: '会社员です。', exampleKo: '회사원이에요.' }
  assert.ok(checkRecord(rec, null).hard.includes('NOT_CP932'))
})

test('L4 — 번역의 일본어 전각 문장부호·예문의 반각 문장부호·뜻 되풀이는 hard', () => {
  const ok = ['窓', '창문', 'NOUN', 'NAME', '窓を開けます。', '창문을 열어요.']
  assert.equal(checkRow(ok, MADO).status, 'ok')
  const codes = (row: unknown[]) => { const v = checkRow(row, MADO); return v.status === 'ok' ? [] : v.hard }
  assert.ok(codes(['窓', '창문', 'NOUN', 'NAME', '窓を開けます。', '창문을 열어요。']).includes('EXKO_JA_PUNCT'))
  assert.ok(codes(['窓', '창문', 'NOUN', 'NAME', '窓を開けます。', '「창문」을 열어요.']).includes('EXKO_JA_PUNCT'))
  assert.ok(codes(['窓', '창문', 'NOUN', 'NAME', '窓を開けて!', '창문을 열어!']).includes('EXJA_ASCII_PUNCT'))
  assert.equal(checkRow(['窓', '창문', 'NOUN', 'NAME', '窓を開けて！', '창문을 열어!'], MADO).status, 'ok', '번역의 ASCII ! 는 한국어 문장부호로 허용')
  assert.ok(codes(['窓', '창문, 창문', 'NOUN', 'NAME', '窓を開けます。', '창문을 열어요.']).includes('MEANING_REPEAT'))
  assert.ok(codes(['窓', '창문, 유리창, 창문', 'NOUN', 'NAME', '窓を開けます。', '창문을 열어요.']).includes('MEANING_REPEAT'))
})

const rec = (surface: string, reading: string, over: Partial<SeedRecord> = {}): SeedRecord =>
  ({ surface, reading, meaning: '뜻', partOfSpeech: 'NOUN', chunkType: 'NAME', example: `${surface}です。`, exampleKo: '예문이에요.', ...over })

test('M3 — 기존 50개 병합: (표기, 읽기)가 없는 행만 원본 뒤에 기존 순서·기존 값으로, 철자 차이 짝은 붙이지 않음', () => {
  assert.deepEqual(LEGACY_SPELLING_VARIANTS, { 'ご飯': '御飯', '友だち': '友達' })
  const n5 = [rec('私', 'わたくし'), rec('御飯', 'ごはん'), rec('窓', 'まど')]
  const legacy = [rec('窓', 'まど', { meaning: '사람' }), rec('私', 'わたし', { meaning: '나, 저' }), rec('ご飯', 'ごはん'), rec('日本語', 'にほんご'), rec('友だち', 'ともだち')]
  const m = mergeLegacyN5(n5, legacy)
  assert.deepEqual(m.records.map((r) => `${r.surface}/${r.reading}`), ['私/わたくし', '御飯/ごはん', '窓/まど', '私/わたし', '日本語/にほんご', '友だち/ともだち'], '友達 이 N5 에 없으면 友だち 는 붙는다')
  assert.equal(m.records[2]!.meaning, '뜻', '이미 있는 (표기, 읽기)는 N5 값 유지')
  assert.equal(m.records[3]!.meaning, '나, 저', '병합 행은 기존 값 그대로')
  assert.deepEqual(m.variants, ['ご飯→御飯/ごはん'])
  assert.deepEqual(Object.keys(m.records[3]!), ['surface', 'reading', 'meaning', 'partOfSpeech', 'chunkType', 'example', 'exampleKo'])
  assert.deepEqual(mergeLegacyN5(m.records, legacy).merged, [], '두 번 돌려도 같다')
})

function fixtureRepo(withRaw: boolean): { repo: string; raw: string } {
  const repo = mkdtempSync(join(tmpdir(), 'seed051-'))
  const raw = join(repo, 'raw')
  mkdirSync(join(repo, 'prisma', 'seed-data', 'jlpt'), { recursive: true })
  const r = rec('窓', 'まど', { example: '窓を開けます。', exampleKo: '창문을 열어요.', meaning: '창문' })
  writeFileSync(join(repo, 'prisma', 'seed-data', 'jlpt', 'n4.json'), serializeRecords([r]))
  if (withRaw) { mkdirSync(raw); writeFileSync(join(raw, 'n4.json'), JSON.stringify([{ word: '窓', reading: 'まど', pos: ['n'], meanings: ['window'] }])) }
  return { repo, raw }
}

test('L2 — 원본(raw)이 없으면 PASSED 가 아니다(실패, --allow-missing-raw 면 INCOMPLETE)', () => {
  const ok = fixtureRepo(true)
  const pass = validateLevels({ repo: ok.repo, raw: ok.raw, levels: ['N4'], checkCounts: false })
  assert.equal(pass.hardTotal, 0, pass.text)
  assert.match(pass.text, /VALIDATE_PASSED/)
  const none = fixtureRepo(false)
  const fail = validateLevels({ repo: none.repo, raw: none.raw, levels: ['N4'], checkCounts: false })
  assert.ok(fail.hardTotal > 0)
  assert.match(fail.text, /VALIDATE_FAILED/)
  const warn = validateLevels({ repo: none.repo, raw: none.raw, levels: ['N4'], checkCounts: false, allowMissingRaw: true })
  assert.equal(warn.hardTotal, 0)
  assert.deepEqual(warn.rawMissing, ['N4'])
  assert.match(warn.text, /VALIDATE_INCOMPLETE/)
})

test('L3 — 체크포인트: 원본 해시가 다르면 거부, 옛 체크포인트(해시 없음)는 개수·프롬프트·모델만 본다', () => {
  const base = { total: 2, promptVersion: VOCAB_ENRICH_PROMPT_VERSION, model: 'haiku' }
  const want = { total: 2, model: 'haiku', rawSha256: 'a'.repeat(64) }
  assert.equal(checkpointMismatch({ ...base, rawSha256: 'a'.repeat(64) }, want), null)
  assert.match(checkpointMismatch({ ...base, rawSha256: 'b'.repeat(64) }, want) ?? '', /원본 해시/)
  assert.equal(checkpointMismatch(base, want), null)
  assert.match(checkpointMismatch({ ...base, total: 3 }, want) ?? '', /원본 개수/)
})
