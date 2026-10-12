import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '../../__tests__/sourceCode'

// task-045 ui-e-fix: 공유 편집기(`DraftEditor`)를 담는 화면의 안쪽 스크롤 상자(`overflow-y-auto`)는 `relative` 여야 한다.
// 이유: 편집기 안 `sr-only`(absolute — 핵심 표현 줄의 읽기 안내·축 칩의 숨은 라디오)가 조상에 위치 지정이 없으면 앱 셸 `main` 기준으로 잡혀
// `main` 의 스크롤 높이가 커지고, 저장이 막혀 초점이 옮겨 갈 때 `main` 까지 따로 스크롤돼 BackBar 가 화면 밖으로 밀린다(스크롤러 둘).
// 실제 360/390/412 실측은 QA. 여기서는 소스의 className 문자열(요소 하나)만 고정한다.
const componentsDir = join(__dirname, '..', '..')
const dirs = [join(componentsDir, 'scenario'), join(componentsDir, 'topic')]

const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean)

/** 소스의 `className="…"` · `className={`…`}` · `className={'…'}` 값을 요소 하나당 문자열 하나로. */
function classStrings(src: string): string[] {
  return [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
}

/** `overflow-y-auto` 가 있는 요소 중 `relative` 가 없는 것 — 정확한 토큰 비교(`md:relative` 는 인정하지 않는다). */
function scrollBoxesWithoutRelative(src: string): string[] {
  return classStrings(src).filter((c) => tokens(c).includes('overflow-y-auto') && !tokens(c).includes('relative'))
}

function scrollBoxCount(src: string): number {
  return classStrings(src).filter((c) => tokens(c).includes('overflow-y-auto')).length
}

function editorScreens(): { name: string; src: string }[] {
  return dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((n) => n.endsWith('.tsx'))
      .map((n) => ({ name: n, src: readCode(join(dir, n)) }))
      .filter((f) => f.src.includes('<DraftEditor')),
  )
}

test('판별기 자체 점검: relative 없는 스크롤 상자만 걸러낸다', () => {
  const bad = '<div className="min-h-0 flex-1 overflow-y-auto px-4">'
  const good = '<div className="relative min-h-0 flex-1 overflow-y-auto px-4">'
  const tpl = '<div className={`relative flex-1 overflow-y-auto ${x}`}>'
  const respOnly = '<div className="md:relative overflow-y-auto">'
  const noScroll = '<div className="min-h-0 flex-1 px-4">'
  assert.equal(scrollBoxesWithoutRelative(bad).length, 1)
  assert.equal(scrollBoxesWithoutRelative(good).length, 0)
  assert.equal(scrollBoxesWithoutRelative(tpl).length, 0)
  assert.equal(scrollBoxesWithoutRelative(respOnly).length, 1)
  assert.equal(scrollBoxesWithoutRelative(noScroll).length, 0)
  assert.equal(scrollBoxCount(good) + scrollBoxCount(tpl) + scrollBoxCount(bad), 3)
})

test('편집기 화면: DraftEditor 를 쓰는 화면을 찾는다(새·고치기·변형·주제 만들기)', () => {
  const names = editorScreens().map((f) => f.name)
  for (const n of ['ScenarioDraftScreen.tsx', 'VariantDraftScreen.tsx', 'ScenarioDraftCards.tsx']) assert.ok(names.includes(n), `${n} 이(가) DraftEditor 를 쓰는 화면으로 잡혀야 함: ${names.join(',')}`)
})

test('편집기 화면: 안쪽 스크롤 상자(overflow-y-auto)는 모두 relative', () => {
  for (const f of editorScreens()) {
    const bad = scrollBoxesWithoutRelative(f.src)
    assert.deepEqual(bad, [], `${f.name}: overflow-y-auto 상자에 relative 필요 → ${bad.join(' | ')}`)
  }
})

test('편집기 화면: 새·고치기(ScenarioDraftScreen)·변형(VariantDraftScreen)은 스크롤 상자를 실제로 가진다(빈 통과 방지)', () => {
  const by = Object.fromEntries(editorScreens().map((f) => [f.name, f.src]))
  assert.ok(scrollBoxCount(by['ScenarioDraftScreen.tsx']) >= 1, 'ScenarioDraftScreen 의 스크롤 상자를 찾지 못함')
  assert.ok(scrollBoxCount(by['VariantDraftScreen.tsx']) >= 1, 'VariantDraftScreen 의 스크롤 상자를 찾지 못함')
})
