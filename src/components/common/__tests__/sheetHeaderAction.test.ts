import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// task-074 §32-5 · W12 — 공용 `Sheet` 에 선택 prop `headerAction` 만 더했다. 안 넘기는 호출(50곳)의 DOM 은 변경 전과 바이트 단위로 같아야 한다.
// 골든 = 변경 전 `Sheet.tsx`(HEAD)로 같은 방법(포털을 노드 그대로 · 가짜 document)으로 뽑은 정적 렌더(fixtures/sheet-golden-074.json).

// 서버 렌더는 포털을 그리지 못한다 — 시험 동안만 createPortal 이 노드를 그대로 돌려주게 하고 `document` 를 둔다(이 파일 프로세스에서만).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rd = require('react-dom') as { createPortal: unknown }
rd.createPortal = (node: unknown) => node
;(globalThis as { document?: unknown }).document ??= {}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sheet = (require('../Sheet') as { default: (p: Record<string, unknown>) => ReactNode }).default

const noop = () => {}
const CASES: Record<string, Record<string, unknown>> = {
  basic: { open: true, title: '단어', onClose: noop, children: 'x' },
  notDismissible: { open: true, title: '단어', onClose: noop, dismissible: false, children: h('p', null, '본문') },
  describedBy: { open: true, title: '삭제할까요?', onClose: noop, describedBy: 'desc1', children: h('p', { id: 'desc1' }, '설명') },
  longTitle: { open: true, title: '아주 긴 제목 '.repeat(8), onClose: noop, dismissible: true, children: [h('span', { key: 1 }, 'a'), h('button', { key: 2, type: 'button' }, 'b')] },
  closed: { open: false, title: '닫힘', onClose: noop, children: 'y' },
}
const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sheet-golden-074.json'), 'utf8')) as Record<string, string>
const render = (p: Record<string, unknown>) => renderToStaticMarkup(h(Sheet, p))

test('H1 headerAction 을 안 넘기면 변경 전 골든과 바이트 단위로 같다(5가지 prop 조합) · undefined·null 을 넘겨도 같다', () => {
  assert.deepEqual(Object.keys(golden).sort(), Object.keys(CASES).sort())
  for (const [k, p] of Object.entries(CASES)) {
    assert.equal(render(p), golden[k], k)
    assert.equal(render({ ...p, headerAction: undefined }), golden[k], `${k} undefined`)
    assert.equal(render({ ...p, headerAction: null }), golden[k], `${k} null`)
  }
})

test('H2 넘기면 </h2> 와 닫기 단추 사이에 감싸는 요소 없이 그대로 · 닫히면 아무것도 안 그림', () => {
  const star = h('button', { type: 'button', 'aria-pressed': true }, '★')
  const out = render({ ...CASES.basic, headerAction: star })
  const [pre, post] = golden.basic!.split('<button type="button" aria-label="닫기"')
  assert.equal(out, `${pre}<button type="button" aria-pressed="true">★</button><button type="button" aria-label="닫기"${post}`)
  assert.equal(render({ ...CASES.closed, headerAction: star }), '')
})

test('H3 소스: {headerAction} 1회 · </h2> 바로 다음 줄 · 감싸는 요소 없음', () => {
  const s = readFileSync(join(__dirname, '..', 'Sheet.tsx'), 'utf8')
  assert.equal(s.match(/\{headerAction\}/g)?.length, 1)
  assert.match(s, /<\/h2>\n\s*\{headerAction\}\n\s*<button\n\s*type="button"\n\s*aria-label="닫기"/)
})
