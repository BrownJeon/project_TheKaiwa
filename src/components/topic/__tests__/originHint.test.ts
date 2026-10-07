import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Topic } from '@/types/lesson'
import {
  ORIGIN_HINT_OF,
  parseOriginHint,
  TOPIC_COPY_INFO_PARTS,
  TOPIC_DETAIL_SKELETON,
  TOPIC_INFO_PARTS,
  topicCopyInfoHeight,
  topicDetailSkeleton,
  topicHref,
  topicInfoHeight,
  topicOrigin,
  topicSkeletonStart,
  type Origin,
} from '../logic'

// task-045 s6-hint(REV-168 M-1 · qa-045-ui-f O-3): S6 자리표시가 기본(SEED) 주제에만 맞아 내가 만든 주제는 도착 때 표현 절이 약 75px 당겨졌다.
// 관리 화면 링크가 출처 힌트 `?o=m|s|c` 를 싣고, 자리표시는 그 힌트로 출처 안내 상자의 유무·높이만 고른다. 출처 판정은 데이터(`topicOrigin`)가 한다.
// DOM 없이 레이아웃을 잴 수 없어 순수 함수는 값으로, 화면은 소스로 고정한다(실제 점프 ≤8px 는 QA 실측).
const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (name: string) => strip(readFileSync(join(dir, name), 'utf8'))
const detail = read('TopicDetail.tsx')

// QA 실측 기준의 절대 위치 — 위로 BackBar 52 + 본문 `pt-3` 12 = 64 가 깔려 있다(자리표시·도착 화면 둘 다 같다).
const TOP = 64

// ── parseOriginHint — 허용 값 외는 없는 것으로 ───────────────────────────────────────────

test('parseOriginHint: m·s·c 세 글자만 받고 나머지(없음·빈 값·대문자·긴 글·배열·숫자·태그)는 null', () => {
  assert.equal(parseOriginHint('m'), 'm')
  assert.equal(parseOriginHint('s'), 's')
  assert.equal(parseOriginHint('c'), 'c')
  for (const bad of [undefined, null, '', 'M', 'S', 'mine', 'seed', 'm ', ' m', 'ms', 'm&sc=x', '<script>', '0', 1, true, {}, ['m'], ['m', 's'], ['s', 'x']]) {
    assert.equal(parseOriginHint(bad), null, `허용 값이 아닌데 받았다: ${JSON.stringify(bad)}`)
  }
})

// ── 출처 → 힌트 4조합(topicOrigin 결과를 그대로 옮긴다) ───────────────────────────────────

test('topicOrigin 결과 → 힌트: 기본(s)·기본인데 사본 id 집합에도 있는 경우(s, isSeed 우선)·내 주제(m)·내 버전(c)', () => {
  const copies = new Set(['copy-1'])
  const t = (id: string, isSeed: boolean): Pick<Topic, 'id' | 'isSeed'> => ({ id, isSeed })
  const hint = (x: Pick<Topic, 'id' | 'isSeed'>) => ORIGIN_HINT_OF[topicOrigin(x, copies)]
  assert.equal(hint(t('seed-1', true)), 's')
  assert.equal(hint(t('copy-1', true)), 's', 'isSeed 가 먼저 — 사본 id 집합에 있어도 기본 주제')
  assert.equal(hint(t('mine-1', false)), 'm')
  assert.equal(hint(t('copy-1', false)), 'c')
  assert.deepEqual(ORIGIN_HINT_OF, { MINE: 'm', SEED: 's', COPY: 'c' })
  // 매핑 결과는 항상 허용 값 — 되돌려 읽으면 같은 출처다.
  for (const o of ['MINE', 'SEED', 'COPY'] as Origin[]) assert.equal(parseOriginHint(ORIGIN_HINT_OF[o]), ORIGIN_HINT_OF[o])
})

// ── topicHref ───────────────────────────────────────────────────────────────────────────

