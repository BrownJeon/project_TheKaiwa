import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SCENARIO_CARD_HEIGHT,
  SCENARIO_CARD_MIN_HEIGHT,
  SCENARIO_CARD_PARTS,
  scenarioCardHeight,
  TOPIC_DETAIL_SKELETON,
  TOPIC_HEAD_PARTS,
  TOPIC_INFO_PARTS,
  TOPIC_ROW_HEIGHT,
  TOPIC_ROW_MIN_HEIGHT,
  TOPIC_ROW_PARTS,
  topicHeadHeight,
  topicInfoHeight,
  topicRowHeight,
} from '../logic'

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

// ── qa-045-ui-a 결함 #3 — 상황 탭 자리표시 = 실제 상황 카드 높이(121) ─────────────────────────────

const card = readFileSync(join(__dirname, '..', '..', 'scenario', 'ScenarioCard.tsx'), 'utf8')
const ui = readFileSync(join(__dirname, '..', '..', 'common', 'ui.tsx'), 'utf8')
const cardPx = (re: RegExp): number => {
  const m = card.match(re)
  assert.ok(m, `ScenarioCard.tsx 에서 ${re} 를 찾지 못함`)
  return Number(m[1])
}

test('상황 카드 높이 근거 — ScenarioCard 클래스(글자 크기·패딩·간격·뱃지 높이)에서 계산한 값과 같다', () => {
  const lh = 1.5
  const badge = Number(ui.match(/export function Badge[\s\S]*?inline-flex h-\[(\d+)px\]/)?.[1])
  const arrow = cardPx(/text-\[15px\] leading-\[(\d+)px\] text-ink2/)
  assert.equal(badge, 22)
  assert.equal(arrow, 22)
  assert.ok(SCENARIO_CARD_PARTS.head >= 15 * 1.375, '제목 한 줄(leading-snug 1.375)보다 첫 줄이 크지 않으면 제목이 정한다')
  assert.equal(SCENARIO_CARD_PARTS.head, Math.max(badge, arrow), '첫 줄 = 뱃지·› 중 큰 쪽(제목 한 줄 20.6 보다 큼)')
  assert.ok(/ leading-snug /.test(card), '제목 줄 높이 1.375')
  assert.equal(SCENARIO_CARD_PARTS.titleJa, cardPx(/mt-0\.5 block min-w-0 truncate text-\[(\d+)px\]/) * lh)
  assert.equal(SCENARIO_CARD_PARTS.goal, cardPx(/mt-1 block min-w-0 truncate text-\[(\d+)px\]/) * lh)
  assert.equal(SCENARIO_CARD_PARTS.meta, cardPx(/mt-1\.5 flex [^"]*text-\[(\d+)px\]/) * lh)
  assert.ok(/ p-3\.5 /.test(card) && SCENARIO_CARD_PARTS.padY === 28, 'p-3.5 = 14+14')
  assert.ok(/ border /.test(card) && SCENARIO_CARD_PARTS.border === 2, '테두리 1+1')
  assert.equal(SCENARIO_CARD_PARTS.titleJaTop, 2, 'mt-0.5')
  assert.equal(SCENARIO_CARD_PARTS.goalTop, 4, 'mt-1')
  assert.equal(SCENARIO_CARD_PARTS.metaTop, 6, 'mt-1.5')
  assert.ok(card.includes(`min-h-[${SCENARIO_CARD_MIN_HEIGHT}px]`), '카드 하한 클래스와 상수가 같다')
})

test('상황 카드 자리표시 높이 = 121(QA 실측) — 하한 88 이 아니다 · 뱃지 상태 +4 · 제목 두 줄 +19.25', () => {
  assert.equal(SCENARIO_CARD_HEIGHT, 121)
  assert.equal(SCENARIO_CARD_HEIGHT, scenarioCardHeight())
  assert.ok(SCENARIO_CARD_HEIGHT > SCENARIO_CARD_MIN_HEIGHT)
  assert.equal(scenarioCardHeight({ ...SCENARIO_CARD_PARTS, meta: 22 }), SCENARIO_CARD_HEIGHT + 4, '상태가 뱃지(시도함·달성…)이면 메타 줄이 22')
  assert.equal(scenarioCardHeight({ ...SCENARIO_CARD_PARTS, head: 15 * 1.375 * 2 }), SCENARIO_CARD_HEIGHT + 19.25, '제목 두 줄')
})

test('상황 자리표시는 SCENARIO_CARD_HEIGHT 를 쓰고 88 을 직접 쓰지 않는다 — 관리 화면 상황 탭 두 곳·주제 보기의 상황 절 다시 시도', () => {
  const manage = readFileSync(join(__dirname, '..', 'ManageScreen.tsx'), 'utf8')
  const detail = readFileSync(join(__dirname, '..', 'TopicDetail.tsx'), 'utf8')
  const found = manage.match(/<Skeleton heights=\{\[44, SCENARIO_CARD_HEIGHT, SCENARIO_CARD_HEIGHT, SCENARIO_CARD_HEIGHT\]\}/g) ?? []
  assert.equal(found.length, 2, '불러오는 중·#161 다시 시도 중')
  assert.ok(!/heights=\{\[[^\]]*\b88\b/.test(manage), '88 직접 사용 금지(ManageScreen)')
  assert.ok(/<Skeleton heights=\{\[SCENARIO_CARD_HEIGHT, SCENARIO_CARD_HEIGHT\]\}/.test(detail))
  assert.ok(!/heights=\{\[[^\]]*\b88\b/.test(detail), '88 직접 사용 금지(TopicDetail)')
})

// ── qa-045-ui-a 결함 #2 — 주제 보기 자리표시 = 흔한 주제의 실제 높이 ──────────────────────────────

const detail = readFileSync(join(__dirname, '..', 'TopicDetail.tsx'), 'utf8')
const parts = readFileSync(join(__dirname, '..', '..', 'challenge', 'parts.tsx'), 'utf8')

test('주제 보기 머리 카드 높이 근거 — TopicDetail 클래스에서 계산한 값과 같다(126.5)', () => {
  const lh = 1.5
  const head = detail.slice(detail.indexOf('<section className="min-w-0 rounded-[14px] border'), detail.indexOf("v.origin === 'SEED' ? ("))
  assert.ok(head.length > 100, '머리 카드 구간을 찾지 못함')
  assert.ok(/ border /.test(head) && TOPIC_HEAD_PARTS.border === 2, '테두리 1+1')
  assert.ok(/ py-3"/.test(head) && TOPIC_HEAD_PARTS.padY === 24, 'py-3 = 12+12')
  const title = Number(head.match(/<h2 [^>]*text-\[(\d+)px\] font-bold/)?.[1])
  assert.equal(TOPIC_HEAD_PARTS.title, title * lh)
  assert.ok(TOPIC_HEAD_PARTS.title >= 22, '제목 줄이 뱃지(22)보다 커야 줄 높이를 제목이 정한다')
  assert.equal(TOPIC_HEAD_PARTS.titleJaTop, 4)
  assert.ok(/<p lang="ja" className="mt-1 break-words text-\[13px\]/.test(head) && TOPIC_HEAD_PARTS.titleJa === 13 * lh, '일본어 이름 mt-1 · 13px')
  assert.equal(TOPIC_HEAD_PARTS.descTop, 8)
  assert.ok(/<p className="mt-2 text-\[14px\]/.test(head) && TOPIC_HEAD_PARTS.descLine === 14 * lh, '설명 mt-2 · 14px')
  assert.equal(TOPIC_HEAD_PARTS.descLines, 2, 'QA 실측: 기본 주제 설명은 360·390·412 모두 두 줄')
  assert.equal(topicHeadHeight(), 126.5)
  assert.equal(topicHeadHeight({ ...TOPIC_HEAD_PARTS, descLines: 1 }), 126.5 - 21, '설명이 한 줄이면 21 작다')
})

test('주제 보기 출처 안내 상자 높이 근거 — InfoBox(py-3·13px) 두 줄 = 63, 화면의 상자 간격 mt-3', () => {
  assert.ok(/rounded-xl bg-surface2 px-3\.5 py-3 text-\[13px\]/.test(parts) && TOPIC_INFO_PARTS.padY === 24 && TOPIC_INFO_PARTS.line === 13 * 1.5)
  assert.equal(topicInfoHeight(), 63)
  assert.equal((detail.match(/<InfoBox className="mt-3">/g) ?? []).length, 2, '기본·내 버전 안내 상자 둘 다 mt-3')
  assert.equal(detail.match(/<section aria-labelledby="tp-chunks" className="mt-\[(\d+)px\]/)?.[1], String(TOPIC_DETAIL_SKELETON.gapAfterInfo), '표현 절 앞 간격')
  assert.equal(detail.match(/<section aria-labelledby="tp-scenarios" className="mt-\[(\d+)px\]/)?.[1], String(TOPIC_DETAIL_SKELETON.gapAfterChunks), '상황 절 앞 간격')
  assert.equal(TOPIC_DETAIL_SKELETON.gapAfterHead, 12)
})

test('주제 보기 자리표시 — 공용 Skeleton(gap 8)이 아니라 실제와 같은 블록 간격으로 늘어놓는다 · 옛 근사값 [104,64,240,120] 없음', () => {
  assert.equal(TOPIC_DETAIL_SKELETON.head, 126.5)
  assert.equal(TOPIC_DETAIL_SKELETON.info, 63)
  assert.ok(!/\[104, 64, 240, 120\]/.test(detail))
  assert.ok(/<DetailSkeleton \/>/.test(detail))
  const sk = detail.slice(detail.indexOf('function DetailSkeleton() {'), detail.indexOf('function NotFound() {'))
  assert.ok(/style=\{\{ height: h\.head \}\}/.test(sk) && /style=\{\{ height: h\.info \}\}/.test(sk) && /style=\{\{ height: h\.chunks \}\}/.test(sk) && /style=\{\{ height: h\.scenarios \}\}/.test(sk))
  assert.ok(/<span className=\{`mt-3 \$\{block\}`\}/.test(sk), '머리 카드 뒤 mt-3(12)')
  assert.equal((sk.match(/mt-\[18px\]/g) ?? []).length, 2, '표현 절·상황 절 앞 mt-[18px]')
  assert.ok(/role="status"/.test(sk), '읽기 알림은 하나')
  assert.equal((sk.match(/role="status"/g) ?? []).length, 1)
})
