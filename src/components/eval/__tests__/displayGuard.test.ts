import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReadingSegment } from '@/modules/speech/reading/client'
import { LOADING, NONE, OFF, type AnnotationState } from '@/components/common/japanese/annotations'
import type { EvalItemKind, EvaluationItem } from '@/types/evaluation'
import { ITEM } from '../evalCopy'
import {
  assembleMineText,
  assembleRightText,
  blankParts,
  collectEvalTexts,
  filledRange,
  fixLineRanges,
  guardedRuby,
  guardHits,
  guardStem,
  guardWordRuby,
  readingGuardKeys,
  showReadingGuardNote,
  spotSegmentRuby,
  usageRightFill,
} from '../displayGuard'

/**
 * task-033 A 평가 — 정답 보호(P1~P4)와 층 계산의 순수 로직. 보호 분기를 되돌리면 실패해야 하는 테스트들이다(변이 검사 기록은 task 이력서).
 */

const seg = (surface: string, ruby: ReadingSegment['ruby'] = null): ReadingSegment => ({ surface, ruby, pron: surface, boundary: null })
const ready = (...segments: ReadingSegment[]): AnnotationState => ({ s: 'ready', segments })

const item = (kind: EvalItemKind, prompt: Record<string, unknown>, extra: Partial<EvaluationItem> = {}): EvaluationItem => ({
  id: `${kind}-${Math.random()}`,
  order: 0,
  kind,
  prompt,
  maxScore: 10,
  answered: false,
  answerText: null,
  answerOrder: null,
  inputSource: null,
  answeredAt: null,
  expected: null,
  score: null,
  correct: null,
  feedback: null,
  dims: null,
  ...extra,
})

const reading = (surface: string) => item('READING_INPUT', { surface })

// ── 키 어간 ──────────────────────────────────────────────────────────────────

test('guardStem: 마지막 한자까지 자른 어간 — 활용형이 새지 않게 · 가나 단어는 키 없음', () => {
  assert.equal(guardStem('注文'), '注文')
  assert.equal(guardStem('片付ける'), '片付')
  assert.equal(guardStem('食べる'), '食')
  assert.equal(guardStem('引き受ける'), '引き受')
  assert.equal(guardStem('お願いする'), 'お願')
  assert.equal(guardStem('たまに'), '')
  assert.equal(guardStem(''), '')
})

test('readingGuardKeys: READING_INPUT 만 · 중복 제거 · 가나 단어 키 없음 · 다른 종류는 무시', () => {
  const keys = readingGuardKeys([
    reading('注文'),
    reading('片付ける'),
    reading('注文'),
    reading('たまに'),
    item('MEANING_CHOICE', { surface: '勉強' }),
    item('USAGE_CHOICE', { sentenceJa: '___を食べる' }),
  ])
  assert.deepEqual(keys, ['注文', '片付'])
})

// ── 히트 ─────────────────────────────────────────────────────────────────────

test('guardHits: 키가 나오는 모든 자리(여러 개) · 활용형도 걸림 · 키가 없으면 빈 배열', () => {
  const hits = guardHits('食べる前に食べました', ['食'])
  assert.deepEqual(
    hits.map((h) => [h.start, h.end]),
    [
      [0, 1],
      [5, 6],
    ],
  )
  assert.deepEqual(guardHits('今日は晴れ', ['食']), [])
  assert.deepEqual(guardHits('食べる', []), [])
  assert.deepEqual(guardHits('', ['食']), [])
})

test('guardHits: 키 여러 개가 겹치면 하나로 합친다(코드포인트 기준)', () => {
  const hits = guardHits('注文書を出す', ['注文', '文書'])
  assert.deepEqual(
    hits.map((h) => [h.start, h.end]),
    [[0, 3]],
  )
  const emoji = guardHits('😀食べる', ['食'])
  assert.deepEqual([emoji[0].start, emoji[0].end], [1, 2], '서러게이트 쌍을 한 글자로 센다')
})

