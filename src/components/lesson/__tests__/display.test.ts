import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReadingSegment } from '@/modules/speech/reading/client'
import { alignWordRuby, WORD_RUBY_MAX_SURFACE } from '@/modules/speech/reading/client'
import { readingMatches } from '@/components/common/japanese/annotations'

/** 조각 하나 — `ruby` 는 [표기, 읽기|null] 묶음(이으면 surface). */
const seg = (surface: string, ruby: Array<[string, string | null]> | null = null): ReadingSegment => ({ surface, ruby, pron: null, boundary: null })

// ③ 읽기 문제 보호(task-026 — `quizReadingLeak`·`quizPromptLayerState`) 시험은 «문제» 단계가 «조각» 으로 바뀌며 지웠다(task-081 §37-13 ⑥).

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
  'lesson/StageChunk.tsx',
  'lesson/ChunkSentence.tsx',
  'lesson/PieceCollect.tsx',
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

test('화면 B: 도구 줄 키 — ①·③ 히라가나·한글·번역, ②·단어장 히라가나·한글', () => {
  assert.match(read('lesson/StageUnderstand.tsx'), /LessonDisplayTools keys=\{\['fu', 'hg', 'tr'\]\}/)
  assert.match(read('lesson/StageGrammar.tsx'), /LessonDisplayTools keys=\{\['fu', 'hg'\]\}/)
  assert.match(read('lesson/StageChunk.tsx'), /LessonDisplayTools keys=\{\['fu', 'hg', 'tr'\]\}/)
  assert.match(read('vocab/WordsScreen.tsx'), /DisplayToggles keys=\{\['fu', 'hg'\]\}/)
})
