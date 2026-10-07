import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TOPIC_ROW_HEIGHT, TOPIC_ROW_MIN_HEIGHT, TOPIC_ROW_PARTS, topicRowHeight } from '../logic'

// task-045 T5-1(REV-159 L-2): 자리표시·빈 상자 높이는 실제 주제 행 높이여야 도착 뒤 아래가 밀리지 않는다.
// 실제 렌더 높이는 클래스에서 계산한 값이다 — 클래스가 바뀌면 이 시험이 실패해 상수 갱신을 부른다. 실측은 QA.
const row = readFileSync(join(__dirname, '..', 'TopicRow.tsx'), 'utf8')
const screen = readFileSync(join(__dirname, '..', 'ManageScreen.tsx'), 'utf8')
const globals = readFileSync(join(__dirname, '..', '..', '..', 'app', 'globals.css'), 'utf8')

const px = (re: RegExp): number => {
  const m = row.match(re)
  assert.ok(m, `TopicRow.tsx 에서 ${re} 를 찾지 못함`)
  return Number(m[1])
}

test('주제 행 높이 근거 — 클래스(글자 크기·패딩·간격)와 본문 줄 높이에서 계산한 값과 같다', () => {
  const lh = Number(globals.match(/body\s*\{[^}]*?line-height:\s*([\d.]+)/)?.[1])
  assert.equal(lh, 1.5, '본문 line-height 가 바뀌면 TOPIC_ROW_PARTS 를 다시 계산')
  const title = px(/flex-1 truncate text-\[(\d+)px\] font-semibold/)
  const titleJa = px(/lang="ja" className="[^"]*text-\[(\d+)px\]/)
  const meta = px(/mt-0\.5 flex [^"]*text-\[(\d+)px\]/)
  assert.equal(TOPIC_ROW_PARTS.title, title * lh)
  assert.equal(TOPIC_ROW_PARTS.titleJa, titleJa * lh)
  assert.equal(TOPIC_ROW_PARTS.meta, meta * lh)
  assert.ok(/ py-3 /.test(row) && TOPIC_ROW_PARTS.padY === 24, '위아래 패딩 py-3 = 12+12')
  assert.ok(/flex min-w-0 flex-1 flex-col gap-0\.5/.test(row) && TOPIC_ROW_PARTS.gap === 2, '줄 사이 gap-0.5 = 2')
  assert.ok(/mt-0\.5 flex/.test(row) && TOPIC_ROW_PARTS.metaTop === 2, '메타 줄 mt-0.5 = 2')
  assert.ok(/ border /.test(row) && TOPIC_ROW_PARTS.border === 2, '테두리 1+1')
  // 제목 줄은 뱃지(h-[22px]) 보다 커서 줄 높이가 제목 줄이 정한다.
  assert.ok(TOPIC_ROW_PARTS.title >= 22)
})

test('자리표시 높이 = 실제 행 높이(92) — 하한 76 보다 크고 합계가 맞다', () => {
  assert.equal(TOPIC_ROW_HEIGHT, 92)
  assert.equal(TOPIC_ROW_HEIGHT, topicRowHeight())
  assert.equal(topicRowHeight({ ...TOPIC_ROW_PARTS, meta: 22 }), TOPIC_ROW_HEIGHT + 4, '챌린지 뱃지(22)가 붙으면 메타 줄이 22 로 커져 +4')
  assert.ok(row.includes(`min-h-[${TOPIC_ROW_MIN_HEIGHT}px]`), '행 하한 클래스와 상수가 같다')
  assert.ok(TOPIC_ROW_HEIGHT > TOPIC_ROW_MIN_HEIGHT)
})

test('ManageScreen — 주제 탭 자리표시·빈 상자는 TOPIC_ROW_HEIGHT 를 쓰고 76 을 직접 쓰지 않는다', () => {
  assert.ok(/<Skeleton heights=\{\[TOPIC_ROW_HEIGHT\]\}/.test(screen), '내가 만든 주제 자리표시')
  assert.ok(/<Blocks heights=\{\[TOPIC_ROW_HEIGHT, TOPIC_ROW_HEIGHT, TOPIC_ROW_HEIGHT\]\}/.test(screen), '기본 주제 자리표시')
  assert.ok(/<Dashed minHeight=\{TOPIC_ROW_HEIGHT\}>\{MANAGE\.mineEmpty\}/.test(screen), '내가 만든 주제 빈 상자')
  assert.ok(!/heights=\{\[76/.test(screen))
})
