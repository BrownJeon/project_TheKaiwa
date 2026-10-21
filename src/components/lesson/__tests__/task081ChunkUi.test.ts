/**
 * task-081 화면 갈래 ③b — ③ 조각 단계 부품(`StageChunk`·`ChunkSentence`·`PieceCollect`)의 서버 렌더 DOM(screens §37-3·37-4·37-7·37-10).
 * 칸 버튼 수·`aria-pressed`·빗금/문장부호 `aria-hidden`·카드 머리 `aria-live` 고정 요소·재생 `role="status"` 한 개·소리 없음 ▶ 0개·옛 수업 빈 상태·
 * 조각 없는 줄(⑦)·모아 보기 접힘/종류 순서/한 번만 + «문제» 화면 제거 배선.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import type { DialogueLine, DialoguePiece, LessonContent, LessonDto, LessonProgress } from '@/types/lesson'
import { collectPieces, phraseKey, pieceKey } from '../chunkLogic'
import { ChunkEmpty, ChunkSentenceCard, PieceTiles, tileUnits, usablePieces } from '../ChunkSentence'
import { U3 } from '../lessonCopy'
import PieceCollect, { PieceCollectList } from '../PieceCollect'
import StageChunk, { firstChunkLine } from '../StageChunk'
import { patchOf, type Section, type UseLesson } from '../useLesson'
import type { LessonPlayback } from '../useLessonPlayback'

const count = (html: string, needle: string | RegExp) => (typeof needle === 'string' ? html.split(needle).length - 1 : (html.match(new RegExp(needle, 'g')) ?? []).length)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const P = (ja: string, type: DialoguePiece['type'], ko: string | null, slash = false): DialoguePiece => (slash ? { ja, type, ko, slash: true } : { ja, type, ko })

const L0: DialogueLine = {
  speaker: 'A',
  ja: 'あたたかいコーヒーをひとつください。',
  reading: '',
  ko: '따뜻한 커피를 하나 주세요.',
  segment: 1,
  pieces: [P('あたたかい', 'FEELING', '따뜻한'), P('コーヒー', 'NAME', '커피'), P('を', 'LINK', '~을', true), P('ひとつ', 'MODIFIER', '하나'), P('ください', 'ACTION', '주세요'), P('。', null, null)],
}
const L1: DialogueLine = { speaker: 'B', ja: 'はい、どうぞ。', reading: '', ko: '네, 여기요.', segment: 1, pieces: [P('はい', 'EXPRESSION', '네'), P('、', null, null, true), P('どうぞ', 'EXPRESSION', '여기요'), P('。', null, null)] }
const L2: DialogueLine = { speaker: 'A', ja: 'コーヒーをください。', reading: '', ko: '커피를 주세요.', segment: 2, pieces: null }
const L3: DialogueLine = { speaker: 'B', ja: 'はい。', reading: '', ko: '네.', segment: 2, pieces: [P('はい', 'EXPRESSION', '네'), P('。', null, null)] }

const contentOf = (dialogue: DialogueLine[]) =>
  ({
    v: 1,
    title: 'カフェで注文',
    titleKo: '카페에서 주문',
    rolesKo: { A: '손님', B: '점원' },
    dialogue,
    segmentCount: 2,
    chunks: [],
    grammar: [],
    quiz: [],
    application: [],
    speaking: [],
    nextPreview: null,
  }) as unknown as LessonContent

const lessonOf = (dialogue: DialogueLine[], progress: LessonProgress = {}): LessonDto & { content: LessonContent } =>
  ({
    id: 'L1',
    kind: 'NEW',
    date: '2026-10-21',
    title: 'カフェで注文',
    titleKo: '카페에서 주문',
    level: 'N4',
    status: 'IN_PROGRESS',
    stageDone: 2,
    progress,
    score: null,
    source: 'TOPIC',
    topic: { id: 't1', title: '카페 주문' },
    content: contentOf(dialogue),
    jobId: null,
    error: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
    completedAt: null,
  }) as unknown as LessonDto & { content: LessonContent }

const pbOf = (o: { textOnly?: boolean; activeKey?: string } = {}) =>
  ({
    textOnly: o.textOnly ?? false,
    active: (k: string) => k === o.activeKey,
    loading: () => false,
    lineOf: () => null,
    blocked: false,
    snapshot: { phase: 'idle', messageId: null, chunkIndex: null },
    stop: () => {},
    playLines: () => {},
    playMine: () => {},
    resume: () => {},
  }) as unknown as LessonPlayback
const ST = { update: () => {} } as unknown as UseLesson
const OFF: AnnotationState = { s: 'off' }
const FOOTER = createElement('button', { type: 'button' }, 'FOOTER-NEXT')

const card = (line: DialogueLine, sel: number | null, pb = pbOf(), lineIdx = 0) =>
  renderToStaticMarkup(createElement(ChunkSentenceCard, { lineIdx, line, roleKo: '손님', ann: OFF, sel, onPick: () => {}, pb, textOnly: pb.textOnly }))
const stage = (dialogue: DialogueLine[], progress: LessonProgress = {}, reviewing = false, pb = pbOf()) =>
  renderToStaticMarkup(createElement(StageChunk, { lesson: lessonOf(dialogue, progress), st: ST, pb, reviewing, onToast: () => {}, footer: FOOTER }))

/* ── 칸 묶음 ─────────────────────────────────────────────────────────────── */

