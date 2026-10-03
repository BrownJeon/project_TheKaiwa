import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { U3 } from '../lessonCopy'
import { quizPromptView, quizSummaryPrompt } from '../logic'

// task-025b D9 — promptKo 에 한글이 없으면(일본어만) 한국어 질문으로 인정하지 않고 일본어 문장으로 내린다(데모 v1 `#rules` 6종).

const JA_SENTENCE = 'ホットとアイス、どちらになさいますか。'
const JA_INSTRUCTION = '次の文の意味を選んでください。'
const JA_QUOTED = '「持ち帰り」の意味はどれですか。'

test('문제 머리: 한글 있는 promptKo 는 한국어 질문 — 한글 속 일본어 인용·한글 섞인 문자열도 그대로', () => {
  assert.deepEqual(quizPromptView({ promptKo: '점원이 이렇게 물었어요. 무엇을 고르라는 걸까요?', promptJa: JA_SENTENCE }), {
    ko: '점원이 이렇게 물었어요. 무엇을 고르라는 걸까요?',
    ja: JA_SENTENCE,
    legacy: false,
  })
  assert.deepEqual(quizPromptView({ promptKo: '「持ち帰り」의 뜻으로 알맞은 것은?', promptJa: null }), { ko: '「持ち帰り」의 뜻으로 알맞은 것은?', ja: null, legacy: false })
  assert.deepEqual(quizPromptView({ promptKo: `${JA_INSTRUCTION} 뜻은?`, promptJa: JA_SENTENCE }), { ko: `${JA_INSTRUCTION} 뜻은?`, ja: JA_SENTENCE, legacy: false }, '한글이 한 글자라도 섞이면 한국어 질문')
})

test('문제 머리: 한글 판정은 자모·호환 자모·음절 세 범위(matching.ts 와 같은 범위)', () => {
  for (const ko of ['뭐?', 'ㅇㅇ', '한?', 'A: 한']) {
    assert.equal(quizPromptView({ promptKo: ko, promptJa: null }).legacy, false, ko)
    assert.equal(quizSummaryPrompt({ promptKo: ko, promptJa: JA_SENTENCE }).text, ko, ko)
  }
})

test('문제 머리: 일본어만 담긴 promptKo + promptJa 있음 → 공통 안내 줄, 일본어 줄은 promptJa(지시문은 안내 줄이 대신)', () => {
  assert.deepEqual(quizPromptView({ promptKo: JA_INSTRUCTION, promptJa: JA_SENTENCE }), { ko: U3.legacyPrompt, ja: JA_SENTENCE, legacy: true })
})

test('문제 머리: 일본어만 담긴 promptKo + promptJa 없음(null·빈·공백) → 그 일본어를 버리지 않고 일본어 줄로', () => {
  assert.deepEqual(quizPromptView({ promptKo: JA_QUOTED, promptJa: null }), { ko: U3.legacyPrompt, ja: JA_QUOTED, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: JA_QUOTED, promptJa: '' }), { ko: U3.legacyPrompt, ja: JA_QUOTED, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: JA_QUOTED, promptJa: '   ' }), { ko: U3.legacyPrompt, ja: JA_QUOTED, legacy: true })
})

test('문제 머리: 빈·공백 promptKo — promptJa 있으면 그것, 없으면 일본어 줄 없음', () => {
  assert.deepEqual(quizPromptView({ promptKo: null, promptJa: JA_SENTENCE }), { ko: U3.legacyPrompt, ja: JA_SENTENCE, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: '', promptJa: JA_SENTENCE }), { ko: U3.legacyPrompt, ja: JA_SENTENCE, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: ' \n ', promptJa: JA_SENTENCE }), { ko: U3.legacyPrompt, ja: JA_SENTENCE, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: '', promptJa: null }), { ko: U3.legacyPrompt, ja: null, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: '  ', promptJa: '  ' }), { ko: U3.legacyPrompt, ja: null, legacy: true })
})

test('문제 머리: 한글도 일본어도 없는 promptKo 는 일본어 줄로 내리지 않는다(기호·영문)', () => {
  assert.deepEqual(quizPromptView({ promptKo: '???', promptJa: null }), { ko: U3.legacyPrompt, ja: null, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: 'Which one?', promptJa: JA_SENTENCE }), { ko: U3.legacyPrompt, ja: JA_SENTENCE, legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: 'Which one?', promptJa: null }), { ko: U3.legacyPrompt, ja: null, legacy: true })
})

test('결과 목록 한 줄: 한글 promptKo → promptJa → 일본어뿐인 promptKo → 공통 안내 줄', () => {
  assert.deepEqual(quizSummaryPrompt({ promptKo: '「持ち帰り」의 뜻으로 알맞은 것은?', promptJa: JA_SENTENCE }), { text: '「持ち帰り」의 뜻으로 알맞은 것은?', ja: false })
  assert.deepEqual(quizSummaryPrompt({ promptKo: JA_INSTRUCTION, promptJa: JA_SENTENCE }), { text: JA_SENTENCE, ja: true })
  assert.deepEqual(quizSummaryPrompt({ promptKo: JA_QUOTED, promptJa: null }), { text: JA_QUOTED, ja: true })
  assert.deepEqual(quizSummaryPrompt({ promptKo: JA_QUOTED, promptJa: '  ' }), { text: JA_QUOTED, ja: true })
  assert.deepEqual(quizSummaryPrompt({ promptKo: '  ', promptJa: JA_SENTENCE }), { text: JA_SENTENCE, ja: true })
  assert.deepEqual(quizSummaryPrompt({ promptKo: '???', promptJa: null }), { text: U3.legacyPrompt, ja: false })
  assert.deepEqual(quizSummaryPrompt({ promptKo: '', promptJa: '' }), { text: U3.legacyPrompt, ja: false })
})

test('안내 노트 문구(사용자 결정 B) — 옛·새 수업 모두 사실인 중립 문구', () => {
  assert.equal(U3.legacyNote, '이 문제에는 한국어 설명이 없어요.')
})

test('종료 카드 "오늘로" 링크: 스크롤 영역 안에서 찌그러지지 않게 shrink-0(390×780 에서 20px 로 줄던 결함)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/lesson/LessonEnd.tsx'), 'utf8')
  const m = /<Link href="\/study\/today" className="([^"]*)"/.exec(src)
  assert.ok(m, '"오늘로" 링크를 찾을 수 없다')
  const cls = m[1].split(/\s+/)
  assert.ok(cls.includes('h-11'), 'h-11 유지')
  assert.ok(cls.includes('shrink-0'), 'shrink-0 필요')
})
