import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHAT_SKELETON, SKELETON_SR_LABEL, WORD_CATEGORY_ROW, WORD_SKELETON } from '../tabSkeleton'

// task-046(IMP-0027): 자리표시 높이는 클래스 합산이 아니라 실측 상수다 — 상수와 그리는 곳을 묶어 두어 한쪽만 바뀌지 않게 한다.
const root = join(__dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const skeleton = read('shell', 'TabSkeleton.tsx')

test('자리표시 부품은 상수에서 높이를 읽는다(하드코딩 px 없음) · 정적 블록만 · 「불러오는 중」 글자 없음', () => {
  assert.match(skeleton, /CHAT_SKELETON\.rowHeight/)
  assert.match(skeleton, /WORD_SKELETON\.rowHeight/)
  assert.match(skeleton, /WORD_CATEGORY_ROW\.chip/)
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
  assert.ok(!exists('study', 'today', 'loading.tsx') && !exists('plan', 'loading.tsx'), '오늘·계획표는 T3 범위')
})

test('서버 loading 화면은 데이터 요청을 하지 않는다(진짜 화면이 불러온다) · 눌리지 않게 inert', () => {
  for (const [dir, file] of [['chat', 'StudyAiSkeleton.tsx'], ['vocab', 'WordsSkeleton.tsx']] as const) {
    const src = read(dir, file)
    assert.ok(!/apiGet|apiPost|fetch\(/.test(src), file)
    assert.match(src, /\binert\b/, file)
  }
})