test('topicHref: 출처를 넘기면 ?o=<힌트>, 없으면 옛 주소 그대로 · id 는 인코딩 · 주소를 읽으면 같은 힌트', () => {
  assert.equal(topicHref('a1'), '/settings/scenarios/topics/a1')
  assert.equal(topicHref('a1', null), '/settings/scenarios/topics/a1')
  assert.equal(topicHref('a1', undefined), '/settings/scenarios/topics/a1')
  assert.equal(topicHref('a1', 'MINE'), '/settings/scenarios/topics/a1?o=m')
  assert.equal(topicHref('a1', 'SEED'), '/settings/scenarios/topics/a1?o=s')
  assert.equal(topicHref('a1', 'COPY'), '/settings/scenarios/topics/a1?o=c')
  assert.equal(topicHref('a/b', 'COPY'), '/settings/scenarios/topics/a%2Fb?o=c')
  for (const o of ['MINE', 'SEED', 'COPY'] as Origin[]) {
    const u = new URL(topicHref('x', o), 'http://localhost')
    assert.equal(parseOriginHint(u.searchParams.get('o')), ORIGIN_HINT_OF[o])
  }
})

// ── 자리표시 모양 ────────────────────────────────────────────────────────────────────────

test('topicDetailSkeleton: 내 주제(m)는 출처 안내 상자 자리가 없다 · 기본(s)·내 버전(c)은 있다 · 힌트 없음은 기본 주제 모양', () => {
  const keys = (h: Parameters<typeof topicDetailSkeleton>[0]) => topicDetailSkeleton(h).map((b) => b.key)
  assert.deepEqual(keys('m'), ['head', 'chunks', 'scenarios'])
  assert.deepEqual(keys('s'), ['head', 'info', 'chunks', 'scenarios'])
  assert.deepEqual(keys('c'), ['head', 'info', 'chunks', 'scenarios'])
  assert.deepEqual(topicDetailSkeleton(null), topicDetailSkeleton('s'), '힌트 없음(직접 주소·새로 고침) = 옛 값(기본 주제 모양) 그대로')
  const info = (h: 's' | 'c') => topicDetailSkeleton(h).find((b) => b.key === 'info')!.height
  assert.equal(info('s'), TOPIC_DETAIL_SKELETON.info)
  assert.equal(info('c'), TOPIC_DETAIL_SKELETON.copyInfo)
  for (const h of ['m', 's', 'c', null] as const) {
    const b = topicDetailSkeleton(h)
    assert.equal(b[0].gap, 0, '첫 블록 앞은 간격 없음')
    assert.equal(b.find((x) => x.key === 'chunks')!.gap, TOPIC_DETAIL_SKELETON.gapAfterInfo)
    assert.equal(b.find((x) => x.key === 'scenarios')!.gap, TOPIC_DETAIL_SKELETON.gapAfterChunks)
    assert.equal(b.find((x) => x.key === 'head')!.height, TOPIC_DETAIL_SKELETON.head)
  }
})

test('자리표시의 표현 절 시작 위치 = 도착한 실제 화면(QA 실측): 내 주제 208.5 · 기본 주제 283.5 · 내 버전은 계산값 308', () => {
  const start = (h: 'm' | 's' | 'c' | null, key: 'info' | 'chunks') => TOP + topicSkeletonStart(topicDetailSkeleton(h), key)
  // qa-045-ui-f: 내가 만든 주제(출처 상자 없음) 도착 뒤 표현 절 208.5(360·390), qa-045-ui-a: 기본 주제 출처 상자 202.5·표현 절 283.5.
  assert.equal(start('m', 'chunks'), 208.5)
  assert.equal(start('s', 'info'), 202.5)
  assert.equal(start('s', 'chunks'), 283.5)
  assert.equal(start(null, 'chunks'), 283.5)
  // 내 버전: 머리 126.5 + 12 + 상자 87.5 + 18 (상자 높이는 아래 시험이 클래스에서 계산)
  assert.equal(start('c', 'info'), 202.5)
  assert.equal(start('c', 'chunks'), 308)
  assert.ok(Number.isNaN(topicSkeletonStart(topicDetailSkeleton('m'), 'info')), '내 주제 자리표시에는 상자가 없다')
  // 내 주제 도착 후와의 차이 — 예전(상자 63 을 항상 둠)에는 −75 였다.
  assert.equal(start('m', 'chunks') - (TOP + TOPIC_DETAIL_SKELETON.head + TOPIC_DETAIL_SKELETON.gapAfterInfo), 0)
  assert.equal(topicSkeletonStart(topicDetailSkeleton('s'), 'chunks') - topicSkeletonStart(topicDetailSkeleton('m'), 'chunks'), TOPIC_DETAIL_SKELETON.gapAfterHead + TOPIC_DETAIL_SKELETON.info)
})

