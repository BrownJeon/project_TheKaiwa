import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEXICON_LIMITS } from '@/types/lexicon'
import {
  accentNotation,
  type DraftField,
  emptyDraft,
  isReading,
  type LexiconDraft,
  moraCount,
  priorityValue,
  spokenAccent,
  splitMoras,
  stripArrows,
  toKatakana,
  validateDraft,
  validateWriteMeta,
} from '../kana'

/**
 * 서버 규칙 골든(2026-09-28, A 커밋 a408f00 의 `speech/tts/text`·`lexiconRules` 로 한 번 계산해 옮겨 적은 값).
 * 컴포넌트는 서버 모듈을 import 할 수 없어서(경계 테스트) 서버 함수를 직접 부르지 않고 같은 표본의 결과를 고정한다 —
 * 서버 규칙이 바뀌면 이 표도 다시 떠야 한다. [입력, searchReading 결과(= 화면 toKatakana), KATAKANA_READING 통과, moraCount]
 */
const READING_GOLDEN: [string, string, boolean, number | null][] = [
  ['ニホンバシ', 'ニホンバシ', true, 5], ['キャ', 'キャ', true, 1], ['シュッパツ', 'シュッパツ', true, 4], ['ジンボーチョー', 'ジンボーチョー', true, 6],
  ['ヴァイオリン', 'ヴァイオリン', true, 5], ['ヵ', 'ヵ', true, 0], ['ャア', 'ャア', true, 1], ['トーキョー', 'トーキョー', true, 4],
  ['ッ', 'ッ', true, 1], ['ン', 'ン', true, 1], ['ー', 'ー', true, 1], ['チェ', 'チェ', true, 1], ['ティ', 'ティ', true, 1],
  ['ファ', 'ファ', true, 1], ['ウォ', 'ウォ', true, 1], ['ヮ', 'ヮ', true, 0], ['ヶ', 'ヶ', true, 0], ['ｶﾀｶﾅ', 'カタカナ', true, 4],
  ['ひらがな', 'ヒラガナ', true, 4], ['きょう', 'キョウ', true, 2], ['がっこう', 'ガッコウ', true, 4], ['ゝ', 'ゝ', false, null],
  ['ヽ', 'ヽ', false, null], ['・', '・', false, null], ['ア イ', 'ア イ', false, null], ['ABC', 'ABC', false, null],
  ['日本', '日本', false, null], ['', '', false, null], ['キャッシュ', 'キャッシュ', true, 3], [' しょーゆ ', 'ショーユ', true, 3],
]

test('toKatakana·isReading·moraCount = 서버 골든(표본 30)', () => {
  assert.equal(READING_GOLDEN.length, 30)
  for (const [input, kata, ok, moras] of READING_GOLDEN) {
    assert.equal(toKatakana(input), kata, `toKatakana(${JSON.stringify(input)})`)
    assert.equal(isReading(kata), ok, `isReading(${JSON.stringify(kata)})`)
    if (ok) {
      assert.equal(moraCount(kata), moras, `moraCount(${kata})`)
      assert.equal(splitMoras(kata).join(''), moras === 0 ? '' : kata, `splitMoras(${kata}) 가 글자를 잃지 않는다`)
    }
  }
})

test('toKatakana: 히라가나 → 가타카나, ー 유지, 앞뒤 공백 제거, 반각 가나 → 전각', () => {
  assert.equal(toKatakana(' にほんばし '), 'ニホンバシ')
  assert.equal(toKatakana('らーめん'), 'ラーメン')
  assert.equal(toKatakana('ﾗｰﾒﾝ'), 'ラーメン')
  assert.equal(toKatakana('ニホン'), 'ニホン')
})

test('splitMoras: 拗音은 앞 모라에, ッ·ン·ー 는 한 모라, 맨 앞 작은 가나는 다음 모라에', () => {
  assert.deepEqual(splitMoras('キャッシュ'), ['キャ', 'ッ', 'シュ'])
  assert.deepEqual(splitMoras('ジンボーチョー'), ['ジ', 'ン', 'ボ', 'ー', 'チョ', 'ー'])
  assert.deepEqual(splitMoras('ャア'), ['ャア'])
  assert.deepEqual(splitMoras('ャ'), [])
})

