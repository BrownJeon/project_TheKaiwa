import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dropShareMark } from '../LessonPasteScreen'
import { SHARE_PASTE_PATH } from '@/components/shell/shareTarget'

function fakeHistory(state: unknown) {
  const calls: unknown[][] = []
  return {
    calls,
    h: {
      state,
      replaceState(...args: unknown[]) {
        calls.push(args)
      },
    } as unknown as Pick<History, 'state' | 'replaceState'>,
  }
}

test('dropShareMark — 지금 history.state 를 같은 객체로 넘기고 주소만 표시 없는 경로로(REV-181 M-1)', () => {
  const nextState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['', {}] }
  const { h, calls } = fakeHistory(nextState)
  dropShareMark(h)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], nextState)
  assert.equal(calls[0][2], SHARE_PASTE_PATH)
  assert.ok(!String(calls[0][2]).includes('from=share'))
})

test('dropShareMark — state 가 null 이면 null 그대로(새로 만들지 않는다)', () => {
  const { h, calls } = fakeHistory(null)
  dropShareMark(h)
  assert.deepEqual(calls, [[null, '', SHARE_PASTE_PATH]])
})