test('실제 화면의 출처 안내 상자: 내 주제에는 없고 기본·내 버전에만 있다(상자 개수·간격) — 자리표시의 m/s/c 모양이 맞는 근거', () => {
  const chain = detail.slice(detail.indexOf("v.origin === 'SEED' ? ("), detail.indexOf('{v.challenge ? ('))
  assert.ok(chain.length > 100, '출처 안내 구간을 찾지 못함')
  assert.equal((chain.match(/<InfoBox className="mt-3">/g) ?? []).length, 2, '기본·내 버전 두 곳뿐')
  assert.ok(/\) : null\}\s*$/.test(chain.trim()), '그 밖(내 주제)은 null — 상자 없음')
  assert.ok(!/MINE/.test(chain), '내 주제 분기는 따로 두지 않는다')
})

test('내 버전 안내 상자 높이 근거 — InfoBox py-3 + 제목 한 줄(font-bold 13px) + [기본으로 되돌리기] min-h-11(44) = 87.5', () => {
  const copy = detail.slice(detail.indexOf("v.origin === 'COPY' ? ("), detail.indexOf('{v.challenge ? ('))
  assert.ok(copy.length > 100, '내 버전 안내 구간을 찾지 못함')
  assert.ok(/<p className="font-bold">/.test(copy) && TOPIC_COPY_INFO_PARTS.line === 13 * 1.5 && TOPIC_COPY_INFO_PARTS.lines === 1, '제목 `font-bold` 13px 한 줄(InfoBox text-[13px] — rowHeight 시험이 묶음)')
  const btn = copy.slice(copy.indexOf('<button'), copy.indexOf('</button>'))
  assert.ok(/\binline-flex\b/.test(btn) && /\bmin-h-11\b/.test(btn), '되돌리기 버튼 inline-flex min-h-11')
  assert.equal(TOPIC_COPY_INFO_PARTS.action, 11 * 4, 'min-h-11 = 2.75rem = 44px')
  assert.equal(TOPIC_COPY_INFO_PARTS.padY, TOPIC_INFO_PARTS.padY, 'InfoBox py-3 는 기본 주제 상자와 같다')
  assert.equal(topicCopyInfoHeight(), 87.5)
  assert.equal(topicCopyInfoHeight({ ...TOPIC_COPY_INFO_PARTS, lines: 2 }), 87.5 + 19.5, '제목이 두 줄이면 19.5 더(가장 좁은 폭에서도 한 줄이라는 가정 — 실측은 QA)')
  assert.ok(topicCopyInfoHeight() > topicInfoHeight(), '버튼 줄이 있어 기본 주제 상자(63)보다 크다 — 63 으로 두면 도착 뒤 약 24px 밀린다')
})

// ── 보안·연결: 허용 값 외 무시, 화면에 그대로 출력하지 않음, 링크 위치 ────────────────────────────