test('tileUnits: 구간(slash 뒤)마다 묶고, 문장부호는 앞 칸 꼬리에·앞머리 문장부호는 다음 칸에 붙는다', () => {
  assert.deepEqual(tileUnits(L0.pieces!), [[[0], [1], [2]], [[3], [4, 5]]])
  assert.deepEqual(tileUnits(L1.pieces!), [[[0, 1]], [[2, 3]]])
  assert.deepEqual(tileUnits([P('「', null, null), P('はい', 'EXPRESSION', '네'), P('」', null, null)]), [[[0, 1, 2]]])
  assert.deepEqual(tileUnits([P('「', null, null, true), P('はい', 'EXPRESSION', '네')]), [[[0]], [[1]]])
})

test('PieceTiles: 칸 = 누를 수 있는 조각 수만큼 button(aria-pressed), 문장부호·빗금은 버튼이 아니고 aria-hidden', () => {
  const runs = L0.pieces!.map((p) => [{ text: p.ja, reading: null }])
  const html = renderToStaticMarkup(createElement(PieceTiles, { pieces: L0.pieces!, runs, showFu: false, sel: 1, onPick: () => {}, textOnly: false }))
  assert.equal(count(html, '<button'), 5)
  assert.equal(count(html, 'aria-pressed="true"'), 1)
  assert.equal(count(html, 'aria-pressed="false"'), 4)
  assert.match(html, /aria-pressed="true"[^>]*>(?:(?!<\/button>).)*コーヒー/)
  assert.ok(html.includes(`role="group" aria-label="${esc(U3.tilesAria(5))}"`))
  assert.equal(count(html, '／'), 1)
  assert.match(html, /<span aria-hidden="true"[^>]*>／<\/span>/)
  for (const b of html.split('<button').slice(1)) assert.ok(!b.split('</button>')[0].includes('。'), '문장부호는 버튼 안에 없다')
  assert.match(html, /<span aria-hidden="true" class="pointer-events-none[^"]*"><span lang="ja"[^>]*>。<\/span>/)
  assert.ok(html.includes(esc(U3.tileSrTail('커피'))), '이름표 뒤 시각 숨김 뜻')
  const t = renderToStaticMarkup(createElement(PieceTiles, { pieces: L0.pieces!, runs, showFu: false, sel: null, onPick: () => {}, textOnly: true }))
  assert.ok(t.includes(`aria-label="${esc(U3.tilesAriaTextOnly(5))}"`))
  assert.equal(count(t, 'aria-pressed="true"'), 0)
})

test('PieceTiles: 빗금은 그 앞 칸과 같은 꼬리 묶음(nowrap) 안 — 줄 머리에 오지 않는다', () => {
  const runs = L0.pieces!.map((p) => [{ text: p.ja, reading: null }])
  const html = renderToStaticMarkup(createElement(PieceTiles, { pieces: L0.pieces!, runs, showFu: false, sel: null, onPick: () => {}, textOnly: false }))
  const tail = html.slice(html.lastIndexOf('flex-nowrap', html.indexOf('>を<')), html.indexOf('／'))
  assert.ok(tail.includes('>を<'), '빗금과 「を」 칸이 같은 묶음')
  assert.ok(!tail.includes('gap-x-0.5'), '사이에 새 구간 묶음이 없다')
})