test('guardHits: 키가 글 끝에 오거나 글 전체가 키여도 걸린다(경계 — 뜻 고르기 단어 상자처럼 글 전체가 키인 경우)', () => {
  assert.deepEqual(
    guardHits('注文', ['注文']).map((h) => [h.start, h.end]),
    [[0, 2]],
    '글 전체가 키',
  )
  assert.deepEqual(
    guardHits('勉強を注文', ['注文']).map((h) => [h.start, h.end]),
    [[3, 5]],
    '키가 글 끝',
  )
  assert.deepEqual(
    guardHits('食', ['食']).map((h) => [h.start, h.end]),
    [[0, 1]],
    '한 글자 키 = 한 글자 글',
  )
  assert.deepEqual(guardHits('注', ['注文']), [], '글이 키보다 짧으면 히트 없음')
})

// ── 보호 루비 ────────────────────────────────────────────────────────────────

const SENTENCE = '昨日、食べました。'
const readySentence = ready(seg('昨日', [['昨日', 'きのう']]), seg('、'), seg('食べました。', [['食', 'た'], ['べました。', null]]))

test('guardedRuby: 히트와 겹친 조각의 읽기만 뺀다(다른 한자 히라가나는 그대로)', () => {
  const hits = guardHits(SENTENCE, ['食'])
  const ruby = guardedRuby(SENTENCE, readySentence, hits, true)
  assert.ok(ruby)
  assert.deepEqual(
    ruby.map((p) => [p.text, p.reading]),
    [
      ['昨日', 'きのう'],
      ['、', null],
      ['食', null],
      ['べました。', null],
    ],
  )
})

test('guardedRuby: 히트가 없으면 읽기 그대로 — 보호는 히트가 있을 때만 읽기를 뺀다', () => {
  const ruby = guardedRuby(SENTENCE, readySentence, [], true)
  assert.deepEqual(ruby?.filter((p) => p.reading).map((p) => p.reading), ['きのう', 'た'])
})

test('guardedRuby: 한자 묶음의 한 글자만 히트여도 그 조각 전체의 읽기를 뺀다(반쪽 읽기 없음)', () => {
  const st = ready(seg('片付けました', [['片付', 'かたづ'], ['けました', null]]))
  const hits = guardHits('片付けました', ['付'])
  const ruby = guardedRuby('片付けました', st, hits, true)
  assert.deepEqual(ruby, [
    { text: '片付', reading: null },
    { text: 'けました', reading: null },
  ])
})

test('guardedRuby: 기다리는 중 = 한자 있을 때만 줄간격 예약(읽기 없음) · 끔·분석 불가·읽기 설정 끔 = null', () => {
  assert.deepEqual(guardedRuby(SENTENCE, LOADING, [], true), [{ text: SENTENCE, reading: null }])
  assert.equal(guardedRuby('たまに', LOADING, [], true), null)
  assert.equal(guardedRuby(SENTENCE, NONE, [], true), null)
  assert.equal(guardedRuby(SENTENCE, OFF, [], true), null)
  assert.equal(guardedRuby(SENTENCE, readySentence, [], false), null)
})

test('guardedRuby: 읽기가 하나도 없거나 조각을 이은 글이 본문과 다르면 null(범위를 믿을 수 없다)', () => {
  assert.equal(guardedRuby('たまに', ready(seg('たまに')), [], true), null)
  assert.equal(guardedRuby('別の文', readySentence, [], true), null)
})

test('guardWordRuby: 저장 읽기 루비에서 히트 겹친 조각만 뺀다 · 루비 없음은 null', () => {
  const pieces = [
    { text: '片付', reading: 'かたづ' },
    { text: 'ける', reading: null },
  ]
  const out = guardWordRuby(pieces, guardHits('片付ける', ['片付']))
  assert.deepEqual(out, [
    { text: '片付', reading: null },
    { text: 'ける', reading: null },
  ])
  assert.equal(guardWordRuby(null, []), null)
  assert.deepEqual(guardWordRuby(pieces, []), pieces, '히트가 없으면 그대로')
  assert.equal(pieces[0].reading, 'かたづ', '입력을 바꾸지 않는다')
})

test('P1 안내: 히라가나나 한글이 하나라도 켜졌을 때만 · 둘 다 끔·설정 로드 전이면 없음 · 문구 원문', () => {
  assert.equal(showReadingGuardNote(true, true, true), true)
  assert.equal(showReadingGuardNote(true, true, false), true)
  assert.equal(showReadingGuardNote(true, false, true), true)
  assert.equal(showReadingGuardNote(true, false, false), false)
  assert.equal(showReadingGuardNote(false, true, true), false)
  assert.equal(ITEM.readingGuardNote, '읽기를 묻는 문항이라 히라가나·한글은 제출한 뒤에 보여 줘요.')
})