test('page.tsx: ?o 는 parseOriginHint 를 거친 값만 화면에 넘기고 원문은 어디에도 쓰지 않는다', () => {
  const page = strip(readFileSync(join(dir, '..', '..', 'app', '(app)', 'settings', 'scenarios', 'topics', '[id]', 'page.tsx'), 'utf8'))
  assert.match(page, /searchParams: Promise<\{ sc\?: string \| string\[\]; o\?: string \| string\[\] \}>/)
  assert.match(page, /const \{ sc, o \} = await searchParams/)
  assert.match(page, /originHint=\{parseOriginHint\(o\)\}/)
  // 원문 `o` 는 타입 선언·구조 분해·parseOriginHint 인자에만 나온다 — JSX 글·로그·주소 조립에 쓰지 않는다.
  assert.equal([...page.matchAll(/\bo\b/g)].length, 3)
  assert.ok(!/redirect\([^)]*\bo\b/.test(page), '로그인 되돌아오기 주소에 힌트를 싣지 않는다')
})

test('TopicDetail: 힌트는 자리표시 모양을 고르는 데만 쓴다 — 글자로 출력하지 않고 출처 판정은 v.origin(데이터)', () => {
  assert.equal([...detail.matchAll(/\boriginHint\b/g)].length, 3, '매개변수 구조 분해·타입·자리표시 전달, 그 밖의 쓰임 없음')
  assert.match(detail, /originHint = null/)
  assert.match(detail, /<DetailSkeleton hint=\{originHint\} \/>/)
  assert.ok(!/\{\s*originHint\s*\}\s*</.test(detail) && !/\$\{originHint/.test(detail), '글자로 출력하지 않는다')
  const body = detail.slice(detail.indexOf('function Body('))
  assert.ok(!/originHint|hint/.test(body), '도착한 화면(Body)은 힌트가 아니라 데이터로 그린다')
  assert.match(body, /v\.origin === 'MINE' \? TOPIC\.remove/, '출처 판정은 데이터')
})

test('S6 로 가는 링크: 출처를 아는 곳은 힌트를 붙인다 — 관리 화면 행(row.origin)·되돌린 뒤(SEED)·고친 뒤(저장 경로·사본 열기·← 이름표)', () => {
  assert.match(read('TopicRow.tsx'), /href=\{topicHref\(row\.id, row\.origin\)\}/)
  assert.match(detail, /router\.replace\(topicHref\(t\.seedId, 'SEED'\), \{ scroll: false \}\)/)
  const edit = read('useTopicEdit.ts')
  assert.match(edit, /router\.replace\(topicHref\(id, origin\), \{ scroll: false \}\)/, '바뀐 것 없이 나감')
  assert.match(edit, /topicHref\(o\.id, o\.route === 'fork' \? 'COPY' : origin\)/, '저장 뒤: 기본 주제를 고치면 사본(내 버전), 그 밖에는 그대로')
  assert.match(edit, /topicHref\(copyId, 'COPY'\)/, '[내 버전 열기]')
  assert.match(edit, /router\.push\(topicHref\(id, origin\)\)/, '나가기')
  assert.match(read('TopicEditScreen.tsx'), /backHref=\{topicHref\(id, m\.origin\)\}/)
})

test('topicHref 호출 전수 — 힌트 없이 부르는 곳은 정해진 곳뿐(새로 S6 링크를 달 때 출처를 아는지 한 번 더 보게)', () => {
  const NO_HINT_OK = new Set([
    'logic.ts', // 정의 + topicEditHref·topicSheetHref(같은 주제의 하위 주소 — 출처를 모른다)
  ])
  const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f))
  const bare: string[] = []
  for (const f of files) {
    const src = strip(readFileSync(join(dir, f), 'utf8'))
    for (const m of src.matchAll(/\btopicHref\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
      if (!m[1].includes(',') && !NO_HINT_OK.has(f)) bare.push(`${f}: topicHref(${m[1]})`)
    }
  }
  assert.deepEqual(bare, [], `힌트 없는 topicHref 호출: ${bare.join(' | ')}`)
})
