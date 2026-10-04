import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReadingSegment } from '@/modules/speech/reading/client'
import { alignWordRuby, WORD_RUBY_MAX_SURFACE } from '@/modules/speech/reading/client'
import { readingMatches } from '@/components/common/japanese/annotations'
import { quizPromptLayerState, quizReadingLeak } from '../logic'

/** 조각 하나 — `ruby` 는 [표기, 읽기|null] 묶음(이으면 surface). */
const seg = (surface: string, ruby: Array<[string, string | null]> | null = null): ReadingSegment => ({ surface, ruby, pron: null, boundary: null })

/* ── ③ 읽기 문제 보호(task-026 §15-9 ②) ─────────────────────────────────── */

test('quizReadingLeak: 문장 한자 읽기가 가나 보기와 같으면 가린다', () => {
  const s = [seg('「'), seg('注文', [['注文', 'ちゅうもん']]), seg('」')]
  assert.equal(quizReadingLeak(s, ['ちゅうもん', 'ちゅもん', 'ちゅうもう', 'しゅうもん']), true)
})

test('quizReadingLeak: 가타카나·괄호·공백 보기도 히라가나로 맞춰 비교', () => {
  const s = [seg('注文', [['注文', 'ちゅうもん']])]
  assert.equal(quizReadingLeak(s, ['チュウモン', 'しゅうもん']), true)
  assert.equal(quizReadingLeak(s, ['（ちゅうもん）', 'x']), true)
})

test('quizReadingLeak: 送り仮名까지 포함한 조각 읽기·여러 조각 복합어도 잡는다', () => {
  assert.equal(quizReadingLeak([seg('食べる', [['食', 'た'], ['べる', null]])], ['たべる', 'のむ']), true)
  assert.equal(quizReadingLeak([seg('日本', [['日本', 'にほん']]), seg('語', [['語', 'ご']])], ['にほんご', 'にっぽんご']), true)
})

test('quizReadingLeak: 평소 문제(한자 섞인 보기·한국어 보기·조사 고르기)는 가리지 않는다', () => {
  const s = [seg('コーヒー'), seg('（　）'), seg('注文', [['注文', 'ちゅうもん']]), seg('します')]
  assert.equal(quizReadingLeak(s, ['を', 'が', 'に', 'で']), false)
  assert.equal(quizReadingLeak(s, ['注文します', '頼みます']), false)
  assert.equal(quizReadingLeak(s, ['주문합니다', '부탁합니다']), false)
})

test('quizReadingLeak: 한자 없는 문장·빈 보기는 가리지 않는다', () => {
  assert.equal(quizReadingLeak([seg('すみません')], ['すみません', 'ください']), false)
  assert.equal(quizReadingLeak([seg('注文', [['注文', 'ちゅうもん']])], []), false)
  assert.equal(quizReadingLeak([seg('注文', [['注文', 'ちゅうもん']])], ['', '  ']), false)
})

/* ── 단어 루비(저장 읽기 정렬)·불일치 숨김(§15-2 E) ───────────────────────── */

test('alignWordRuby: 한자 묶음 위에만 읽기, 送り仮名는 그냥 글자', () => {
  assert.deepEqual(alignWordRuby('食べる', 'たべる'), [
    { text: '食', reading: 'た' },
    { text: 'べる', reading: null },
  ])
  assert.deepEqual(alignWordRuby('明日', 'あす'), [{ text: '明日', reading: 'あす' }])
})

test('alignWordRuby: 한자 없음·표제어 상한 초과는 null(루비 없이 표제어만)', () => {
  assert.equal(alignWordRuby('すみません', 'すみません'), null)
  assert.equal(alignWordRuby('漢'.repeat(WORD_RUBY_MAX_SURFACE + 1), 'かん'.repeat(WORD_RUBY_MAX_SURFACE + 1)), null)
})

test('readingMatches: 저장 읽기(あす)와 분석 읽기(あした)가 다르면 한글을 숨긴다', () => {
  const analyzed = [seg('明日', [['明日', 'あした']])]
  assert.equal(readingMatches(analyzed, 'あす'), false)
  assert.equal(readingMatches(analyzed, 'あした'), true)
  assert.equal(readingMatches(analyzed, 'アシタ'), true)
  assert.equal(readingMatches(analyzed, null), true)
})

