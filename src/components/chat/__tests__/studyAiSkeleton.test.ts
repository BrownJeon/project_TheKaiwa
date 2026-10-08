import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import StudyAiSkeleton from '../StudyAiSkeleton'
import { listSectionTitle, newButtonLabel, parseStudyAiTab, STUDY_AI_TABS } from '../studyAiTabs'

// task-046 REV-171 M-1: 서버 loading.tsx 자리표시가 주소의 ?tab= 에 맞는 탭 모양을 그린다(채팅방 뒤로가기 등 ?tab=chat|scenario 새 진입에서 회화를 그렸다가 바뀌지 않게).
const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (query: string) =>
  renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: ROUTER as never }, createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) as never }, createElement(StudyAiSkeleton))),
  )
const checked = (html: string) => [...html.matchAll(/aria-checked="true"[^>]*><span[^>]*>([^<]*)</g)].map((m) => m[1])
const buttons = (html: string) => [...html.matchAll(/<button type="button" tabindex="-1"[^>]*>([^<]*)</g)].map((m) => m[1])
const sections = (html: string) => [...html.matchAll(/<h3[^>]*>([^<]*)</g)].map((m) => m[1])
const blocks = (html: string) => (html.match(/class="block rounded-\[14px\] bg-surface2"/g) ?? []).length
const statuses = (html: string) => (html.match(/role="status"/g) ?? []).length

test('parseStudyAiTab: chat·scenario 외(없음·빈 값·엉뚱한 값·대소문자·배열)는 모두 회화', () => {
  assert.equal(parseStudyAiTab('chat'), 'chat')
  assert.equal(parseStudyAiTab('scenario'), 'scenario')
  assert.equal(parseStudyAiTab('talk'), 'talk')
  for (const v of [undefined, null, '', 'bogus', 'CHAT', 'Scenario', 'chat ', ['chat', 'talk'], ['chat']] as const) assert.equal(parseStudyAiTab(v as never), 'talk', String(v))
})

test('탭 문구 표: 분절 3개(회화·시나리오·채팅) · 새 버튼 · 섹션 머리', () => {
  assert.deepEqual(STUDY_AI_TABS.map((t) => [t.value, t.label]), [['talk', '회화'], ['scenario', '시나리오'], ['chat', '채팅']])
  assert.equal(newButtonLabel('talk'), '＋ 새 회화')
  assert.equal(newButtonLabel('chat'), '＋ 새 채팅')
  assert.equal(listSectionTitle('talk'), '회화')
  assert.equal(listSectionTitle('chat'), '채팅')
})

test('?tab=chat: 「채팅」 선택 · ＋ 새 채팅 · 채팅 섹션 머리 · 목록 자리표시 5줄 · 알림 한 줄', () => {
  const html = render('tab=chat')
  assert.deepEqual(checked(html), ['채팅'])
  assert.deepEqual(buttons(html), ['＋ 새 채팅'])
  assert.deepEqual(sections(html), ['채팅'])
  assert.equal(blocks(html), 5)
  assert.equal(statuses(html), 1)
})

test('?tab=talk·없음·엉뚱한 값·여러 번(tab=chat&tab=talk): 「회화」 선택 · ＋ 새 회화 · 회화 섹션 머리 · 목록 자리표시 5줄', () => {
  for (const q of ['tab=talk', '', 'foo=1', 'tab=bogus', 'tab=', 'tab=chat&tab=talk', 'tab=CHAT']) {
    const html = render(q)
    assert.deepEqual(checked(html), ['회화'], q)
    assert.deepEqual(buttons(html), ['＋ 새 회화'], q)
    assert.deepEqual(sections(html), ['회화'], q)
    assert.equal(blocks(html), 5, q)
    assert.equal(statuses(html), 1, q)
  }
})

test('?tab=scenario: 「시나리오」 선택 · 새 버튼·섹션·목록 자리표시 없음(시나리오 홈이 자체 로딩을 가진다) · 알림 한 줄', () => {
  const html = render('tab=scenario&sc=abc')
  assert.deepEqual(checked(html), ['시나리오'])
  assert.deepEqual(buttons(html), [])
  assert.deepEqual(sections(html), [])
  assert.equal(blocks(html), 0)
  assert.equal(statuses(html), 1)
})

test('자리표시는 탭 값을 서버 page 와 같은 함수로 판정하고(getAll 로 같은 모양), 화면 모듈 전체를 import 하지 않는다', () => {
  const root = join(__dirname, '..')
  const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  const skeleton = strip(readFileSync(join(root, 'StudyAiSkeleton.tsx'), 'utf8'))
  assert.match(skeleton, /parseStudyAiTab\(all\.length > 1 \? all : all\[0\]\)/)
  assert.match(skeleton, /sp\.getAll\('tab'\)/)
  assert.ok(!/from '\.\/StudyAiHome'|from '@\/components\/scenario\/ScenarioHome'/.test(skeleton), '큰 화면 모듈(L-6)')
  const page = strip(readFileSync(join(root, '..', '..', 'app', '(app)', 'study', 'ai', '(tab)', 'page.tsx'), 'utf8'))
  assert.match(page, /parseStudyAiTab\(tab\)/)
  assert.ok(!/tab === 'chat'/.test(page), '서버 page 에 따로 베낀 판정이 남지 않는다')
  const home = strip(readFileSync(join(root, 'StudyAiHome.tsx'), 'utf8'))
  assert.match(home, /from '\.\/studyAiTabs'/)
  assert.ok(!/export const STUDY_AI_TABS/.test(home))
})
