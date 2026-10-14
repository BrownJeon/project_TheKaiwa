/**
 * task-068 §28-9 T18·T19·T20 — 추가·수정 폼의 「수준」 → 「조각」(D5 A · 초안 뒤 A). 순수 검사 + `renderToStaticMarkup`.
 * 공용 `Sheet` 가 포털이라 `WordAddSheet` 배선(초안 안내 지우기·`presetChunk`)은 소스 스캔으로 보고, 실제 누름은 QA Q8.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WORD_CHUNK_TYPES, type WordEntry } from '@/types/vocab'
import { CHUNK_DEF, CHUNK_PICK_DRAFT, CHUNK_PICK_HINT, CHUNK_PICK_REQUIRED } from '../labels'
import { diffPatch, emptyForm, FIELD_ORDER, fieldOf, firstErrorField, formFromDraft, formFromWord, toCreateBody, validateWord } from '../validate'
import WordChunkPicker from '../WordChunkPicker'
import WordForm from '../WordForm'

const noop = () => {}
const decode = (html: string) => html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
const src = (f: string) => readFileSync(join(process.cwd(), 'src/components/vocab', f), 'utf8')

const mine: WordEntry = {
  id: 'w_m',
  surface: '映画',
  reading: 'えいが',
  meaning: '영화',
  partOfSpeech: 'NOUN',
  chunkType: 'NAME',
  jlpt: 'N5',
  category: null,
  source: 'MANUAL',
  origin: 'MINE',
  readOnly: false,
  correctCount: 0,
  wrongCount: 0,
  archived: false,
}

// ── T18 검사 · 저장 본문 ─────────────────────────────────────────────────────────

test('T18 조각을 안 고르면 「조각을 골라 주세요」 — 추가·수정 모두, 칸 순서는 품사 다음', () => {
  const v = { ...emptyForm('映画'), meaning: '영화' }
  assert.equal(validateWord(v).chunkType, CHUNK_PICK_REQUIRED)
  assert.equal(CHUNK_PICK_REQUIRED, '조각을 골라 주세요')
  assert.deepEqual(validateWord({ ...v, chunkType: 'EXPRESSION' }), {})
  // 옛 조각 없는 내 단어를 고칠 때도 조각을 골라야 저장된다(§28-4 C).
  assert.equal(validateWord(formFromWord({ ...mine, chunkType: null })).chunkType, CHUNK_PICK_REQUIRED)
  assert.equal(FIELD_ORDER[FIELD_ORDER.indexOf('partOfSpeech') + 1], 'chunkType')
  assert.equal((FIELD_ORDER as readonly string[]).includes('jlpt'), false)
  assert.equal(firstErrorField({ chunkType: 'x', category: 'y' }), 'chunkType')
  assert.equal(firstErrorField({ chunkType: 'x', meaning: 'y' }), 'meaning', '위 칸이 먼저')
  assert.equal(fieldOf('chunkType'), 'chunkType')
  assert.equal(fieldOf('jlpt'), null)
})

test('T18 toCreateBody 에 chunkType 이 있고 jlpt 키는 없다 · diffPatch 는 어떤 입력에도 jlpt 를 내지 않는다', () => {
  const body = toCreateBody({ ...emptyForm('勉強'), meaning: '공부', chunkType: 'ACTION' })
  assert.equal(body.chunkType, 'ACTION')
  assert.equal('jlpt' in body, false)
  // 옛 수준 값이 있는 단어를 그대로 / 조각만 / 전부 바꿔도 jlpt 는 본문에 없다.
  assert.deepEqual(diffPatch(mine, formFromWord(mine)), {})
  assert.deepEqual(diffPatch(mine, { ...formFromWord(mine), chunkType: 'EXPRESSION' }), { chunkType: 'EXPRESSION' })
  const all = diffPatch({ ...mine, jlpt: 'N1' }, { ...formFromWord(mine), surface: '映画館', reading: '', meaning: '영화관', chunkType: 'FEELING', category: '여행' })
  assert.equal('jlpt' in all, false)
  // 조각이 빈 옛 단어 → 고르면 그 값.
  assert.deepEqual(diffPatch({ ...mine, chunkType: null }, { ...formFromWord(mine), chunkType: 'NAME' }), { chunkType: 'NAME' })
})

// ── T20 초안 조각 ───────────────────────────────────────────────────────────────

test('T20 formFromDraft: 초안 조각 우선 → 없으면 미리 고른 조각 → 둘 다 없으면 빈 값, 초안 jlpt 는 쓰지 않는다', () => {
  assert.equal(formFromDraft('勉強', { valid: true, meaning: '공부', chunkType: 'ACTION', jlpt: 'N5' }, '', 'NAME').chunkType, 'ACTION')
  assert.equal(formFromDraft('勉強', { valid: true, meaning: '공부' }, '', 'NAME').chunkType, 'NAME')
  assert.equal(formFromDraft('勉強', { valid: true, meaning: '공부', chunkType: null }, '').chunkType, '')
  assert.equal('jlpt' in formFromDraft('勉強', { valid: true, meaning: '공부', jlpt: 'N5' }, ''), false)
  assert.equal(emptyForm('映', '', 'MODIFIER').chunkType, 'MODIFIER', 'J6 미리 고름')
})

test('T20 WordAddSheet 배선: 초안이 고르면 안내, 칩을 바꾸면 안내를 지움, 직접 입력은 안내 없음, presetChunk 를 폼에 넣음', () => {
  const s = src('WordAddSheet.tsx')
  assert.match(s, /setChunkNote\(d\.chunkType \? CHUNK_PICK_DRAFT : null\)/)
  assert.match(s, /if \(k === 'chunkType'\) setChunkNote\(null\)/)
  assert.match(s, /formFromDraft\(surface, d, form\.category, form\.chunkType\)/)
  assert.match(s, /emptyForm\(presetSurface \?\? '', defaultCategory \?\? '', presetChunk \?\? ''\)/)
  assert.match(s, /chunkNote=\{chunkNote\}/)
  assert.equal(CHUNK_PICK_DRAFT, '선생님이 고른 조각이에요 · 바꿀 수 있어요')
})

// ── T19 렌더 ───────────────────────────────────────────────────────────────────

function form(values = emptyForm('映画'), errors = {}, chunkNote: string | null = null): string {
  return decode(
    renderToStaticMarkup(
      createElement(WordForm, { values, errors, onChange: noop, categories: [], expandExtras: false, onToggleExtras: noop, idPrefix: 'wadd', chunkNote }),
    ),
  )
}

test('T19 WordForm: 「수준」 칸 없음 · 조각 라디오 묶음 하나(필수) · 칩 5개 순서 · 첫 칩 id', () => {
  const html = form()
  assert.equal(html.includes('수준'), false)
  assert.equal(html.includes('선택 안 함'), false)
  assert.equal((html.match(/<select/g) ?? []).length, 1, '품사 select 하나만')
  assert.equal((html.match(/role="radiogroup"/g) ?? []).length, 1)
  assert.ok(html.includes('aria-required="true"'))
  assert.ok(html.includes('aria-labelledby="wadd_chunkType_label"') && html.includes('id="wadd_chunkType_label"'))
  const chips = [...html.matchAll(/<button type="button" role="radio"[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])
  assert.deepEqual(chips, ['이름', '액션', '느낌', '꾸밈', '표현'])
  assert.equal(WORD_CHUNK_TYPES.length, 5)
  assert.ok(html.includes('id="wadd_chunkType"'), '첫 칩이 초점 받는 id')
  assert.equal((html.match(/id="wadd_chunkType"/g) ?? []).length, 1)
  assert.ok(html.includes(CHUNK_PICK_HINT), '고르기 전 안내')
  assert.ok(html.includes('aria-describedby="wadd_chunkType_hint"'))
  // 줄바꿈(가로 밀기 아님) — 360 에서도 다섯 개가 다 보인다.
  assert.ok(/role="radiogroup"[^>]*class="[^"]*flex-wrap/.test(html))
  assert.equal(/role="radiogroup"[^>]*class="[^"]*overflow-x-auto/.test(html), false)
})

test('T19 고르면 뜻 한 줄(일본어 예는 lang="ja") · 오류면 aria-invalid + 오류 줄 + 빨간 테두리', () => {
  const picked = form({ ...emptyForm('はじめまして'), chunkType: 'EXPRESSION' })
  assert.ok(picked.includes(`<b class="font-semibold text-ink">표현</b> — ${CHUNK_DEF.EXPRESSION.def}`))
  assert.ok(picked.includes(`<span lang="ja">${CHUNK_DEF.EXPRESSION.ex}</span>`))
  assert.ok(picked.includes('aria-checked="true"'))
  assert.equal((picked.match(/aria-checked="true"/g) ?? []).length, 1)
  assert.equal(picked.includes(CHUNK_PICK_HINT), false)

  const err = form(emptyForm('映画'), { chunkType: CHUNK_PICK_REQUIRED })
  assert.ok(err.includes('aria-invalid="true"') && err.includes('aria-describedby="wadd_chunkType_err"'))
  assert.ok(err.includes(`id="wadd_chunkType_err" role="alert"`) && err.includes(CHUNK_PICK_REQUIRED))
  assert.ok(err.includes('border-bad bg-surface'))
  assert.equal(err.includes(CHUNK_PICK_HINT), false)
})

test('T20 렌더: 초안 안내는 note 가 있을 때만(accent-soft 상자)', () => {
  const withNote = form({ ...emptyForm('勉強'), chunkType: 'ACTION' }, {}, CHUNK_PICK_DRAFT)
  assert.ok(withNote.includes(CHUNK_PICK_DRAFT) && withNote.includes('bg-accent-soft'))
  assert.equal(form({ ...emptyForm('勉強'), chunkType: 'ACTION' }).includes(CHUNK_PICK_DRAFT), false)
  const direct = renderToStaticMarkup(createElement(WordChunkPicker, { value: '', idPrefix: 'p', onChange: noop }))
  assert.equal(direct.includes(CHUNK_PICK_DRAFT), false)
})