// ── 빈칸·조각·채운 문장·고친 줄 ───────────────────────────────────────────────────

test('blankParts: ___ 에서 앞뒤로 · 없으면 null', () => {
  assert.deepEqual(blankParts('昨日、___を食べた。'), { before: '昨日、', after: 'を食べた。' })
  assert.deepEqual(blankParts('___'), { before: '', after: '' })
  assert.equal(blankParts('昨日、食べた。'), null)
})

test('spotSegmentRuby: 조각 경계로 나눈다 — 조각별 읽기 · 한자 없는 조각 null', () => {
  const segments = ['昨日', '、', '食べました。']
  const out = spotSegmentRuby(readySentence, segments, true)
  assert.deepEqual(out[0], [{ text: '昨日', reading: 'きのう' }])
  assert.equal(out[1], null)
  assert.deepEqual(out[2]?.map((p) => [p.text, p.reading]), [
    ['食', 'た'],
    ['べました。', null],
  ])
})

test('spotSegmentRuby: 경계가 한자 묶음을 자르면 그 묶음만 읽기 없음(다른 조각은 그대로)', () => {
  const st = ready(seg('昨日', [['昨日', 'きのう']]), seg('注文した', [['注文', 'ちゅうもん'], ['した', null]]))
  const out = spotSegmentRuby(st, ['昨日注', '文した'], true)
  assert.deepEqual(out[0]?.map((p) => [p.text, p.reading]), [
    ['昨日', 'きのう'],
    ['注', null],
  ])
  assert.equal(out[1], null, '잘린 묶음의 나머지(文)는 읽기 없음 → 읽을 것이 없는 조각은 null')
})

test('spotSegmentRuby: 기다리는 중 = 한자 있는 조각만 줄간격 예약 · 끔·분석 불가·본문 불일치 = 전부 null · 교차 보호 히트는 겹친 조각 읽기를 뺀다', () => {
  const segments = ['昨日', '、', '食べました。']
  assert.deepEqual(spotSegmentRuby(LOADING, segments, true), [[{ text: '昨日', reading: null }], null, [{ text: '食べました。', reading: null }]])
  assert.deepEqual(spotSegmentRuby(NONE, segments, true), [null, null, null])
  assert.deepEqual(spotSegmentRuby(readySentence, segments, false), [null, null, null])
  assert.deepEqual(spotSegmentRuby(readySentence, ['違う', '文'], true), [null, null])
  const hits = guardHits(SENTENCE, ['食'])
  const guarded = spotSegmentRuby(readySentence, segments, true, hits)
  assert.deepEqual(guarded[0], [{ text: '昨日', reading: 'きのう' }])
  assert.equal(guarded[2], null, '食 조각의 읽기가 빠져 읽을 것이 없다')
})

test('filledRange: 빈칸을 채운 문장 · 채운 말 범위(코드포인트) · 빈칸이 없거나 채울 말이 없으면 null', () => {
  const r = filledRange('昨日、___を食べた。', 'りんご', 'X')
  assert.deepEqual(r, { text: '昨日、りんごを食べた。', ranges: [{ start: 3, end: 6, className: 'X' }] })
  assert.equal(filledRange('昨日食べた。', 'りんご', 'X'), null)
  assert.equal(filledRange('___を食べた。', '', 'X'), null)
  assert.equal(filledRange('___を食べた。', null, 'X'), null)
})

const CLS = { wrong: 'W', fix: 'F' }

test('fixLineRanges: 앞 + 틀린 말 + 공백 + 고친 말 + 뒤 · 두 범위', () => {
  const r = fixLineRanges('私は学校を行きます。', 'を', '私は学校に行きます。', CLS)
  assert.deepEqual(r, {
    text: '私は学校を に行きます。',
    ranges: [
      { start: 4, end: 5, className: 'W' },
      { start: 6, end: 7, className: 'F' },
    ],
    hasFix: true,
  })
})

