/**
 * task-039 화면(데모 v1 D1~D4=A) — 교정 카드의 접이식 "시험 문법" 줄.
 * DOM 라이브러리가 없어 `renderToStaticMarkup` 으로 접힘·펼침 두 모양과 카드 배치를 보고, 클릭 상태는 모양 컴포넌트(`ExtraNoteView`)의
 * `open` 으로 대신한다. 매핑(옛 응답 → null)·스크롤 따라가기 판정은 순수 함수로 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CorrectionDto, ReviewItemDto } from '@/types/chat'
import CorrectionCard from '../CorrectionCard'
import ExtraNoteLine, { ExtraNoteView, extraNoteBoxId, hasExtraNote } from '../ExtraNoteLine'
import { contentGrowthAction, FOLLOW_HOLD_MS } from '../followHold'
import { EXTRA_NOTE_LABEL } from '../labels'
import { correctionFromDone, correctionFromReviewItem } from '../messages'
import TalkCorrectionCard from '@/components/talk/TalkCorrectionCard'
import { JaQuoted } from '@/components/common/japanese/JaQuoted'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { splitJaQuotes, splitJaRuns } from '@/components/common/japanese/jaQuotes'
import { splitJaQuotes as reviewSplitJaQuotes } from '@/components/lesson/review/reviewLogic'

const NOTE = 'N5 문법 · い형용사 과거형 — 끝의 「い」를 빼고 「かった」를 붙여요(「楽しい」→「楽しかった」).'
const ENGINE_NAMES = /claude|anthropic|haiku|sonnet|opus|whisper|reazon|sherpa|style[-_ ]?bert|sbv2|qwen|ollama|model_id|speaker_id/i

const cr = (over: Partial<CorrectionDto> = {}): CorrectionDto => ({
  id: 'c1',
  status: 'PROPOSED',
  original: '楽しいでした。',
  corrected: '楽しかったです。',
  explanation: '‘즐거웠어요’는 「楽しかったです」라고 해요.',
  errorType: 'CONJUGATION',
  severity: 'MINOR',
  chunkType: 'FEELING',
  ...over,
})

const noop = () => undefined
const card = (c: CorrectionDto) =>
  renderToStaticMarkup(createElement(CorrectionCard, { correction: c, index: 1, total: 3, busy: false, highlighted: false, onAccept: noop, onReject: noop }))
const line = (text: string | null | undefined) => renderToStaticMarkup(createElement(ExtraNoteLine, { correctionId: 'c1', text }))
const view = (open: boolean, text = NOTE) => renderToStaticMarkup(createElement(ExtraNoteView, { boxId: extraNoteBoxId('c1'), text, open, describedBy: 'cr_c1_head' }))

/** 펼친 상자(div#cr_c1_xn)만 잘라 낸다 — 버튼 글자와 섞지 않으려고. */
function boxOf(html: string): string {
  const start = html.indexOf('id="cr_c1_xn"')
  assert.ok(start >= 0, '상자가 있어야 한다')
  const open = html.lastIndexOf('<div', start)
  return html.slice(open, html.indexOf('</div>', start) + 6)
}

// ── ① 값이 없으면 줄 자체가 없다 ────────────────────────────────────────────

test('hasExtraNote: null·undefined·빈 문자열·공백뿐 → 없음, 글이 있으면 있음', () => {
  for (const v of [null, undefined, '', '   ', '\n\t '] as const) assert.equal(hasExtraNote(v), false, JSON.stringify(v))
  assert.equal(hasExtraNote(NOTE), true)
  assert.equal(hasExtraNote(' 「〜ように」 '), true)
})

test('ExtraNoteLine: 값이 없으면 아무것도 그리지 않는다(빈 마크업)', () => {
  for (const v of [null, undefined, '', '  ']) assert.equal(line(v), '', JSON.stringify(v))
})