/* ── 문장 카드 ───────────────────────────────────────────────────────────── */

test('ChunkSentenceCard: 머리 aria-live 고정 요소 1개·재생 status 1개·문장 전체 sr-only(lang=ja)·줄 ▶·안내 줄', () => {
  const html = card(L0, null)
  assert.equal(count(html, 'aria-live="polite"'), 1)
  assert.match(html, new RegExp(`aria-live="polite"[^>]*>${U3.cardHead('손님', 1)}<`))
  assert.equal(count(html, 'role="status"'), 1)
  assert.ok(html.includes(`<section aria-label="${U3.cardSr(1)}"`))
  assert.match(html, /<p lang="ja" class="sr-only">あたたかいコーヒーをひとつください。<\/p>/)
  assert.ok(html.includes(`aria-label="${U3.lineAria(1)}"`))
  assert.ok(html.includes(U3.pick))
  assert.equal(count(html, '<button'), 6, '칸 5 + 줄 다시 듣기 1')
})

test('ChunkSentenceCard: 조각을 고르면 뜻·뱃지·▶ 조각·[구간 듣기 「구간」], 재생 중이면 «듣는 중»·멈추기', () => {
  const html = card(L0, 0)
  assert.ok(html.includes('느낌 조각') && html.includes('따뜻한'))
  assert.ok(html.includes(`aria-label="${U3.pieceAria}"`))
  assert.ok(html.includes(`${U3.phraseLead}<span lang="ja">あたたかいコーヒーを</span>${U3.phraseTail}`))
  assert.match(html, /role="status" class="sr-only"><\/span>/, '재생 전 status 는 빈 글')
  const playing = card(L0, 0, pbOf({ activeKey: pieceKey(0, 0) }))
  assert.match(playing, new RegExp(`role="status" class="sr-only">${U3.playingSr}</span>`))
  assert.ok(playing.includes(`aria-label="${U3.stopAria}"`))
  const ph = card(L0, 0, pbOf({ activeKey: phraseKey(0, 0) }))
  assert.ok(ph.includes(U3.phraseStop) && !ph.includes(U3.phraseLead))
})

test('ChunkSentenceCard: 구간 글이 조각 글과 같으면 [구간 듣기] 를 그리지 않는다(끝 문장부호 뺀 뒤 비교)', () => {
  const html = card(L3, 0)
  assert.ok(html.includes('표현 조각'))
  assert.ok(!html.includes(U3.phraseLead))
  assert.ok(html.includes(`aria-label="${U3.pieceAria}"`))
})

test('ChunkSentenceCard: 소리 없음이면 ▶ 0개(줄·조각·구간) — 칸 버튼만, 안내는 pickTextOnly', () => {
  const pb = pbOf({ textOnly: true })
  const idle = card(L0, null, pb)
  assert.equal(count(idle, '<button'), 5)
  assert.ok(!idle.includes(U3.lineAria(1)))
  assert.ok(idle.includes(U3.pickTextOnly))
  const picked = card(L0, 0, pb)
  assert.equal(count(picked, '<button'), 5)
  assert.ok(!picked.includes(U3.pieceAria) && !picked.includes(U3.phraseLead))
  assert.ok(picked.includes('따뜻한'), '뜻은 보인다')
})

test('ChunkSentenceCard: 조각 없는 줄(null·이은 글 ≠ 원문)은 ⑦ — 글자·알림만, 칸·aria-pressed·빗금 없음', () => {
  for (const line of [L2, { ...L0, pieces: [P('あたたかい', 'FEELING', '따뜻한'), P('コーヒー', 'NAME', '커피')] }]) {
    const html = card(line, null)
    assert.ok(html.includes(U3.noPieces))
    assert.ok(!html.includes('aria-pressed') && !html.includes('role="group"') && !html.includes('／'))
    assert.ok(html.includes(line.ja))
  }
  assert.equal(usablePieces(L2), null)
  assert.equal(usablePieces({ ja: 'あ', pieces: [] }), null)
  assert.equal(usablePieces(L0), L0.pieces)
})

