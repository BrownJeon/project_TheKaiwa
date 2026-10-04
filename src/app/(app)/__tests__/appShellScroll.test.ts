import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-029(IMP-0023): 셸 `<main>` 이 absolute 자손(sr-only)의 containing block 이 아니면 그 요소가 main 클립 밖으로 새어
// 문서가 스크롤되고 하단 탭이 밀린다. 실측(360/390/412×780/892)은 Developer 기록 — 여기서는 클래스 고정만.
const layout = readFileSync(join(__dirname, '..', 'layout.tsx'), 'utf8')
const mainTag = layout.match(/<main\s+className="([^"]*)"/)?.[1] ?? ''
const tokens = mainTag.split(/\s+/)

test('앱 셸 <main>: relative + overflow-y-auto + min-h-0 (스크롤 한 곳·absolute 자손 클립)', () => {
  assert.ok(mainTag, '<main className="…"> 를 찾지 못함')
  for (const t of ['relative', 'overflow-y-auto', 'min-h-0', 'min-w-0']) assert.ok(tokens.includes(t), `main 에 ${t} 필요: ${mainTag}`)
})

test('앱 셸: 높이는 dvh 기반(100vh 금지), 셸 자체에는 position 을 주지 않는다(overflow-hidden 셸이 포커스 스크롤 대상이 되지 않게)', () => {
  assert.ok(layout.includes("calc(100dvh - var(--kb-inset, 0px))"))
  assert.ok(!/100vh/.test(layout.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')))
  const shell = layout.match(/data-app-shell\s+className="([^"]*)"/)?.[1] ?? ''
  assert.ok(shell.includes('overflow-hidden'))
  assert.ok(!/\b(relative|absolute|fixed|sticky)\b/.test(shell), `셸에 position 클래스 금지: ${shell}`)
})
