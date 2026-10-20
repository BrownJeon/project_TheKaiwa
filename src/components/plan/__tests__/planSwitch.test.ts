import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import PlanSwitch, { markPlanFocus, PLAN_FOCUS_TTL_MS, takePlanFocus } from '../PlanSwitch'

// task-080 분절 [달력 | 성장](screens.md §36-2) — 단어장 DrawerSwitch 와 같은 구조(nav + aria-current 링크, replace, 이동 뒤 초점).
const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
const src = readFileSync(join(__dirname, '..', 'PlanSwitch.tsx'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')

afterEach(() => {
  takePlanFocus('calendar', 0)
  takePlanFocus('growth', 0)
})

test('nav 이름 «계획표 보기» · 링크 두 개(달력 /plan · 성장 /plan/growth) · 지금 항목만 aria-current="page"', () => {
  for (const current of ['calendar', 'growth'] as const) {
    const html = render(createElement(PlanSwitch, { current }))
    assert.match(html, /^<nav aria-label="계획표 보기" class="mb-0 flex gap-\[3px\] rounded-xl bg-surface2 p-\[3px\]">/)
    const links = [...html.matchAll(/<a([^>]*)>(.*?)<\/a>/g)].map((m) => ({ attrs: m[1], text: m[2].replace(/<[^>]+>/g, '') }))
    assert.deepEqual(
      links.map((l) => l.text),
      ['달력', '성장'],
    )
    assert.match(links[0].attrs, /href="\/plan"/)
    assert.match(links[1].attrs, /href="\/plan\/growth"/)
    const on = links.findIndex((l) => l.attrs.includes('aria-current="page"'))
    assert.equal(on, current === 'calendar' ? 0 : 1)
    assert.equal(links.filter((l) => l.attrs.includes('aria-current')).length, 1)
    assert.ok(!html.includes('inert'))
  }
})

test('자리표시(placeholder)는 inert — 눌리지 않고 초점 처리를 하지 않는다', () => {
  const html = render(createElement(PlanSwitch, { current: 'growth', placeholder: true }))
  assert.match(html, /<nav aria-label="계획표 보기" inert=""/)
  assert.match(src, /if \(placeholder\) return\s+if \(takePlanFocus\(current\)\)/, '자리표시는 초점 기록을 비우지 않는다')
})

test('이동은 replace(기록이 쌓이지 않음), 지금 항목을 누르면 이동하지 않음(preventDefault), 히트영역 세로 44px', () => {
  assert.match(src, /<Link\s+key=\{it\.view\}\s+href=\{it\.href\}\s+replace/)
  assert.match(src, /if \(on\) \{\s+e\.preventDefault\(\)/)
  assert.match(src, /before:h-11/)
  assert.ok(!/before:inset-0|before:-inset/.test(src), '가로로 넓히지 않는다(옆 칸을 가로챈다)')
})

test('이동 뒤 초점 기록 — 대상 화면만 한 번 받고, 유효 시간이 지나면 버린다', () => {
  markPlanFocus('growth', 1000)
  assert.equal(takePlanFocus('calendar', 1001), false, '다른 화면은 받지 않는다')
  assert.equal(takePlanFocus('growth', 1002), true)
  assert.equal(takePlanFocus('growth', 1003), false, '한 번만')
  markPlanFocus('calendar', 0)
  assert.equal(takePlanFocus('calendar', PLAN_FOCUS_TTL_MS + 1), false, '유효 시간 지남')
  markPlanFocus('calendar', PLAN_FOCUS_TTL_MS)
  assert.equal(takePlanFocus('calendar', PLAN_FOCUS_TTL_MS * 2), true, '경계(= TTL)는 받는다')
  assert.equal(PLAN_FOCUS_TTL_MS, 20_000)
})