test('fixLineRanges: 고친 말을 못 뽑으면 hasFix=false(틀린 말 범위만) · 틀린 말이 문장에 없으면 null', () => {
  const r = fixLineRanges('私は学校を行きます。', 'を', 'まったく違う文です。', CLS)
  assert.deepEqual(r, { text: '私は学校を行きます。', ranges: [{ start: 4, end: 5, className: 'W' }], hasFix: false })
  assert.equal(fixLineRanges('私は学校を行きます。', 'ない', '私は学校に行きます。', CLS), null)
})

test('결과 문자열 도우미: 정답 보기 · 조립 내 답(순서)·정답(띄어 이음)', () => {
  const usage = item('USAGE_CHOICE', { sentenceJa: '___を食べる', choices: ['りんご', 'くつ'] }, { expected: { answer: 1 } })
  assert.equal(usageRightFill(usage), 'くつ')
  const asm = item('ASSEMBLE', { pieces: ['私は', '学校に', '行きます'] }, { answerOrder: [1, 0, 2], answerText: 'x', expected: { order: ['私は', '学校に', '行きます'] } })
  assert.equal(assembleMineText(asm), '学校に 私は 行きます')
  assert.equal(assembleRightText(asm), '私は 学校に 行きます')
  assert.equal(assembleMineText({ ...asm, answerOrder: null }), 'x')
})

// ── 분석 목록 ────────────────────────────────────────────────────────────────

test('collectEvalTexts(제출 전): 읽기 쓰기 단어(P1)와 숨긴 듣기 문장(P3)을 넣지 않는다', () => {
  const items = [
    reading('注文'),
    item('MEANING_CHOICE', { surface: '勉強', reading: 'べんきょう', choices: ['공부', '운동'] }),
    item('CHUNK_CLASSIFY', { textJa: '食べる', reading: 'たべる' }),
    item('USAGE_CHOICE', { sentenceJa: '昨日、___を食べた。', choices: ['りんご', '図書館'] }),
    item('LISTEN_RESPOND', { instructionKo: '듣고 답하세요', textJa: '今日はいい天気ですね', textHidden: true }, { textRevealed: false }),
    item('ASSEMBLE', { pieces: ['きのう', 'は', '学校に'] }),
    item('CORRECTION_SPOT', { sentenceJa: '私は学校を行きます。', segments: ['私は', '学校を', '行きます。'] }),
  ]
  const texts = collectEvalTexts(items)
  assert.ok(!texts.includes('注文'), '읽기 쓰기 단어 없음')
  assert.ok(!texts.includes('今日はいい天気ですね'), '숨긴 듣기 문장 없음')
  assert.ok(texts.includes('勉強'))
  assert.ok(texts.includes('食べる'))
  assert.ok(texts.includes('昨日、'), '빈칸 앞(한자 있음)')
  assert.ok(texts.includes('を食べた。'), '빈칸 뒤(한자 있음)')
  assert.ok(texts.includes('図書館'), '일본어 보기')
  assert.ok(texts.includes('学校に'), '한자 있는 조각')
  assert.ok(!texts.includes('きのう') && !texts.includes('は'), '한자 없는 조각은 분석하지 않는다(조각은 히라가나만 — 한자가 없으면 그릴 것이 없다)')
  assert.ok(texts.includes('私は学校を行きます。'))
})

test('collectEvalTexts(제출 전): 글자로 본 듣기 문장·내가 한 말은 넣는다 · 중복·빈 글자 제거', () => {
  const items = [
    item('LISTEN_RESPOND', { instructionKo: 'x', textJa: '今日はいい天気ですね' }, { textRevealed: true, answered: true, answerText: 'はい、そうですね' }),
    item('SITUATION_RESPOND', { situationKo: 'x' }, { answered: true, answerText: 'はい、そうですね' }),
    item('SITUATION_RESPOND', { situationKo: 'x' }, { answered: false, answerText: null }),
  ]
  assert.deepEqual(collectEvalTexts(items), ['今日はいい天気ですね', 'はい、そうですね'])
})