/* ── 단계 ────────────────────────────────────────────────────────────────── */

test('firstChunkLine: 안 본 첫 문장, 모두 봤거나 다시 보기면 0', () => {
  assert.equal(firstChunkLine(4, [], false), 0)
  assert.equal(firstChunkLine(4, [0, 1], false), 2)
  assert.equal(firstChunkLine(4, [0, 1, 2, 3], false), 0)
  assert.equal(firstChunkLine(4, [0, 1], true), 0)
})

test('StageChunk 새 수업 첫 문장(c-new): 위치·봤어요·[다음 문장]·고지·게이트·모아 보기 닫힘, [다음 단계] 없음', () => {
  const html = stage([L0, L1, L2, L3])
  assert.ok(html.includes(U3.title) && html.includes('data-stage-title'))
  assert.ok(html.includes(U3.counter(1, 4)) && html.includes(U3.seen(1)))
  assert.ok(html.includes(U3.next) && !html.includes(U3.prev))
  assert.ok(html.includes(U3.aiNote))
  assert.ok(html.includes(esc(U3.gate(1, 4))))
  assert.ok(!html.includes('FOOTER-NEXT'))
  assert.ok(html.includes('aria-expanded="false"') && html.includes(U3.collectCount(7)))
})

test('StageChunk 마지막 문장(c-last)·다시 보기(c-review): [다음 단계] 보이고 [다음 문장] 없음 / 다시 보기는 0번부터', () => {
  const last = stage([L0, L1, L2, L3], { pieces: { seen: [0, 1, 2] } })
  assert.ok(last.includes(U3.counter(4, 4)) && last.includes(U3.seen(4)))
  assert.ok(last.includes('FOOTER-NEXT') && !last.includes(U3.next) && last.includes(U3.prev))
  const rv = stage([L0, L1, L2, L3], { pieces: { seen: [0, 1, 2, 3] } }, true)
  assert.ok(rv.includes(U3.counter(1, 4)) && rv.includes('FOOTER-NEXT') && rv.includes(U3.next))
  const rvFresh = stage([L0, L1, L2, L3], {}, true)
  assert.ok(rvFresh.includes('FOOTER-NEXT') && !rvFresh.includes(esc(U3.gate(1, 4))), '다시 보기는 다 안 봐도 [지금 단계로]')
})

test('StageChunk: 조각 없는 줄에선 고지를 숨긴다 · 모든 줄 null 인 새 수업은 줄마다 «나누지 못했어요»(빈 상태 아님)·모아 보기 없음', () => {
  const nullLine = stage([L0, L1, L2, L3], { pieces: { seen: [0, 1] } })
  assert.ok(nullLine.includes(U3.noPieces) && !nullLine.includes(U3.aiNote))
  const allNull = stage([L2, { ...L3, pieces: null }])
  assert.ok(allNull.includes(U3.noPieces) && !allNull.includes(U3.emptyTitle))
  assert.ok(!allNull.includes(U3.collect))
})

test('StageChunk 옛 수업(c-old, 어느 줄에도 pieces 키 없음): 빈 상태 카드 + footer, 위치·카드 없음', () => {
  const old = [L0, L1].map((l) => {
    const o: DialogueLine = { ...l }
    delete o.pieces
    return o
  })
  const html = stage(old)
  assert.ok(html.includes(U3.emptyTitle) && html.includes(U3.emptyBody) && html.includes('FOOTER-NEXT'))
  assert.ok(!html.includes(U3.counter(1, 2)) && !html.includes('<section'))
  assert.equal(renderToStaticMarkup(createElement(ChunkEmpty)).includes(U3.emptyTitle), true)
})

/* ── 모아 보기 ───────────────────────────────────────────────────────────── */

test('PieceCollect: 접힘(aria-expanded=false·aria-controls, 본문 없음) — 개수는 같은 조각 한 번', () => {
  const html = renderToStaticMarkup(createElement(PieceCollect, { content: contentOf([L0, L1, L2, L3]), pb: pbOf(), textOnly: false }))
  assert.ok(html.includes('aria-expanded="false"') && html.includes('aria-controls="piece-collect-body"'))
  assert.ok(!html.includes('id="piece-collect-body"'))
  assert.ok(html.includes(U3.collect) && html.includes(U3.collectCount(7)))
  assert.equal(renderToStaticMarkup(createElement(PieceCollect, { content: contentOf([L2]), pb: pbOf(), textOnly: false })), '')
})