test('accentNotation: 平板·頭高·中高·尾高·한 모라', () => {
  const m = splitMoras('ニホンバシ')
  assert.equal(accentNotation(m, 0), 'ニ↑ホンバシ')
  assert.equal(accentNotation(m, 1), 'ニ↓ホンバシ')
  assert.equal(accentNotation(m, 3), 'ニ↑ホン↓バシ')
  assert.equal(accentNotation(m, 5), 'ニ↑ホンバシ↓')
  assert.equal(accentNotation(['キ'], 0), 'キ')
  assert.equal(accentNotation(['キ'], 1), 'キ↓')
  assert.equal(accentNotation(m, 6), '')
  assert.equal(accentNotation([], 0), '')
  assert.equal(spokenAccent('ニ↑ホン↓バシ'), 'ニ 올라감 ホン 내려감 バシ')
  assert.equal(stripArrows('ニ↑ホン↓バシ'), 'ニホンバシ')
})

function draft(p: Partial<LexiconDraft>): LexiconDraft {
  return { ...emptyDraft(), surface: '日本橋', reading: 'ニホンバシ', ...p }
}

const long = (ch: string, n: number) => Array.from({ length: n }, () => ch).join('')

/**
 * 서버 `parseEntryInput` 골든 — 화면이 실제로 보내는 값(읽기는 가타카나로 바꾼 뒤)에 서버가 낸 오류 칸:코드(같은 날 한 번 계산).
 * 화면 오류 칸 집합이 서버와 같아야 한다(코드 이름은 달라도 같은 문구 표를 탄다 — lexiconCopy.fieldErrorText).
 */
const DRAFT_GOLDEN: [string, Partial<LexiconDraft>, string[]][] = [
  ['정상', {}, []],
  ['정상(히라가나 읽기 — 화면이 가타카나로 바꿔 보냄)', { reading: 'にほんばし' }, []],
  ['표기 빈 값', { surface: '  ' }, ['surface:E_SURFACE']],
  ['표기 40자', { surface: long('橋', 40) }, []],
  ['표기 41자', { surface: long('橋', 41) }, ['surface:E_SURFACE']],
  ['표기 일본어 없음', { surface: 'ABC' }, ['surface:E_SURFACE_NOT_JA']],
  ['표기 공백', { surface: '日本 橋' }, ['surface:E_SURFACE_CHARS']],
  ['표기 폭 없는 문자', { surface: '日本\u200b橋' }, ['surface:E_SURFACE_CHARS']],
  ['읽기 빈 값', { reading: '' }, ['reading:E_READING']],
  ['읽기 가나 밖', { reading: 'nihon' }, ['reading:E_READING']],
  ['읽기 가운뎃점', { reading: 'ニホン・バシ' }, ['reading:E_READING']],
  ['읽기 60자', { reading: long('ア', 60) }, []],
  ['읽기 61자', { reading: long('ア', 61) }, ['reading:E_READING']],
  ['악센트 = 모라 수', { accentType: 5 }, []],
  ['악센트 모라 수 초과', { accentType: 6 }, ['accentType:E_ACCENT']],
  ['악센트 음수', { accentType: -1 }, ['accentType:E_ACCENT']],
  ['악센트 + 읽기 오류(악센트는 검사 안 함)', { reading: 'x', accentType: 9 }, ['reading:E_READING']],
  ['우선순위 빈 값(기본값)', { priority: '' }, []],
  ['우선순위 최대', { priority: '1000' }, []],
  ['우선순위 초과', { priority: '1001' }, ['priority:E_PRIORITY']],
  ['우선순위 음수', { priority: '-1' }, ['priority:E_PRIORITY']],
  ['우선순위 소수', { priority: '1.5' }, ['priority:E_PRIORITY']],
  ['USER 대상 없음', { scope: 'USER', scopeRefId: '' }, ['scopeRefId:E_SCOPE_REF']],
  ['USER 대상 형식', { scope: 'USER', scopeRefId: 'bad id!' }, ['scopeRefId:E_SCOPE_REF']],
  ['USER 대상 정상', { scope: 'USER', scopeRefId: 'cm1abcdefghijk' }, []],
  ['메모 200자', { note: long('あ', 200) }, []],
  ['메모 201자', { note: long('あ', 201) }, ['note:E_NOTE']],
  ['종류 목록 밖', { wordType: 'XX' as never }, ['wordType:E_WORD_TYPE']],
]

