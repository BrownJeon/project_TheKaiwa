import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAN_SKELETON } from '../planSkeleton'

// task-046(IMP-0027, T3): 계획표 자리표시는 실제 부품을 그대로 그리고(달 격자는 같은 monthGrid), 데이터가 정하는 챌린지 카드만 실측 높이 상수다.
const root = join(__dirname, '..', '..')
const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const read = (...p: string[]) => strip(readFileSync(join(root, ...p), 'utf8'))
const skeleton = read('plan', 'PlanSkeleton.tsx')
const screen = read('plan', 'PlanScreen.tsx')

test('챌린지 카드 자리 = 실측 278.4(전에는 172 — 도착하면 106px 밀렸다)', () => {
  assert.equal(PLAN_SKELETON.challengeCardH, 278.4)
  const card = read('challenge', 'ChallengePlanCard.tsx')
  assert.match(card, /style=\{\{ height: PLAN_SKELETON\.challengeCardH \}\}/)
  assert.ok(!/h-\[172px\]/.test(card))
})

test('서버 자리표시와 클라이언트 로딩 구간은 같은 부품·같은 순서(챌린지 카드 → 월 이동·요약·날짜 칸·표시 설명 → 성장 기록 카드)', () => {
  for (const src of [skeleton, screen]) {
    const order = ['<ChallengePlanCard', '<MonthNav', '<SummaryRow', '<CalendarGrid', '<CalendarLegend', '<GrowthSoonCard']
    let at = -1
    for (const tag of order) {
      const i = src.indexOf(tag)
      assert.ok(i > at, `${tag} 순서`)
      at = i
    }
  }
  assert.match(skeleton, /<ChallengePlanCard status="loading" data=\{null\}/)
  assert.match(skeleton, /<SummaryRow status="loading"/)
  assert.match(skeleton, /<CalendarGrid key=\{month\} month=\{month\} today=\{today\} days=\{\[\]\} loading /)
  assert.match(skeleton, /<div inert>\s*<MonthNav/, '월 이동 줄은 눌리지 않게')
  assert.ok(!/MonthNoteBlock/.test(skeleton), '기록이 없는 달에만 생기는 안내 상자는 조건부라 자리표시에 넣지 않는다')
  assert.match(screen, /import \{ GrowthSoonCard \} from '\.\/parts'/)
  assert.match(read('plan', 'parts.tsx'), /export function GrowthSoonCard/)
})

test('달·날짜는 PlanScreen 과 같은 규칙으로 주소에서 읽는다(원본에서 돌아올 때 같은 달 격자)', () => {
  assert.match(skeleton, /useSearchParams\(\)/)
  assert.match(skeleton, /parsePlanParams\(sp\.get\('month'\), sp\.get\('day'\), sp\.get\('log'\), today\)/)
  assert.match(screen, /parsePlanParams\(sp\.get\('month'\), sp\.get\('day'\), sp\.get\('log'\), serverToday\)/)
})

test('useSearchParams 는 Suspense 경계 안에서만 — loading.tsx 는 경계의 fallback 자리라 밖이다(빌드 정적 생성 단계에서 막힌 결함, 개발 서버는 통과)', () => {
  const sfc = read('plan', 'PlanSkeleton.tsx')
  assert.match(sfc, /import \{ Suspense, useId \} from 'react'/)
  assert.match(sfc, /<Suspense fallback=\{<PlanSkeletonView today=\{today\} month=\{monthOf\(today\)\} \/>\}>\s*<PlanSkeletonFromUrl today=\{today\} \/>\s*<\/Suspense>/)
  // useSearchParams 를 부르는 곳은 Suspense 로 감싼 안쪽 컴포넌트 하나뿐이다
  assert.equal((sfc.match(/useSearchParams\(\)/g) ?? []).length, 1)
  assert.match(sfc, /function PlanSkeletonFromUrl\(\{ today \}: \{ today: string \}\) \{\s*const sp = useSearchParams\(\)/)
})

test('요약 3칸 로딩 틀 = 실제 칸 높이 62 — 회색 막대 아래 간격 mb-0.5(2px)', () => {
  // 실측: 로딩 칸 = 테두리 2 + 안쪽 위아래 16 + (위 2 + 막대 22 + 아래 2) + 글줄 18 = 62 = 실제 칸(숫자 20px×1.3 + 라벨 12px 줄 + 같은 여백).
  // 아래 간격이 mb-1(4px)이면 칸이 64가 되어 달력 본체가 도착할 때 2px 줄어든다(task-046 T3, 실측 후 보정한 값).
  const cal = read('plan', 'CalendarSection.tsx')
  assert.match(cal, /mx-auto mb-0\.5 mt-0\.5 block h-\[22px\] w-11 rounded-md bg-surface2/)
  assert.ok(!/mx-auto mb-1 mt-0\.5 block h-\[22px\]/.test(cal))
})

test('자리표시 안에 「불러오는 중」 글자·가짜 버튼·데이터 요청 없음', () => {
  assert.ok(!/불러오는 중/.test(skeleton))
  assert.ok(!/apiGet|apiPost|fetch\(/.test(skeleton))
})

test('loading.tsx 적용 범위 — 계획표 홈에만 닿는다((tab) 그룹), 챌린지 화면 진입엔 닿지 않는다', () => {
  const app = join(root, '..', 'app', '(app)')
  const exists = (...p: string[]) => {
    try {
      readFileSync(join(app, ...p))
      return true
    } catch {
      return false
    }
  }
  assert.ok(exists('plan', '(tab)', 'loading.tsx'))
  assert.ok(exists('plan', '(tab)', 'page.tsx'))
  assert.ok(!exists('plan', 'loading.tsx'), 'plan 바로 아래 loading.tsx 는 challenge/[id]·challenge/new·challenges 진입에도 뜬다')
  assert.ok(!exists('plan', 'page.tsx'), '그룹으로 옮긴 page 가 두 곳에 남지 않는다')
  const loading = readFileSync(join(app, 'plan', '(tab)', 'loading.tsx'), 'utf8')
  assert.match(loading, /<PlanSkeleton today=\{todayKst\(\)\} \/>/)
})
