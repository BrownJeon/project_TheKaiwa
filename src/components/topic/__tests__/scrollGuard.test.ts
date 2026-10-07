import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// task-045 T5 R1~R6(REV-159 M-2): 탭·칩·시트 때 `main` 스크롤을 건드리지 않는다 — 스크롤을 옮기는 호출이 코드에 들어오면 실패한다.
// 실제 360/390/412 실측은 QA. 여기서는 소스 문자열만 고정한다(주석은 제외 — 규칙을 설명하는 글은 허용).
const topicDir = join(__dirname, '..')
const settingsDir = join(__dirname, '..', '..', '..', 'app', '(app)', 'settings')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const FORBIDDEN: Array<[string, RegExp]> = [
  ['scrollIntoView', /scrollIntoView/],
  ['scrollTo(', /\bscrollTo\s*\(/],
  ['scrollBy(', /\bscrollBy\s*\(/],
  ['window.scroll', /window\.scroll/],
  ['scrollTop =', /scrollTop\s*=(?!=)/],
]

test('R1~R6: 관리 화면(topic)·설정(settings) 소스에 스크롤을 옮기는 호출이 0건', () => {
  const files = [...walk(topicDir), ...walk(settingsDir)]
  assert.ok(files.some((f) => f.endsWith('ManageScreen.tsx')), 'ManageScreen.tsx 를 찾지 못함')
  assert.ok(files.some((f) => f.endsWith(join('settings', 'page.tsx'))), 'settings/page.tsx 를 찾지 못함')
  for (const f of files) {
    const code = stripComments(readFileSync(f, 'utf8'))
    for (const [name, re] of FORBIDDEN) assert.ok(!re.test(code), `${f} 에 ${name} 금지`)
  }
})

test('R1~R6: ManageScreen 의 router.replace 는 모두 { scroll: false }', () => {
  const src = stripComments(readFileSync(join(topicDir, 'ManageScreen.tsx'), 'utf8'))
  const calls = [...src.matchAll(/router\.replace\(([^\n]*)\)/g)].map((m) => m[1])
  assert.ok(calls.length >= 3, `탭·시트 열기·시트 닫기 세 곳이 있어야 함: ${calls.length}`)
  for (const c of calls) assert.match(c, /\{\s*scroll:\s*false\s*\}/, `router.replace 에 scroll: false 필요: ${c}`)
})