test('옛 교정(필드 없음)과 null 은 카드 마크업이 같고, 줄·머리줄 id·이름이 하나도 없다', () => {
  const old = card(cr())
  const nul = card(cr({ extraNoteKo: null }))
  assert.equal(nul, old)
  for (const s of ['_xn', '_head', EXTRA_NOTE_LABEL.more, EXTRA_NOTE_LABEL.less, 'aria-expanded', 'aria-describedby']) assert.ok(!old.includes(s), s)
  assert.equal(card(cr({ extraNoteKo: '   ' })), old, '공백뿐인 값도 옛 카드와 같다')
})

// ── ② 값이 있으면 접힌 상태로 ────────────────────────────────────────────────

test('ExtraNoteLine: 값이 있으면 접힘으로 시작 — 버튼 이름·aria-expanded=false·aria-controls·상자 hidden', () => {
  const html = line(NOTE)
  assert.match(html, /^<div class="[^"]*\bmt-0\.5\b[^"]*">/)
  assert.ok(html.includes('<button type="button" aria-expanded="false" aria-controls="cr_c1_xn"'), html)
  assert.ok(html.includes(`<span>${EXTRA_NOTE_LABEL.more}</span>`))
  assert.ok(!html.includes(EXTRA_NOTE_LABEL.less))
  assert.ok(html.includes('<span aria-hidden="true" class="text-[12px]">▾</span>'), '화살표는 읽지 않는다')
  assert.match(boxOf(html), /<div id="cr_c1_xn" hidden=""/)
})

test('ExtraNoteView: 펼친 모양 — 이름이 "시험 문법 접기"·▴·aria-expanded=true·상자 보임, 접은 모양과 상자 id 같음', () => {
  const on = view(true)
  const off = view(false)
  assert.ok(on.includes('aria-expanded="true"'))
  assert.ok(on.includes(`<span>${EXTRA_NOTE_LABEL.less}</span>`))
  assert.ok(on.includes('>▴</span>'))
  assert.ok(!boxOf(on).includes('hidden'), '펼치면 hidden 이 없다')
  assert.ok(boxOf(off).includes('hidden=""'))
  assert.ok(on.includes('aria-controls="cr_c1_xn"') && off.includes('aria-controls="cr_c1_xn"'))
  assert.ok(on.includes('aria-describedby="cr_c1_head"'))
  assert.deepEqual(EXTRA_NOTE_LABEL, { more: '시험 문법 더 보기', less: '시험 문법 접기' })
})

test('키보드·터치: 진짜 <button type="button"> 이라 Enter·Space 가 기본 동작, 카드 폭 × 최소 44px, 포커스 링', () => {
  const html = view(false)
  assert.equal((html.match(/<button /g) ?? []).length, 1)
  const btn = html.slice(html.indexOf('<button'), html.indexOf('>', html.indexOf('<button')))
  for (const cls of ['min-h-11', 'w-full', 'min-w-0', 'text-left', 'focus-visible:outline-2', 'focus-visible:outline-accent']) assert.ok(btn.includes(cls), cls)
  assert.ok(!btn.includes('tabindex="-1"'))
})

test('펼친 상자: 왼쪽 선 상자 14px ink2(기존 토큰만)·360px 가로 넘침 방지(min-w-0·줄바꿈)', () => {
  const box = boxOf(view(true))
  for (const cls of ['border-l-2', 'border-line', 'pl-3', 'text-[14px]', 'text-ink2', 'min-w-0', 'break-keep', '[overflow-wrap:anywhere]', '[&amp;_[lang=ja]]:[word-break:normal]'])
    assert.ok(box.includes(cls), cls)
  assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(view(true)), '새 색(하드코딩) 없음')
})

