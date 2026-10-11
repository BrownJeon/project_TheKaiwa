import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CorrectionCardsSkeleton, ChatRowsSkeleton, ErrorTypeRowSkeleton, SkeletonRegion, WordRowsSkeleton } from '../TabSkeleton'
import { CHAT_SKELETON, CORRECTION_SKELETON, CORRECTION_TYPE_ROW, SKELETON_SR_LABEL, WORD_CATEGORY_ROW, WORD_SKELETON } from '../tabSkeletonSizes'
import { CORRECTIONS_COPY } from '../../drawer/correctionsCopy'

// task-046(IMP-0027): 자리표시 높이는 클래스 합산이 아니라 실측 상수다 — 상수와 그리는 곳을 묶어 두어 한쪽만 바뀌지 않게 한다.
const root = join(__dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const skeleton = read('shell', 'TabSkeleton.tsx')

test('자리표시 부품은 상수에서 높이를 읽는다(하드코딩 px 없음) · 정적 블록만 · 「불러오는 중」 글자 없음', () => {
  assert.match(skeleton, /CHAT_SKELETON\.rowHeight/)
  assert.match(skeleton, /WORD_SKELETON\.rowHeight/)
  assert.match(skeleton, /WORD_CATEGORY_ROW\.chip/)
  assert.match(skeleton, /CORRECTION_SKELETON\.cardHeight/)
  assert.match(skeleton, /CORRECTION_SKELETON\.gap/)
  assert.match(skeleton, /CORRECTION_TYPE_ROW\.widths/)
  assert.ok(!/불러오는 중/.test(skeleton))
  assert.ok(!/animate-pulse/.test(skeleton), '정적 블록 — 깜빡임을 새로 만들지 않는다')
  assert.match(skeleton, /aria-busy="true"/)
  assert.match(skeleton, /role="status"/)
  assert.match(skeleton, /aria-hidden="true"/)
})

test('스크린리더 한 줄은 해요체 알림, 엔진명·모델명·AI 없음', () => {
  assert.equal(SKELETON_SR_LABEL, '불러오고 있어요')
})

test('채팅 줄 높이 = ChatListItem 실제 높이(min-h-16 안에 제목·미리보기·패딩·테두리), 줄 사이 gap-2', () => {
  const item = read('chat', 'ChatListItem.tsx')
  assert.match(item, /min-h-16/)
  assert.match(item, /py-2\.5/)
  assert.match(item, /border border-line/)
  assert.equal(CHAT_SKELETON.gap, 8)
  assert.match(read('chat', 'ChatList.tsx'), /flex min-w-0 flex-col gap-2/, '실제 목록 줄 간격 gap-2(8)')
  assert.ok(CHAT_SKELETON.rowHeight >= 64, '실제 줄은 min-h-16(64) 이상')
})

test('단어장 줄: 실제 목록 상자와 같은 클래스, 줄 높이는 min-h-[64px] 이상', () => {
  assert.match(read('vocab', 'WordsScreen.tsx'), /divide-y divide-line overflow-hidden rounded-\[14px\] border border-line bg-surface/)
  assert.match(skeleton, /divide-y divide-line overflow-hidden rounded-\[14px\] border border-line bg-surface/)
  assert.match(read('vocab', 'WordRow.tsx'), /min-h-\[64px\]/)
  assert.ok(WORD_SKELETON.rowHeight >= 64)
})

test('분류 칩 줄 자리 = CategoryChips 실제 칩 높이(h-9)와 py-1, 래퍼 mt-1.5', () => {
  assert.equal(WORD_CATEGORY_ROW.chip, 36)
  assert.equal(WORD_CATEGORY_ROW.pad, 4)
  assert.equal(WORD_CATEGORY_ROW.top, 6)
  assert.match(read('vocab', 'CategoryChips.tsx'), /h-9 /)
  assert.match(read('vocab', 'WordsScreen.tsx'), /<div className="mt-1\.5">\s*<CategoryChips/)
})

test('loading.tsx 적용 범위 — 탭 홈 화면에만 닿는다(회화는 (tab) 그룹, 단어장은 page 뿐인 폴더), 오늘·계획표는 T3', () => {
  const app = join(root, '..', 'app', '(app)')
  const exists = (...p: string[]) => {
    try {
      readFileSync(join(app, ...p))
      return true
    } catch {
      return false
    }
  }
  assert.ok(exists('study', 'ai', '(tab)', 'loading.tsx'))
  assert.ok(exists('study', 'ai', '(tab)', 'page.tsx'))
  assert.ok(!exists('study', 'ai', 'loading.tsx'), 'study/ai 바로 아래 loading.tsx 는 채팅방·회화방 진입에도 뜬다')
  assert.ok(!exists('study', 'ai', 'page.tsx'), '그룹으로 옮긴 page 가 두 곳에 남지 않는다')
  assert.ok(exists('drawer', 'words', 'loading.tsx'))
  assert.ok(!exists('drawer', 'loading.tsx'))
  // task-055 §21-7 D1: 교정 모음도 page 뿐인 폴더라 하위 경로로 새지 않는다.
  assert.ok(exists('drawer', 'corrections', 'loading.tsx'))
  assert.deepEqual(readdirSync(join(app, 'drawer', 'corrections')).sort(), ['loading.tsx', 'page.tsx'])
  assert.ok(!exists('study', 'today', 'loading.tsx') && !exists('plan', 'loading.tsx'), '오늘·계획표는 T3 범위')
})

test('서버 loading 화면은 데이터 요청을 하지 않는다(진짜 화면이 불러온다) · 눌리지 않게 inert', () => {
  for (const [dir, file] of [['chat', 'StudyAiSkeleton.tsx'], ['vocab', 'WordsSkeleton.tsx'], ['drawer', 'CorrectionsSkeleton.tsx']] as const) {
    const src = read(dir, file)
    assert.ok(!/apiGet|apiPost|fetch\(/.test(src), file)
    assert.match(src, /\binert\b/, file)
  }
})

// REV-171 L-2: 알림(role=status)은 aria-busy 래퍼 안에 두면 busy 동안 낭독이 미뤄질 수 있다 — 래퍼 밖 형제로, 한 묶음에 한 줄.
test('SkeletonRegion: 알림은 aria-busy 래퍼 밖 형제 · 보이는 블록은 busy+hidden 래퍼 안 · role=status 한 줄', () => {
  const html = renderToStaticMarkup(createElement(SkeletonRegion, null, createElement('span', null, 'x')))
  assert.equal((html.match(/role="status"/g) ?? []).length, 1)
  const busyAt = html.indexOf('aria-busy="true"')
  const statusAt = html.indexOf('role="status"')
  assert.ok(statusAt >= 0 && busyAt > statusAt, '알림이 busy 래퍼보다 앞(형제)')
  const busy = html.slice(busyAt)
  assert.ok(!busy.includes('role="status"'), 'busy 래퍼 안에는 알림이 없다')
  assert.match(html, /<div aria-busy="true" aria-hidden="true">/)
  assert.match(html, /<p role="status" class="sr-only">불러오고 있어요<\/p><div aria-busy/)
})

test('목록 자리표시 부품(채팅·단어)도 한 줄 알림만', () => {
  for (const el of [createElement(ChatRowsSkeleton), createElement(WordRowsSkeleton), createElement(CorrectionCardsSkeleton)]) {
    const html = renderToStaticMarkup(el)
    assert.equal((html.match(/role="status"/g) ?? []).length, 1)
    assert.ok(html.indexOf('role="status"') < html.indexOf('aria-busy="true"'))
  }
})

// REV-171 L-6: 서버 loading 자리표시가 큰 화면 모듈 전체를 끌어오지 않는다.
test('자리표시는 화면 모듈(StudyAiHome·WordsScreen)을 import 하지 않는다 — 상수는 작은 모듈에서', () => {
  assert.ok(!/from '\.\/StudyAiHome'/.test(read('chat', 'StudyAiSkeleton.tsx')))
  const words = read('vocab', 'WordsSkeleton.tsx')
  assert.ok(!/from '\.\/WordsScreen'/.test(words))
  assert.match(words, /import \{ WORD_SORT_OPTIONS \} from '\.\/labels'/)
  assert.match(read('vocab', 'WordsScreen.tsx'), /WORD_SORT_OPTIONS \} from '\.\/labels'/)
  assert.ok(!/export const WORD_SORT_OPTIONS/.test(read('vocab', 'WordsScreen.tsx')))
})

// ── task-055 채택 교정 모음(screens.md §21-7 D) ─────────────────────────────────

test('교정 카드 자리표시: 3줄 · 간격 10(목록 gap-2.5) · 카드 높이는 데모 렌더 평균 범위 안(실기기 QA 재측정 대상)', () => {
  assert.equal(CORRECTION_SKELETON.rows, 3)
  assert.equal(CORRECTION_SKELETON.gap, 10)
  assert.ok(CORRECTION_SKELETON.cardHeight >= 275 && CORRECTION_SKELETON.cardHeight <= 287, '데모 평균 275~287(켬·접힘) — 실측 전 값')
  assert.match(read('shell', 'tabSkeletonSizes.ts'), /CORRECTION_SKELETON = \{ rows: 3, cardHeight: \d+, gap: 10 \}/)
  assert.deepEqual([...CORRECTION_TYPE_ROW.widths], [56, 64, 60, 72])
})

test('교정 카드 바깥 클래스: 실제 카드와 자리표시가 같다, 목록·자리표시 둘 다 간격 10', () => {
  const card = read('drawer', 'DrawerCorrectionCard.tsx')
  const cls = 'rounded-[14px] border border-line bg-surface p-3.5'
  assert.ok(card.includes(cls))
  assert.ok(skeleton.includes(cls))
  assert.match(read('drawer', 'CorrectionsScreen.tsx'), /<ul aria-label=\{C\.listLabel\} className="flex flex-col gap-2\.5">/)
  assert.match(skeleton, /gap: CORRECTION_SKELETON\.gap/)
})

test('유형 줄: 화면은 mt-1.5 래퍼로 ErrorTypeChips 를 감싸고, 칩 h-9·스크롤 줄 py-1(= WORD_CATEGORY_ROW 높이) · 자리표시도 같은 값', () => {
  assert.match(read('drawer', 'CorrectionsScreen.tsx'), /<div className="mt-1\.5">\s*<ErrorTypeChips/)
  const chips = read('drawer', 'ErrorTypeChips.tsx')
  assert.match(chips, /h-9 /)
  assert.match(chips, /overflow-x-auto py-1 pr-4/)
  assert.match(skeleton, /marginTop: WORD_CATEGORY_ROW\.top/)
  assert.match(skeleton, /paddingBlock: WORD_CATEGORY_ROW\.pad/)
  const html = renderToStaticMarkup(createElement(ErrorTypeRowSkeleton))
  assert.match(html, /^<div aria-hidden="true"/)
  assert.ok(html.includes(`>${CORRECTIONS_COPY.typeLabel}</span>`), '라벨 글자 = correctionsCopy.typeLabel')
  assert.equal((html.match(/rounded-full bg-surface2/g) ?? []).length, 4)
  assert.ok(!html.includes('role="status"'), '알림은 카드 쪽 한 줄뿐')
})

test('분절: 단어장·교정 모음 화면과 두 자리표시 넷 다 DrawerSwitch, 자리표시는 placeholder', () => {
  assert.match(read('vocab', 'WordsScreen.tsx'), /<DrawerSwitch current="words" \/>/)
  assert.match(read('vocab', 'WordsSkeleton.tsx'), /<DrawerSwitch current="words" placeholder \/>/)
  assert.match(read('drawer', 'CorrectionsScreen.tsx'), /<DrawerSwitch current="corrections" \/>/)
  assert.match(read('drawer', 'CorrectionsSkeleton.tsx'), /<DrawerSwitch current="corrections" placeholder \/>/)
})

test('교정 모음 자리표시는 화면 모듈을 import 하지 않고, 화면 첫 로딩과 같은 부품을 쓴다', () => {
  const sk = read('drawer', 'CorrectionsSkeleton.tsx')
  assert.ok(!/CorrectionsScreen/.test(sk))
  for (const src of [sk, read('drawer', 'CorrectionsScreen.tsx')]) {
    assert.match(src, /<ErrorTypeRowSkeleton \/>/)
    assert.match(src, /<CorrectionCardsSkeleton \/>/)
    assert.match(src, /<ChunkChips value=\{[^}]+\} withNone=\{false\}/)
    assert.match(src, /label=\{C\.search\}\s+placeholder=\{C\.search\}\s+commitWhileTyping=\{false\}/)
    assert.match(src, /<DisplayToggles keys=\{\['fu', 'hg'\]\}/)
  }
})