test('validateDraft(add) 의 오류 칸 = 서버 골든의 오류 칸', () => {
  const fields: DraftField[] = ['surface', 'reading', 'accentType', 'priority', 'scope', 'scopeRefId', 'wordType', 'note']
  assert.equal(LEXICON_LIMITS.priorityMax, 1000, '골든을 뜬 때의 우선순위 상한')
  for (const [name, p, server] of DRAFT_GOLDEN) {
    const client = new Set(Object.keys(validateDraft(draft(p), 'add')))
    const want = new Set(server.map((x) => x.split(':')[0]))
    for (const f of fields) assert.equal(client.has(f), want.has(f), `${name}: ${f}`)
  }
})

test('validateDraft: 코드·수', () => {
  assert.deepEqual(validateDraft(draft({ surface: '' }), 'add').surface, { code: 'REQUIRED' })
  assert.deepEqual(validateDraft(draft({ surface: long('橋', 41) }), 'add').surface, { code: 'TOO_LONG', n: 41 })
  assert.deepEqual(validateDraft(draft({ surface: 'ABC' }), 'add').surface, { code: 'NO_JAPANESE' })
  assert.deepEqual(validateDraft(draft({ surface: '日 本' }), 'add').surface, { code: 'INVALID_CHARS' })
  assert.deepEqual(validateDraft(draft({ reading: long('ア', 61) }), 'add').reading, { code: 'TOO_LONG', n: 61 })
  assert.deepEqual(validateDraft(draft({ reading: 'abc' }), 'add').reading, { code: 'NOT_KANA' })
  assert.deepEqual(validateDraft(draft({ accentType: 6 }), 'add').accentType, { code: 'OUT_OF_RANGE', n: 5 })
  assert.deepEqual(validateDraft(draft({ scope: 'VOICE', scopeRefId: '' }), 'add').scopeRefId, { code: 'SCOPE_REF_REQUIRED' })
  assert.deepEqual(validateDraft(draft({ scope: null }), 'add').scope, { code: 'REQUIRED' })
  // edit 는 표기·범위를 보내지 않으므로 검사하지 않는다.
  assert.equal(validateDraft(draft({ surface: '', scope: 'USER', scopeRefId: '' }), 'edit').surface, undefined)
  assert.equal(validateDraft(draft({ surface: '', scope: 'USER', scopeRefId: '' }), 'edit').scopeRefId, undefined)
})

test('priorityValue: 빈 값 = 기본값, 정수·범위 밖 = null', () => {
  assert.equal(priorityValue(''), LEXICON_LIMITS.priorityDefault)
  assert.equal(priorityValue(' 7 '), 7)
  assert.equal(priorityValue(String(LEXICON_LIMITS.priorityMax)), LEXICON_LIMITS.priorityMax)
  assert.equal(priorityValue(String(LEXICON_LIMITS.priorityMax + 1)), null)
  assert.equal(priorityValue('1.5'), null)
  assert.equal(priorityValue('x'), null)
})

test('validateWriteMeta: 이유 필수·200자, 확인 문구는 대소문자까지 정확히(앞뒤 공백만 무시)', () => {
  assert.deepEqual(validateWriteMeta('', '', false), { reason: { code: 'REQUIRED' } })
  assert.deepEqual(validateWriteMeta(long('가', 201), '', false), { reason: { code: 'TOO_LONG', n: 201 } })
  assert.deepEqual(validateWriteMeta('오독 수정', '', false), {})
  // 운영 쓰기(needsConfirm)는 이유 10자 이상(task-012c CX-3 — 서버도 같은 규칙)이라 10자가 넘는 이유로 확인 문구만 본다.
  assert.deepEqual(validateWriteMeta('日本橋 오독 수정 — 신고', 'production', true), { confirm: { code: 'MISMATCH' } })
  assert.deepEqual(validateWriteMeta('日本橋 오독 수정 — 신고', ' PRODUCTION ', true), {})
})
