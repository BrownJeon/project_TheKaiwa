/**
 * task-068 §28-9 T22·T23 + D9(§28-4 E) — 기본 단어(읽기 전용)·내 단어 상세와 목록 행, 기본 단어 중복 안내.
 * 상세 시트는 공용 `Sheet`(포털)라 서버 렌더가 안 되므로 훅 없는 부품(`DetailActions`·`DetailSource`·`DetailOriginBadge`)과
 * 순수 판정(`isReadOnlyWord`·`archiveToastText`·`duplicateOf`)을 시험하고, 시트 안 배선은 소스 스캔 + QA Q6·Q7.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WordEntry } from '@/types/vocab'
import {
  BASE_ARCHIVE_BTN,
  BASE_ARCHIVED_TOAST,
  BASE_DUPLICATE_HINT,
  BASE_DUPLICATE_TEXT,
  BASE_SOURCE_SENTENCE,
  BASE_UNARCHIVE_BTN,
  BASE_UNARCHIVED_TOAST,
  DUPLICATE_TEXT,
  SOURCE_SENTENCE,
} from '../labels'
import { archiveToastText, duplicateOf, isReadOnlyWord } from '../validate'
import { WordDuplicateNote } from '../WordAddSheet'
import { DetailActions, DetailOriginBadge, DetailSource } from '../WordDetailSheet'
import WordRow from '../WordRow'

const noop = () => {}
const decode = (html: string) => html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
const html = (el: ReturnType<typeof createElement>) => decode(renderToStaticMarkup(el))
const buttons = (h: string) => [...h.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
const src = (f: string) => readFileSync(join(process.cwd(), 'src/components/vocab', f), 'utf8')

const base: WordEntry = {
  id: 'w_b',
  surface: '映画',
  reading: 'えいが',
  meaning: '영화',
  partOfSpeech: 'NOUN',
  chunkType: 'NAME',
  jlpt: 'N5',
  category: '초보자 (N5)',
  source: 'SEED',
  origin: 'BASE',
  readOnly: true,
  correctCount: 0,
  wrongCount: 0,
  archived: false,
  createdAt: '2026-10-14T00:00:00.000Z',
}
const mine: WordEntry = { ...base, id: 'w_m', surface: '推し', source: 'MANUAL', origin: 'MINE', readOnly: false, jlpt: null, category: null, chunkType: 'EXPRESSION' }

// ── 판정 ───────────────────────────────────────────────────────────────────────

test('T22 isReadOnlyWord: 응답 값(origin·readOnly)만 본다 — source 가 SEED 여도 내 단어면 고칠 수 있다', () => {
  assert.equal(isReadOnlyWord(base), true)
  assert.equal(isReadOnlyWord({ readOnly: true }), true, 'readOnly 만 있어도 기본 단어')
  assert.equal(isReadOnlyWord({ origin: 'BASE' }), true, 'origin 만 있어도 기본 단어')
  assert.equal(isReadOnlyWord(mine), false)
  assert.equal(isReadOnlyWord({ ...mine, source: 'SEED' } as WordEntry), false, '옛 사본(내 단어 + SEED)')
  assert.equal(isReadOnlyWord({}), false, '옛 응답 = 내 단어로 본다')
})

test('보관 토스트: 기본 단어는 「나에게만」, 내 단어는 지금 문구 그대로', () => {
  assert.equal(archiveToastText(true, true), BASE_ARCHIVED_TOAST)
  assert.equal(archiveToastText(true, false), BASE_UNARCHIVED_TOAST)
  assert.equal(archiveToastText(false, true), '보관했어요 · 오늘의 단어에 나오지 않아요')
  assert.equal(archiveToastText(false, false), '보관을 풀었어요 · 오늘의 단어에 다시 나와요')
})

// ── T22 상세 부품 렌더 ─────────────────────────────────────────────────────────

const actions = (readOnly: boolean, archived = false) =>
  html(createElement(DetailActions, { readOnly, archived, busy: false, onEdit: noop, onArchive: noop, onDelete: noop }))

test('T22 기본 단어 상세: [수정]·[삭제] 없음 · 보관 단추 하나(보관이면 풀기) · 「기본 단어」 뱃지 · 출처 문장 · 「추가한 날」 없음', () => {
  assert.deepEqual(buttons(actions(true)), [BASE_ARCHIVE_BTN])
  assert.deepEqual(buttons(actions(true, true)), [BASE_UNARCHIVE_BTN])
  for (const h of [actions(true), actions(true, true)]) {
    assert.equal(/>수정</.test(h) || />삭제</.test(h), false)
    assert.ok(h.includes('w-full'))
  }
  const badge = html(createElement(DetailOriginBadge, { readOnly: true }))
  assert.ok(badge.includes('>기본 단어<') && badge.includes('ring-line') && badge.includes('text-ink2'))
  const s = html(createElement(DetailSource, { w: base, readOnly: true }))
  assert.ok(s.includes(BASE_SOURCE_SENTENCE))
  assert.equal(s.includes('추가한 날'), false)
  assert.equal(s.includes(SOURCE_SENTENCE.SEED), false)
  assert.equal(s.includes('나만 봐요'), false)
})

test('T22 내 단어 상세: [수정][보관하기] + [삭제] · 「내 단어」 뱃지 · 「내가 넣은 단어예요 · 나만 봐요」 · 추가한 날', () => {
  assert.deepEqual(buttons(actions(false)), ['수정', '보관하기', '삭제'])
  assert.deepEqual(buttons(actions(false, true)), ['수정', '보관 풀기', '삭제'])
  const badge = html(createElement(DetailOriginBadge, { readOnly: false }))
  assert.ok(badge.includes('>내 단어<') && badge.includes('bg-accent-soft'))
  const s = html(createElement(DetailSource, { w: mine, readOnly: false }))
  assert.ok(s.includes('내가 넣은 단어예요 · 나만 봐요'))
  assert.ok(s.includes('추가한 날'))
  const fromCorr = html(createElement(DetailSource, { w: { ...mine, source: 'CORRECTION' }, readOnly: false, correction: { id: 'cr_1', chatId: 'c_1' } }))
  assert.ok(fromCorr.includes(`${SOURCE_SENTENCE.CORRECTION} · 나만 봐요`) && fromCorr.includes('점검 결과 보기'))
})

test('T22 시트 배선(소스): 판정은 isReadOnlyWord 하나 · 기본 단어는 수정 열기를 막음 · 단추·출처는 부품으로', () => {
  const s = src('WordDetailSheet.tsx')
  assert.match(s, /const readOnly = isReadOnlyWord\(w\)/)
  assert.match(s, /const startEdit = \(\) => \{\n\s+if \(readOnly\) return/)
  assert.match(s, /<DetailActions\n\s+readOnly=\{readOnly\}/)
  assert.match(s, /<DetailSource w=\{w\} readOnly=\{readOnly\}/)
  assert.match(s, /onToast\(archiveToastText\(readOnly, next\.archived\)\)/)
  assert.equal(/source === 'SEED'/.test(s), false, 'source 로 판정하지 않는다')
})

// ── T23 목록 행 ────────────────────────────────────────────────────────────────

const row = (w: WordEntry) => html(createElement(WordRow, { word: w, sort: 'recent', onOpen: noop, ruby: null, hangul: { s: 'off' } }))

test('T23 행: 내 단어는 「내 단어」 뱃지(accent-soft·ink, accent 글자 아님) · 기본 단어는 출처 뱃지 없음 · 표현 조각 · 조각 없으면 조각 뱃지 없음', () => {
  const m = row(mine)
  const mineBadge = m.match(/<span class="([^"]*)">내 단어<\/span>/)
  assert.ok(mineBadge, '「내 단어」 뱃지')
  assert.ok(mineBadge![1].includes('bg-accent-soft') && mineBadge![1].includes('text-ink'))
  assert.equal(/\btext-accent\b/.test(mineBadge![1]), false)
  assert.ok(m.indexOf('>내 단어<') < m.indexOf('>표현 조각<'), '조각 뱃지 왼쪽')
  const b = row(base)
  assert.equal(b.includes('내 단어') || b.includes('기본 단어'), false)
  assert.ok(b.includes('>이름 조각<'))
  assert.equal(row({ ...mine, chunkType: null }).includes('조각'), false)
  assert.equal(row({ ...base, origin: undefined, readOnly: undefined }).includes('내 단어'), false, '옛 응답 행에는 출처 뱃지 없음')
})

// ── D9 기본 단어 중복 ───────────────────────────────────────────────────────────

test('D9 duplicateOf: BASE_DUPLICATE 는 base, 코드 없으면 내 단어 중복, existingId 없으면 중복 안내 아님', () => {
  assert.deepEqual(duplicateOf({ status: 409, details: { code: 'BASE_DUPLICATE', existingId: 'w_b' } }), { id: 'w_b', base: true })
  assert.deepEqual(duplicateOf({ status: 409, details: { existingId: 'w_m' } }), { id: 'w_m', base: false })
  assert.equal(duplicateOf({ status: 409, details: { code: 'BASE_DUPLICATE' } }), null)
  assert.equal(duplicateOf({ status: 400, details: { existingId: 'w_b' } }), null)
  assert.equal(duplicateOf({ status: 409 }), null)
})

test('D9 안내 렌더: 기본 단어 = 「기본 단어에 이미 있어요」 + [그 단어 보기] + 설명 · 내 단어 = 지금 문구', () => {
  const b = html(createElement(WordDuplicateNote, { id: 'x', dup: { id: 'w_b', base: true }, onOpenWord: noop }))
  assert.ok(b.includes(BASE_DUPLICATE_TEXT) && b.includes(BASE_DUPLICATE_HINT) && b.includes('role="alert"') && b.includes('id="x"'))
  assert.deepEqual(buttons(b), ['그 단어 보기'])
  assert.equal(b.includes(DUPLICATE_TEXT), false)
  const m = html(createElement(WordDuplicateNote, { id: 'y', dup: { id: 'w_m', base: false }, onOpenWord: noop }))
  assert.ok(m.includes(DUPLICATE_TEXT) && !m.includes(BASE_DUPLICATE_TEXT))
})

test('D9 배선(소스): 추가·수정의 409 는 duplicateOf 로 가르고 표현 칸이 안내를 가리킨다', () => {
  const add = src('WordAddSheet.tsx')
  assert.equal((add.match(/const d = duplicateOf\(err\)/g) ?? []).length, 2, '[뜻 채우기]·[저장]')
  assert.match(add, /<WordDuplicateNote id=\{`\$\{ID\}_surface_err`\} dup=\{dup\}/)
  assert.match(add, /surfaceNoteId=\{dup \? `\$\{ID\}_dup` : undefined\}/)
  const det = src('WordDetailSheet.tsx')
  assert.match(det, /const d = duplicateOf\(err\)/)
  assert.match(det, /surfaceNoteId=\{dup \? `\$\{ID\}_dup` : undefined\}/)
  assert.equal(/detailString\(err, 'existingId'\)/.test(add + det), false)
})
