/**
 * task-066 §26-7 D·§26-13 ②③ — 누르고 말하기의 「밖으로 빼서 떼면 취소」(질문 탭만).
 * DOM 이 없어 핸들러 묶음(`pttHandlers`)을 가짜 이벤트로 불러 순서를 본다. `cancelOutside` 가 없으면 지금 순서 그대로여야 한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PushToTalkButton, { PTT_BACK_IN_PX, PTT_OUT_PX, pttHandlers, pttOutside, pttReleaseAction, type PttGesture } from '../PushToTalkButton'
import type { SttPhase } from '../sttUiState'

const R = 36

test('밖 판정: 가장자리 60px 밖이면 밖, 밖에서 48px 안으로 와야 안(12px 이력)', () => {
  assert.equal(PTT_OUT_PX, 60)
  assert.equal(PTT_BACK_IN_PX, 48)
  assert.equal(pttOutside(false, R + 60, R), false)
  assert.equal(pttOutside(false, R + 60.5, R), true)
  assert.equal(pttOutside(false, R + 50, R), false, '안에서는 54 근처여도 안')
  assert.equal(pttOutside(true, R + 50, R), true, '밖에서 이력 구간이면 밖 유지')
  assert.equal(pttOutside(true, R + 48, R), true)
  assert.equal(pttOutside(true, R + 47.5, R), false)
  assert.equal(pttReleaseAction(true), 'cancel')
  assert.equal(pttReleaseAction(false), 'release')
})

function harness(phase: SttPhase, withCo: boolean) {
  const log: string[] = []
  const g: PttGesture = { geom: null, out: false }
  const co = withCo
    ? { onCancel: () => log.push('cancel'), onOutChange: (o: boolean) => log.push(`out:${o}`) }
    : undefined
  const hd = pttHandlers(
    { phase, onPress: () => log.push('press'), onRelease: () => log.push('release'), onAbort: () => log.push('abort'), co },
    g,
    (o) => log.push(`set:${o}`),
  )
  const target = {
    setPointerCapture: () => log.push('capture'),
    getBoundingClientRect: () => {
      log.push('rect')
      return { left: 100, top: 200, width: 72, height: 72 }
    },
  }
  const ptr = (x: number, y: number, extra: Partial<{ button: number; isPrimary: boolean }> = {}) => ({
    button: 0,
    isPrimary: true,
    pointerId: 1,
    clientX: x,
    clientY: y,
    currentTarget: target,
    ...extra,
  })
  const key = (k: string) => ({ key: k, repeat: false, preventDefault: () => log.push('prevent') })
  return { log, g, hd, ptr, key }
}

const CX = 136
const CY = 236

test('기본(취소 없음): 누름 → 캡처 → onPress · 뗌 → onRelease · cancel → onAbort · Esc 무시 · move 핸들러 없음 · 크기 재지 않음', () => {
  const { log, hd, ptr, key } = harness('recording', false)
  assert.equal(hd.onPointerMove, undefined)
  hd.onPointerDown(ptr(CX, CY))
  hd.onPointerUp(ptr(CX + 300, CY))
  assert.deepEqual(log, ['capture', 'press', 'release'], '밖에서 떼도 보낸다(회화 지금 동작)')
  log.length = 0
  hd.onKeyDown(key('Escape'))
  assert.deepEqual(log, [], 'Esc 무시')
  hd.onPointerCancel()
  hd.onBlur()
  assert.deepEqual(log, ['abort', 'abort'])
  log.length = 0
  hd.onPointerDown(ptr(CX, CY, { isPrimary: false }))
  hd.onPointerDown(ptr(CX, CY, { button: 2 }))
  hd.onPointerUp(ptr(CX, CY, { isPrimary: false }))
  assert.deepEqual(log, [], '두 번째 손가락·오른쪽 버튼 무시')
  hd.onKeyDown(key(' '))
  hd.onKeyUp(key(' '))
  assert.deepEqual(log, ['prevent', 'press', 'prevent', 'release'])
})

test('밀어서 취소: 96px 밖에서 떼면 onCancel(보내지 않음), 안으로 돌아오면 onRelease', () => {
  const a = harness('recording', true)
  a.hd.onPointerDown(a.ptr(CX, CY))
  assert.deepEqual(a.log, ['capture', 'rect', 'press'])
  a.log.length = 0
  a.hd.onPointerMove!(a.ptr(CX, CY + 95))
  assert.deepEqual(a.log, [], '95px = 아직 안')
  a.hd.onPointerMove!(a.ptr(CX, CY + 97))
  assert.deepEqual(a.log, ['set:true', 'out:true'])
  a.hd.onPointerMove!(a.ptr(CX, CY + 90))
  assert.equal(a.g.out, true, '이력 구간 — 밖 유지')
  a.hd.onPointerUp(a.ptr(CX, CY + 90))
  assert.deepEqual(a.log, ['set:true', 'out:true', 'set:false', 'out:false', 'cancel'])
  assert.ok(!(a.log as string[]).includes('release'), '밖에서 떼면 보내지 않는다')

  const b = harness('recording', true)
  b.hd.onPointerDown(b.ptr(CX, CY))
  b.hd.onPointerMove!(b.ptr(CX + 120, CY))
  b.hd.onPointerMove!(b.ptr(CX + 83, CY))
  b.hd.onPointerUp(b.ptr(CX + 83, CY))
  assert.deepEqual(b.log.slice(-4), ['out:true', 'set:false', 'out:false', 'release'], '84px 안으로 돌아오면 원래대로 보낸다')
})

test('밀어서 취소: 녹음 중 Esc = 취소, 대기 중 Esc 무시, pointercancel 은 그대로 onAbort', () => {
  const a = harness('recording', true)
  a.hd.onKeyDown(a.key('Escape'))
  assert.deepEqual(a.log, ['prevent', 'cancel'])
  const b = harness('idle', true)
  b.hd.onKeyDown(b.key('Escape'))
  assert.deepEqual(b.log, [])
  const c = harness('recording', true)
  c.hd.onPointerDown(c.ptr(CX, CY))
  c.hd.onPointerMove!(c.ptr(CX, CY + 200))
  c.hd.onPointerCancel()
  assert.deepEqual(c.log.slice(-3), ['set:false', 'out:false', 'abort'])
})

test('F-2 ① 밖에서 누른 채 뗌이 오지 않았어도(30초 자동 멈춤으로 버튼 비활성) 새 누름은 「밖」 없이 시작한다 — 기본 경로는 그대로', () => {
  const a = harness('recording', true)
  a.hd.onPointerDown(a.ptr(CX, CY))
  a.hd.onPointerMove!(a.ptr(CX, CY + 200))
  assert.equal(a.g.out, true)
  a.log.length = 0
  a.hd.onPointerDown(a.ptr(CX, CY)) // 지난 누름의 pointerup 이 오지 않은 채 다시 누름
  assert.equal(a.g.out, false)
  assert.deepEqual(a.log, ['capture', 'set:false', 'out:false', 'rect', 'press'], '화면 표시·부모 표시를 모두 푼 뒤 시작')
  // 안에서 끝난 누름 뒤의 새 누름은 추가 호출이 없다
  const b = harness('recording', true)
  b.hd.onPointerDown(b.ptr(CX, CY))
  b.hd.onPointerUp(b.ptr(CX, CY))
  b.log.length = 0
  b.hd.onPointerDown(b.ptr(CX, CY))
  assert.deepEqual(b.log, ['capture', 'rect', 'press'])
  // 취소 없는 기본 버튼: 누름 순서 불변
  const c = harness('recording', false)
  c.hd.onPointerDown(c.ptr(CX, CY))
  assert.deepEqual(c.log, ['capture', 'press'])
})

test('F-2 ② 이미 보낸 뒤(대기)에 밖에서 떼면 취소 안내·취소 호출이 없다 · 시작·녹음·알아듣는 중이면 취소', () => {
  for (const phase of ['starting', 'recording', 'finishing'] as const) {
    const a = harness(phase, true)
    a.hd.onPointerDown(a.ptr(CX, CY))
    a.hd.onPointerMove!(a.ptr(CX, CY + 200))
    a.log.length = 0
    a.hd.onPointerUp(a.ptr(CX, CY + 200))
    assert.deepEqual(a.log, ['set:false', 'out:false', 'cancel'], phase)
  }
  // 30초 자동 멈춤 → 말이 이미 전송됨 → 상태 기계가 idle 로 돌아온 뒤 밖에서 뗌
  const done = harness('idle', true)
  done.hd.onPointerDown(done.ptr(CX, CY))
  done.hd.onPointerMove!(done.ptr(CX, CY + 200))
  done.log.length = 0
  done.hd.onPointerUp(done.ptr(CX, CY + 200))
  assert.ok(!done.log.includes('cancel'), '거짓 「보내지 않았어요」')
  assert.deepEqual(done.log, ['set:false', 'out:false', 'release'], '표시만 풀고 평소 뗌(대기 중에는 아무 일도 없다)')
  assert.equal(done.g.out, false)
})

test('F-2 Esc 가 밖으로 끌고 있는 중에 눌려도 표시를 풀고 한 번만 취소한다(뒤따르는 뗌은 취소 안 함)', () => {
  const a = harness('recording', true)
  a.hd.onPointerDown(a.ptr(CX, CY))
  a.hd.onPointerMove!(a.ptr(CX, CY + 200))
  a.log.length = 0
  a.hd.onKeyDown(a.key('Escape'))
  assert.deepEqual(a.log, ['prevent', 'set:false', 'out:false', 'cancel'])
  assert.equal(a.g.out, false)
  // Esc 로 취소되면 인식은 idle 로 — 그 뒤 손을 뗄 때(대기 상태 핸들러)는 취소를 또 부르지 않는다
  const after = harness('idle', true)
  after.hd.onPointerUp(after.ptr(CX, CY + 200))
  assert.deepEqual(after.log, ['release'])
})

test('밀어서 취소 모양 클래스는 cancelOutside 를 넘긴 버튼에만(기본 DOM 불변)', () => {
  const p = { phase: 'recording' as const, label: 'L', onPress: () => undefined, onRelease: () => undefined, onAbort: () => undefined }
  const plain = renderToStaticMarkup(h(PushToTalkButton, p))
  const ask = renderToStaticMarkup(h(PushToTalkButton, { ...p, cancelOutside: { onCancel: () => undefined } }))
  assert.doesNotMatch(plain, /data-\[out=true\]|ring-bad-soft|data-out/)
  assert.match(ask, /data-\[out=true\]:bg-surface2/)
  assert.match(ask, /group-data-\[out=true\]:ring-bad-soft/)
  assert.doesNotMatch(ask, /data-out=/, '밖이 아닐 때는 속성 없음')
})