/* ── 화면 B 경계(정적 검사) ──────────────────────────────────────────────── */

const ROOT = join(process.cwd(), 'src', 'components')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const B_FILES = [
  'lesson/LessonScreen.tsx',
  'lesson/StageUnderstand.tsx',
  'lesson/StageGrammar.tsx',
  'lesson/StageQuiz.tsx',
  'lesson/StageApply.tsx',
  'lesson/StageSpeak.tsx',
  'lesson/parts.tsx',
  'vocab/WordsScreen.tsx',
  'vocab/WordRow.tsx',
  'vocab/WordDetailSheet.tsx',
  'vocab/VocabDeck.tsx',
  'vocab/VocabCardFace.tsx',
  'settings/DisplaySettings.tsx',
]

test('화면 B: 옛 읽기 기본값 키·옛 읽기 줄·화면 변환 함수를 쓰지 않는다', () => {
  for (const f of B_FILES) {
    const src = read(f)
    assert.ok(!/readingDefault/.test(src), `${f}: readingDefault`)
    assert.ok(!/CHAT_KEYS/.test(src), `${f}: chat storage key`)
    assert.ok(!/\b(kanaToHangul|pronLine)\s*\(/.test(src), `${f}: 화면 변환 함수`)
    // 수업 옛 히라가나 줄(모범 답안·예문·대화 `d.reading`). 단어 카드의 저장 읽기 `card.reading`(루비 원천·뒷면)은 해당 없음.
    assert.ok(!/(modelReading|exampleReading|\bd\.reading)\b/.test(src), `${f}: 옛 히라가나 줄`)
    assert.ok(!/후리가나/.test(src), `${f}: 화면 글자 '후리가나'`)
  }
})

test('화면 B: 도구 줄 키 — ① 히라가나·한글·번역, ②·③·단어장 히라가나·한글', () => {
  assert.match(read('lesson/StageUnderstand.tsx'), /LessonDisplayTools keys=\{\['fu', 'hg', 'tr'\]\}/)
  assert.match(read('lesson/StageGrammar.tsx'), /LessonDisplayTools keys=\{\['fu', 'hg'\]\}/)
  assert.match(read('lesson/StageQuiz.tsx'), /LessonDisplayTools keys=\{\['fu', 'hg'\]\}/)
  assert.match(read('vocab/WordsScreen.tsx'), /DisplayToggles keys=\{\['fu', 'hg'\]\}/)
})

/* ── REV-095 M-1: ③ 가림 배선 ───────────────────────────────────────────── */

test('quizPromptLayerState: 답하기 전 + 분석 끝 + 읽기 누설 = 숨김(off), 답한 뒤·분석 전·평소 문제는 그대로', () => {
  const ready = { s: 'ready' as const, segments: [seg('「'), seg('注文', [['注文', 'ちゅうもん']]), seg('」')] }
  const kana = ['ちゅうもん', 'ちゅもん', 'ちゅうもう', 'しゅうもん']
  assert.equal(quizPromptLayerState(false, ready, kana).s, 'off')
  assert.equal(quizPromptLayerState(true, ready, kana), ready, '답한 뒤 표시')
  assert.equal(quizPromptLayerState(false, { s: 'loading' }, kana).s, 'loading', '분석 전 막대')
  assert.equal(quizPromptLayerState(false, ready, ['注文', '住文', '注問', '駐文']), ready, '한자 보기는 영향 없음')
  assert.equal(quizPromptLayerState(false, ready, ['주문', '시간', '사람', '음식']), ready, '한국어 보기')
})

test('StageQuiz 정적: 문제 문장 층은 quizPromptLayerState 로만 정하고 그 값을 JaText·HangulLine 에 넘긴다', () => {
  const src = read('lesson/StageQuiz.tsx')
  assert.match(src, /const promptState = quizPromptLayerState\(answered, promptAnn, q\.choices\)/)
  assert.match(src, /<JaText text=\{qp\.ja\} state=\{promptState\}/)
  assert.match(src, /<HangulLine state=\{promptState\}/)
  assert.ok(!/quizReadingLeak/.test(src), '화면이 직접 판정하지 않는다')
})