test('PieceCollectList(펼침): 종류 순서 이름→액션→느낌→꾸밈→표현→연결, 같은 조각 한 번, 소리 있음=버튼·없음=글', () => {
  const items = collectPieces(contentOf([L0, L1, L2, L3]))
  const html = renderToStaticMarkup(createElement(PieceCollectList, { items, pb: pbOf(), textOnly: false }))
  const order = [...html.matchAll(/data-piece-group="([A-Z]+)"/g)].map((m) => m[1])
  assert.deepEqual(order, ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION', 'LINK'])
  assert.equal(count(html, '>はい<'), 1)
  assert.ok(html.includes(U3.group('표현 조각', 2)) && html.includes(U3.group('이름 조각', 1)))
  assert.equal(count(html, '<button'), 7)
  assert.equal(count(html, U3.collectPlaySr), 7)
  const t = renderToStaticMarkup(createElement(PieceCollectList, { items, pb: pbOf({ textOnly: true }), textOnly: true }))
  assert.equal(count(t, '<button'), 0)
  assert.equal(count(t, '<li'), 7)
})

/* ── «문제» 화면 제거 배선 · 경계 ──────────────────────────────────────────── */

const SRC = join(process.cwd(), 'src', 'components', 'lesson')
const read = (f: string) => readFileSync(join(SRC, f), 'utf8')

test('배선: ③ = StageChunk(pb 전달), StageQuiz 파일·import 없음, 진행 절에 quiz 없음', () => {
  const screen = read('LessonScreen.tsx')
  assert.match(screen, /stage === 3 \? \(\s*<StageChunk lesson=\{lesson\} st=\{st\} pb=\{pb\} reviewing=\{reviewing\} onToast=\{show\} footer=\{footer\} \/>/)
  assert.ok(!/StageQuiz/.test(screen))
  assert.equal(existsSync(join(SRC, 'StageQuiz.tsx')), false)
  assert.ok(!/'quiz'/.test(read('useLesson.ts')))
  const all = new Set<Section>(['listen', 'application', 'pieces'])
  assert.deepEqual(Object.keys(patchOf({ pieces: { seen: [2, 0, 2] } }, all)).sort(), ['application', 'listen', 'pieces'])
})

test('배선: 조각·구간 소리는 piece/phrase + sub, 본 문장은 pieces 절(모아 보내기), 다시 보기면 쓰지 않음', () => {
  const card = read('ChunkSentence.tsx')
  assert.match(card, /pb\.playLines\(key, \[\{ kind: 'piece', idx: lineIdx, sub: j, pace: 'normal' \}\]\)/)
  assert.match(card, /pb\.playLines\(key, \[\{ kind: 'phrase', idx: lineIdx, sub: q, pace: 'normal' \}\]\)/)
  assert.match(read('PieceCollect.tsx'), /kind: 'piece', idx: c\.line, sub: c\.j, pace: 'normal'/)
  const st = read('StageChunk.tsx')
  assert.match(st, /if \(!reviewing\) \{\s*const arr = \[\.\.\.next\]\.sort\(\(a, b\) => a - b\)\s*st\.update\(\(p\) => \(\{ \.\.\.p, pieces: \{ seen: arr \} \}\), \['pieces'\]\)/)
  assert.ok(!/immediate/.test(st))
})

test('경계: 새 부품 3파일 — 엔진·모델 이름·직접 fetch·Capacitor·새 16진 색 0', () => {
  for (const f of ['StageChunk.tsx', 'ChunkSentence.tsx', 'PieceCollect.tsx']) {
    const s = read(f)
    assert.ok(!/reazon|whisper|style-?bert|sbv2|claude|sherpa|qwen|ollama/i.test(s), `${f}: 엔진명`)
    assert.ok(!/\bfetch\(|window\.Capacitor/.test(s), `${f}: 직접 호출`)
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(s), `${f}: 16진 색`)
  }
})
