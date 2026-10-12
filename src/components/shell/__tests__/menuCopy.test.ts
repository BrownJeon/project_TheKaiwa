import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readCode } from '../../__tests__/sourceCode'

// task-065(IMP-0035·0036): 메뉴 이름 문구. 라우트(`/study/today`)는 그대로고 화면에 보이는 이름만 바뀐다.
const root = join(__dirname, '..', '..', '..')
const code = (...p: string[]) => readCode(join(root, ...p))

test('하단 탭 라벨 5개 — 오늘 탭은 「공부」, 라우트는 그대로', () => {
  const tabBar = code('components', 'shell', 'TabBar.tsx')
  const labels = [...tabBar.matchAll(/href: '([^']+)', match: '[^']+', label: '([^']+)'/g)].map((m) => [m[1], m[2]])
  assert.deepEqual(labels, [
    ['/study/ai', '회화'],
    ['/study/today', '공부'],
    ['/plan', '계획표'],
    ['/drawer/words', '단어장'],
    ['/ask', '질문'],
  ])
})

test('회화 홈 제목 — 실제 화면과 로딩 자리표시가 같은 「자유로운 대화」(task-046: 제목이 다르면 깜빡인다)', () => {
  const titleOf = (src: string) => [...src.matchAll(/<AppBar title="([^"]*)"/g)].map((m) => m[1])
  const page = titleOf(code('app', '(app)', 'study', 'ai', '(tab)', 'page.tsx'))
  const skeleton = titleOf(code('components', 'chat', 'StudyAiSkeleton.tsx'))
  assert.deepEqual(page, ['자유로운 대화'])
  assert.deepEqual(skeleton, page)
})