test('reduced-motion: 애니메이션은 motion-safe: 접두사로만 붙는다', () => {
  const html = view(true)
  const anims = html.match(/[\w:-]*animate-\[[^\]\s"]+\]/g) ?? []
  assert.ok(anims.length >= 1)
  for (const a of anims) assert.ok(a.startsWith('motion-safe:'), a)
})

// ── ④ 「」 만 lang=ja, 후리가나·한글·엔진명 없음 ──────────────────────────────

test('펼친 상자: 「」 조각과 「」 밖 일본어 구간에 lang="ja"(REV-115 M-1), 루비(후리가나)·한글 줄 없음, 글은 받은 그대로', () => {
  const box = boxOf(view(true))
  assert.ok(box.includes('<span lang="ja">「い」</span>'))
  assert.ok(box.includes('<span lang="ja">「楽しい」</span>'))
  assert.ok(box.includes('<span>N5 문법 · </span><span lang="ja" style="word-break:inherit">い</span><span>형용사 과거형'), '「」 밖 「い형용사」 의 い 만 일본어 — 줄바꿈은 둘레 문장을 따른다')
  assert.equal((box.match(/lang="ja"/g) ?? []).length, 5)
  assert.ok(!/<ruby|<rt|한글 발음/.test(box))
  const plain = box.replace(/<[^>]+>/g, '')
  assert.equal(plain, NOTE, '자르기·다시 쓰기 없음')
})

// ── ④-b 「」 밖 일본어 구간(dev-039c, REV-115 M-1) ─────────────────────────────

const runs = (s: string) => renderToStaticMarkup(createElement(JaRuns, { text: s }))
const quoted = (s: string) => renderToStaticMarkup(createElement(JaQuoted, { text: s }))
const jaSpans = (html: string) => [...html.matchAll(/<span lang="ja"(?: style="word-break:inherit")?>([^<]*)<\/span>/g)].map((m) => m[1])
const HANGUL_DIGIT_LATIN = /[ᄀ-ᇿㄱ-ㆎ가-힣0-9A-Za-z()（）:：+＋]/

test('splitJaRuns: 「」 없는 문형 설명 — 〜たら·た·ら 만 일본어, 한글·괄호·숫자·기호는 아니다', () => {
  assert.deepEqual(splitJaRuns('〜たら(N4): 동사 た형+ら'), [
    { text: '〜たら', ja: true },
    { text: '(N4): 동사 ', ja: false },
    { text: 'た', ja: true },
    { text: '형+', ja: false },
    { text: 'ら', ja: true },
  ])
  const box = boxOf(view(true, '〜たら(N4): 동사 た형+ら'))
  assert.deepEqual(jaSpans(box), ['〜たら', 'た', 'ら'])
  for (const t of jaSpans(box)) assert.ok(!HANGUL_DIGIT_LATIN.test(t), t)
  assert.ok(box.includes('<span>(N4): 동사 </span>') && box.includes('<span>형+</span>'))
  assert.equal(box.replace(/<[^>]+>/g, ''), '〜たら(N4): 동사 た형+ら', '글은 그대로')
})

test('splitJaRuns: 빈 문자열·일본어만·한글만·혼합·한국어 속 기호', () => {
  assert.deepEqual(splitJaRuns(''), [])
  assert.equal(runs(''), '')
  assert.deepEqual(splitJaRuns('食べたことがある'), [{ text: '食べたことがある', ja: true }])
  assert.deepEqual(splitJaRuns('동사 기본형에 붙여요'), [{ text: '동사 기본형에 붙여요', ja: false }])
  assert.deepEqual(splitJaRuns('〜ことがある(N4): 경험 — 동사 た형+ことがある'), [
    { text: '〜ことがある', ja: true },
    { text: '(N4): 경험 — 동사 ', ja: false },
    { text: 'た', ja: true },
    { text: '형+', ja: false },
    { text: 'ことがある', ja: true },
  ])
  assert.deepEqual(splitJaRuns('3〜7일 뒤 다시'), [{ text: '3〜7일 뒤 다시', ja: false }], '가나·한자 없는 〜 는 일본어가 아니다')
  assert.deepEqual(splitJaRuns('ー 는 장음'), [{ text: 'ー 는 장음', ja: false }])
  assert.deepEqual(splitJaRuns('見る・聞く 는 동사'), [{ text: '見る・聞く', ja: true }, { text: ' 는 동사', ja: false }], '・ 로 이어진 구간은 하나')
  assert.deepEqual(splitJaRuns('예: 雨が降ったら、行きません。'), [
    { text: '예: ', ja: false },
    { text: '雨が降ったら、行きません', ja: true },
    { text: '。', ja: false },
  ], '、 는 일본어 사이에 낄 때만 구간에 든다')
  assert.deepEqual(splitJaRuns('ｺｰﾋｰ 는 반각'), [{ text: 'ｺｰﾋｰ', ja: true }, { text: ' 는 반각', ja: false }])
})

test('줄바꿈: 「」 밖 구간만 word-break 를 둘레(한국어 keep-all)에서 물려받고, 「」 조각은 상자의 일본어 규칙(normal) 그대로 — 상자 클래스 불변', () => {
  const box = boxOf(view(true, '〜ましょう: 어간+ましょう 「行きましょう」'))
  assert.ok(box.includes('<span lang="ja" style="word-break:inherit">〜ましょう</span>'))
  assert.ok(box.includes('<span lang="ja" style="word-break:inherit">ましょう</span>'))
  assert.ok(box.includes('<span lang="ja">「行きましょう」</span>'), '「」 조각에는 style 없음')
  assert.equal((box.match(/style="/g) ?? []).length, 2)
  assert.ok(box.includes('break-keep') && box.includes('[&amp;_[lang=ja]]:[word-break:normal]'), '상자 클래스(개발 메모 ③) 그대로')
  assert.ok(!/style="[^"]*(?:font|color|letter|size|margin|padding)/.test(box), '줄바꿈 외 모양(글꼴·색·자간·크기·여백)은 건드리지 않는다')
})

test('「」 밖에 일본어가 없으면 JaRuns 출력 = 기존 JaQuoted 출력(「」 처리 불변)', () => {
  for (const s of ['끝의 「い」를 빼고 「かった」를 붙여요(「楽しい」→「楽しかった」).', '「〜ように」', '선생님이 「明日」라고 했어요', '한글만 있어요', '「」', '「열린 괄호만']) {
    assert.deepEqual(splitJaRuns(s), splitJaQuotes(s), s)
    assert.equal(runs(s), quoted(s), s)
  }
  assert.deepEqual(splitJaRuns('「〜ように」: 동사 기본형+ように').filter((p) => p.ja).map((p) => p.text), ['「〜ように」', 'ように'], '「」 조각은 통째로, 밖 구간은 따로')
})

test('복습 근거 상자(TeacherWhy)·reviewLogic 재노출은 그대로 「」 만 — 다른 화면 영향 없음', () => {
  assert.deepEqual(
    reviewSplitJaQuotes(NOTE).filter((p) => p.ja).map((p) => p.text),
    ['「い」', '「かった」', '「楽しい」', '「楽しかった」'],
  )
  const src = readFileSync(join(process.cwd(), 'src/components/lesson/review/TeacherWhy.tsx'), 'utf8')
  assert.ok(src.includes("import { JaQuoted } from '@/components/common/japanese/JaQuoted'") && !src.includes('JaRuns'))
  const line = readFileSync(join(process.cwd(), 'src/components/chat/ExtraNoteLine.tsx'), 'utf8')
  assert.ok(line.includes('<JaRuns text={text} />') && !line.includes('<JaQuoted'))
})

test('값이 없으면 줄 없음 — null·빈·공백뿐은 「」 밖 일본어 처리와 무관하게 그대로', () => {
  for (const v of [null, undefined, '', ' ']) assert.equal(line(v), '', JSON.stringify(v))
  assert.ok(!/<ruby|<rt/.test(boxOf(view(true, '〜たら(N4): 동사 た형+ら'))), '후리가나 없음')
})

test('길게 와도 화면은 자르지 않는다(서버 상한 200 은 서버 몫)', () => {
  const long = '가'.repeat(199) + '。'
  assert.equal(boxOf(view(true, long)).replace(/<[^>]+>/g, ''), long)
})

test('엔진·모델 이름이 줄·카드 마크업에 없다', () => {
  for (const html of [view(true), view(false), card(cr({ extraNoteKo: NOTE }))]) assert.ok(!ENGINE_NAMES.test(html), html.match(ENGINE_NAMES)?.[0])
})

// ── 카드 안 자리(D1-A)·상태(#rv-done) ─────────────────────────────────────────

test('교정 카드: 설명 바로 아래·채택 안내 위에 접힌 줄, 머리줄 id 로 어느 카드인지 이어 준다', () => {
  const html = card(cr({ extraNoteKo: NOTE }))
  const iExpl = html.indexOf('즐거웠어요')
  const iLine = html.indexOf(EXTRA_NOTE_LABEL.more)
  const iNote = html.indexOf('선생님 제안이에요')
  const iAccept = html.indexOf('>채택<')
  assert.ok(iExpl > 0 && iExpl < iLine && iLine < iNote && iNote < iAccept, `${iExpl} ${iLine} ${iNote} ${iAccept}`)
  assert.ok(html.includes('id="cr_c1_head"'))
  assert.ok(html.includes('aria-describedby="cr_c1_head"'))
  assert.ok(html.includes('aria-expanded="false"'))
})

test('설명이 비어 있어도 추가 설명이 있으면 줄은 그린다', () => {
  assert.ok(card(cr({ explanation: '', extraNoteKo: NOTE })).includes(EXTRA_NOTE_LABEL.more))
})

test('채택·무시·기한 지남 뒤에도 줄이 남는다(#rv-done) — 결과 문구보다 위', () => {
  const cases: Array<[CorrectionDto['status'], string]> = [
    ['ACCEPTED', '채택했어요'],
    ['REJECTED', '무시했어요'],
    ['EXPIRED', '기한이 지난 교정이에요'],
  ]
  for (const [status, done] of cases) {
    const html = card(cr({ status, extraNoteKo: NOTE }))
    const iLine = html.indexOf(EXTRA_NOTE_LABEL.more)
    assert.ok(iLine > 0 && iLine < html.indexOf(done), status)
  }
})

// ── 회화방(D4-A) — 코치 힌트는 정답 보기 전 줄 없음 → 보기 뒤 접힘 ─────────────

test('회화 코치 카드: 정답 보기 전엔 줄 없음, 보기 뒤엔 같은 접힌 줄(#talk-coach)', () => {
  const c = cr({ hintKo: '문장 끝을 바꿔 보세요.', extraNoteKo: NOTE })
  const props = { correction: c, onReveal: noop, busy: false, highlighted: false, onAccept: noop, onReject: noop }
  const before = renderToStaticMarkup(createElement(TalkCorrectionCard, { ...props, revealed: false }))
  assert.ok(before.includes('정답 보기'))
  assert.ok(!before.includes(EXTRA_NOTE_LABEL.more) && !before.includes('_xn'))
  const after = renderToStaticMarkup(createElement(TalkCorrectionCard, { ...props, revealed: true }))
  assert.ok(after.includes(EXTRA_NOTE_LABEL.more))
  assert.ok(after.includes('aria-expanded="false" aria-controls="cr_c1_xn"'))
})

test('회화 카드(힌트 없음)·모아 둔 교정 시트도 같은 교정 카드를 쓴다(같은 줄)', () => {
  const html = renderToStaticMarkup(
    createElement(TalkCorrectionCard, { correction: cr({ extraNoteKo: NOTE }), revealed: false, onReveal: noop, busy: false, highlighted: false, onAccept: noop, onReject: noop }),
  )
  assert.ok(html.includes(EXTRA_NOTE_LABEL.more))
  const sheet = readFileSync(join(process.cwd(), 'src/components/talk/LaterCorrectionsSheet.tsx'), 'utf8')
  assert.match(sheet, /import CorrectionCard from '@\/components\/chat\/CorrectionCard'/)
  assert.match(sheet, /<CorrectionCard\b/)
})

// ── ③ 매핑: 옛 응답(필드 없음) → null, 값은 그대로 ─────────────────────────────

test('correctionFromDone: extraNoteKo 없음·null → null, 값은 자르거나 거르지 않고 그대로', () => {
  const base = { id: 'x', original: 'a', corrected: 'b', errorType: 'OTHER' as const, severity: 'MINOR' as const }
  assert.equal(correctionFromDone(base).extraNoteKo, null)
  assert.ok('extraNoteKo' in correctionFromDone(base))
  assert.equal(correctionFromDone({ ...base, extraNoteKo: null }).extraNoteKo, null)
  const raw = '  「〜ように」 '
  assert.equal(correctionFromDone({ ...base, extraNoteKo: raw }).extraNoteKo, raw)
})

test('correctionFromReviewItem(#33): 옛 응답 → null, 값 그대로, 나머지 칸은 예전 매핑과 같다', () => {
  const it: ReviewItemDto = {
    correctionId: 'r1',
    messageId: 'm1',
    original: 'o',
    corrected: 'c',
    explanationKo: '설명',
    errorType: 'GRAMMAR',
    severity: 'MAJOR',
    chunkType: null,
    status: 'PROPOSED',
  }
  assert.deepEqual(correctionFromReviewItem(it), {
    id: 'r1',
    messageId: 'm1',
    status: 'PROPOSED',
    original: 'o',
    corrected: 'c',
    explanation: '설명',
    errorType: 'GRAMMAR',
    severity: 'MAJOR',
    chunkType: null,
    savedWordId: null,
    extraNoteKo: null,
  })
  assert.equal(correctionFromReviewItem({ ...it, explanation: '우선', explanationKo: '뒤' }).explanation, '우선')
  assert.equal(correctionFromReviewItem({ ...it, extraNoteKo: NOTE }).extraNoteKo, NOTE)
  const review = readFileSync(join(process.cwd(), 'src/components/chat/ChatReview.tsx'), 'utf8')
  assert.match(review, /\.map\(correctionFromReviewItem\)/)
  assert.ok(!review.includes('function normalizeItem'), '매핑은 한 곳(messages.ts)')
})

// ── 스크롤 따라가기(개발 메모 ⑧) ─────────────────────────────────────────────

test('contentGrowthAction: 펼침 직후(유예 안) 증가는 따라가지 않고, 유예가 지나면 평소 규칙', () => {
  const t = 10_000
  assert.equal(contentGrowthAction(t, t + FOLLOW_HOLD_MS, true), 'hold')
  assert.equal(contentGrowthAction(t, t + FOLLOW_HOLD_MS, false), 'hold')
  assert.equal(contentGrowthAction(t + FOLLOW_HOLD_MS, t + FOLLOW_HOLD_MS, true), 'follow')
  assert.equal(contentGrowthAction(t, 0, true), 'follow')
  assert.equal(contentGrowthAction(t, 0, false), 'none')
  assert.ok(FOLLOW_HOLD_MS > 0 && FOLLOW_HOLD_MS <= 1_000)
})

test('MessageList: 펼침 유예는 한 번만 쓰고 지운다 + 목록이 컨텍스트로 넘긴다', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/chat/MessageList.tsx'), 'utf8')
  assert.match(src, /<FollowHoldContext\.Provider value=\{holdFollow\}>/)
  assert.match(src, /action === 'hold'\) \{[\s\S]{0,200}holdUntilRef\.current = 0/)
  const line = readFileSync(join(process.cwd(), 'src/components/chat/ExtraNoteLine.tsx'), 'utf8')
  assert.match(line, /if \(!open\) \{\s*hold\?\.\(\)/, '펼칠 때만 유예')
  assert.match(line, /scrollIntoView\(\{ block: 'nearest'/)
})