test('collectEvalTexts(결과): 내 답·정답·모범 답·들려준 말·채운 문장·고친 줄·고친 문장 — 읽기 쓰기 단어·단어 상자는 넣지 않는다', () => {
  const items = [
    item('READING_INPUT', { surface: '注文' }, { answered: true, answerText: 'ちゅもん', expected: { reading: 'ちゅうもん' } }),
    item('MEANING_CHOICE', { surface: '勉強', choices: ['공부'] }, { expected: { answer: 0 } }),
    item('USAGE_CHOICE', { sentenceJa: '___を食べた。', choices: ['りんご', 'くつ'] }, { answered: true, answerText: 'くつ', expected: { answer: 0 } }),
    item('ASSEMBLE', { pieces: ['私は', '学校に', '行きます'] }, { answered: true, answerOrder: [1, 0, 2], expected: { order: ['私は', '学校に', '行きます'] } }),
    item('LISTEN_RESPOND', { textJa: '今日はいい天気ですね' }, { answered: true, answerText: 'はい', expected: { modelAnswerJa: 'そうですね', modelReading: 'そうですね' } }),
    item('CORRECTION_SPOT', { sentenceJa: '私は学校を行きます。' }, { expected: { wrongSpan: 'を', correctedJa: '私は学校に行きます。' } }),
  ]
  const texts = collectEvalTexts(items, { done: true })
  for (const t of ['ちゅもん', 'ちゅうもん', 'くつを食べた。', 'りんごを食べた。', '学校に 私は 行きます', '私は 学校に 行きます', '今日はいい天気ですね', 'はい', 'そうですね', '私は学校を行きます。', '私は学校を に行きます。', '私は学校に行きます。']) {
    assert.ok(texts.includes(t), `${t} 가 목록에 있어야 한다 — ${JSON.stringify(texts)}`)
  }
  assert.ok(!texts.includes('注文') && !texts.includes('勉強'), '단어 표기는 결과에 그리지 않는다')
})

// ── 화면 연결(정적) ───────────────────────────────────────────────────────────

const read = (rel: string) => readFileSync(join(process.cwd(), 'src/components/eval', rel), 'utf8')

test('정적: 읽기 쓰기 단어 상자는 층 부품을 쓰지 않고(P1) 번역 층은 평가 어디에도 없다', () => {
  const items = read('EvalItems.tsx')
  const reading = items.slice(items.indexOf('export function ReadingItem('), items.indexOf('export interface ListenView'))
  assert.match(reading, /<PlainWordBox /)
  assert.ok(!/JaText|HangulLine|useWordLayers|useAnnotations/.test(reading), 'ReadingItem 은 층 부품을 쓰지 않는다')
  for (const f of ['EvalItems.tsx', 'EvalRunner.tsx', 'EvalResult.tsx']) {
    const src = read(f)
    assert.ok(!/useUserTranslation|showTranslation|'tr'/.test(src), `${f}: 평가에 번역 층 없음`)
  }
  assert.match(read('EvalRunner.tsx'), /<DisplayToggles keys=\{\['fu', 'hg'\]\}/, '도구 줄은 히라가나·한글 두 개')
})

test('정적: 평가 화면 코드에 소리 변환 직접 호출·옛 읽기 줄(modelReading·prompt.reading 글자 그리기) 없음', () => {
  for (const f of ['EvalItems.tsx', 'EvalRunner.tsx', 'EvalResult.tsx', 'displayGuard.ts']) {
    const src = read(f)
    assert.ok(!/kanaToHangul\(|pronLine\(/.test(src), `${f}: 변환 호출 없음(O-1)`)
  }
  assert.ok(!/modelReading/.test(read('EvalResult.tsx')), '모범 답 아래 읽기 줄 삭제(026 D2-B)')
})

test('정적: 평가 푸는 화면의 `[한글]` 줄은 히트(교차 보호)가 없을 때만 · 조립 조각(P4)·용법 빈칸 문장에는 아예 없다', () => {
  const items = read('EvalItems.tsx')
  const between = (from: string, to: string) => {
    const a = items.indexOf(from)
    const b = items.indexOf(to)
    assert.ok(a >= 0 && b > a, `${from} … ${to}`)
    return items.slice(a, b)
  }
  const lines = items.split('\n').filter((l) => l.includes('<HangulLine'))
  assert.equal(lines.length, 4, '단어 상자 · 일본어 블록 · 일본어 보기 · 틀린 곳 문장')
  for (const l of lines) assert.match(l, /(hits|sentenceHits)\.length \? null : <HangulLine/, `히트가 있으면 그리지 않는다 — ${l.trim()}`)
  assert.ok(!between('function UsageSentence(', 'export function BlankSentence(').includes('HangulLine'), '용법 빈칸 문장 [한글] 없음')
  assert.ok(!between('export function AssembleItem(', 'export function SpotItem(').includes('HangulLine'), '조립 조각 [한글] 없음')
  assert.match(between('function GJa(', 'function JaBlock('), /hits\.length > 0 \? guardedRuby\(/, '히트가 있으면 보호 루비 경로')
  assert.match(between('function WordBox(', 'function PlainWordBox('), /hits\.length \? guardWordRuby\(layers\.ruby, hits\) : layers\.ruby/)
  assert.match(between('export function AssembleItem(', 'export function SpotItem('), /useAnnotations\(pieces\.map\(\(p\) => \(hasKanji\(p\) \? p : ''\)\)\)/, '한자 없는 조각은 분석하지 않는다')
})

test('정적: 평가 결과는 보호 키를 쓰지 않고(제출 뒤) 틀린 곳 찾기 내 답·문항 줄 제목에는 층을 달지 않는다', () => {
  const result = read('EvalResult.tsx')
  assert.ok(!/readingGuardKeys|guardHits|guardedRuby/.test(result), '결과 화면은 정답 보호 없음')
  const mine = result.slice(result.indexOf('function MyAnswer('), result.indexOf('function RightAnswer('))
  const spot = mine.slice(mine.indexOf("case 'CORRECTION_SPOT'"), mine.indexOf('default:'))
  assert.ok(!/JaBlock|JaText|HangulLine/.test(spot), '틀린 곳 찾기 내 답은 한국어가 섞여 층 없음')
  const row = result.slice(result.indexOf('function ItemRow('), result.indexOf('function LevelCard('))
  assert.ok(!/JaText|HangulLine/.test(row), '문항 줄 제목 일본어 태그는 층 없음')
})

test('정적: 교차 보호 호출부 6곳은 모두 guardHits(글, guard) — 보호 키를 빈 배열로 바꾸거나 인자를 지우면 실패', () => {
  const items = read('EvalItems.tsx')
  const calls = items.split('\n').filter((l) => l.includes('guardHits(') && !l.startsWith('import '))
  assert.equal(calls.length, 6, 'JaBlock · WordBox · UsageSentence · JaChoice · AssembleItem 조각 · SpotItem 문장')
  for (const l of calls) {
    assert.match(l, /guardHits\([^,()]+(?:\[[^\]]*\])?[^,()]*, guard\)/, `둘째 인자는 guard — ${l.trim()}`)
    assert.ok(!/guardHits\([^)]*,\s*\[\s*\]\s*\)/.test(l), `빈 키 배열 금지 — ${l.trim()}`)
  }
  const between = (from: string, to: string) => {
    const a = items.indexOf(from)
    const b = items.indexOf(to, a + 1)
    assert.ok(a >= 0 && b > a, `${from} … ${to}`)
    return items.slice(a, b)
  }
  assert.match(between('function JaBlock(', 'function WordBox('), /const hits = guardHits\(text, guard\)/, '일본어 블록(듣기 글자·내가 한 말·옛 틀린 곳)')
  assert.match(between('function WordBox(', 'function PlainWordBox('), /const hits = guardHits\(word, guard\)/, '단어 상자')
  assert.match(between('function UsageSentence(', 'export function BlankSentence('), /hits=\{guardHits\(blocks\[i\], guard\)\}/, '용법 빈칸 문장')
  assert.match(between('function JaChoice(', 'export function AssembleItem('), /const hits = guardHits\(text, guard\)/, '일본어 보기')
  assert.match(between('export function AssembleItem(', 'export function SpotItem('), /hits=\{guardHits\(pieces\[k\] \?\? '', guard\)\}/, '조립 조각')
  assert.match(items, /const sentenceHits = guardHits\(sentence, guard\)/, '틀린 곳 문장')
  assert.match(items, /spotSegmentRuby\(sentenceState, segments, [^)]*sentenceHits\)/, '틀린 곳 조각 루비에 히트 전달')
})
