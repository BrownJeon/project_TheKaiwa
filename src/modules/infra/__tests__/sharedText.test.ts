import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { consumeSharedText, onSharedText, peekSharedText, SHARED_TEXT_MAX_CODE_POINTS } from '../native'

/**
 * task-052 — 공유 글 브리지(`infra/native/sharedText.ts`). 네이티브 `SharedText` 플러그인 계약:
 * peek() → { available } · consume() → { text, truncated } | {} (한 번만) · 이벤트 'sharedText' → {}(본문 없음).
 */
const g = globalThis as { window?: unknown }

type Fn = () => void

function fakeApp(opts: { native?: boolean; plugin?: Record<string, unknown> | null } = {}) {
  const listeners = new Set<Fn>()
  const removed: Fn[] = []
  let held: { text: string; truncated: boolean } | null = null
  const plugin = {
    peek: () => Promise.resolve({ available: held !== null }),
    consume: () => {
      const s = held
      held = null
      return Promise.resolve(s ? { ...s } : {})
    },
    addListener: (event: string, fn: Fn) => {
      assert.equal(event, 'sharedText')
      listeners.add(fn)
      return Promise.resolve({ remove: () => void (listeners.delete(fn), removed.push(fn)) })
    },
    ...(opts.plugin ?? {}),
  }
  g.window = {
    Capacitor: {
      isNativePlatform: () => opts.native !== false,
      Plugins: opts.plugin === null ? {} : { SharedText: plugin },
    },
  }
  return {
    share(text: string, truncated = false) {
      held = { text, truncated }
    },
    emit(...args: unknown[]) {
      for (const fn of [...listeners]) (fn as (...a: unknown[]) => void)(...args)
    },
    listeners,
    removed,
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  delete g.window
})

test('앱 아님(window 없음·브라우저) → false · null · 빈 해제', async () => {
  delete g.window
  assert.equal(await peekSharedText(), false)
  assert.equal(await consumeSharedText(), null)
  const off = onSharedText(() => assert.fail('불리면 안 됨'))
  assert.equal(typeof off, 'function')
  off()

  const app = fakeApp({ native: false })
  app.share('こんにちは')
  assert.equal(await peekSharedText(), false, '브라우저에 Capacitor 전역이 있어도 앱이 아니면 no-op')
  assert.equal(await consumeSharedText(), null)
  onSharedText(() => assert.fail('불리면 안 됨'))()
  assert.equal(app.listeners.size, 0)
})

test('플러그인 없는 예전 APK(1.0.2) → false · null · 빈 해제', async () => {
  fakeApp({ plugin: null })
  assert.equal(await peekSharedText(), false)
  assert.equal(await consumeSharedText(), null)
  onSharedText(() => {})()
})

test('정상: peek 은 비우지 않고 consume 은 한 번만', async () => {
  const app = fakeApp()
  assert.equal(await peekSharedText(), false)
  assert.equal(await consumeSharedText(), null)
  app.share('今日の表現：お疲れさまです。')
  assert.equal(await peekSharedText(), true)
  assert.equal(await peekSharedText(), true, 'peek 은 비우지 않는다')
  assert.deepEqual(await consumeSharedText(), { text: '今日の表現：お疲れさまです。', truncated: false })
  assert.equal(await consumeSharedText(), null, '두 번째는 null')
  assert.equal(await peekSharedText(), false)
})

test('빈·공백뿐인 공유도 「도착함」: peek true → consume {text:"", truncated:false} 한 번 → 두 번째 null (D5)', async () => {
  const app = fakeApp()
  for (const raw of ['', '   ', ' \n\t', '　 ']) {
    app.share(raw)
    assert.equal(await peekSharedText(), true, JSON.stringify(raw))
    assert.deepEqual(await consumeSharedText(), { text: '', truncated: false }, JSON.stringify(raw))
    assert.equal(await consumeSharedText(), null)
    assert.equal(await peekSharedText(), false)
  }
})

test('SSR·루트 레이아웃 안전: window 없이 import·호출해도 부작용 없음', async () => {
  delete g.window
  const before = Object.keys(globalThis).sort()
  const mod = await import('../native/sharedText')
  assert.equal(await mod.peekSharedText(), false)
  assert.equal(await mod.consumeSharedText(), null)
  mod.onSharedText(() => assert.fail('불리면 안 됨'))()
  assert.deepEqual(Object.keys(globalThis).sort(), before, '전역을 만들지 않는다')
  assert.equal('window' in globalThis, false)

  g.window = {}
  assert.equal(await mod.peekSharedText(), false, 'Capacitor 없는 일반 브라우저')
  assert.equal(await mod.consumeSharedText(), null)
  mod.onSharedText(() => {})()
})

test('truncated 는 네이티브 값을 넘기고, 상한을 넘겨 오면 코드포인트 기준으로 한 번 더 자른다', async () => {
  const app = fakeApp()
  app.share('あ'.repeat(100), true)
  assert.deepEqual(await consumeSharedText(), { text: 'あ'.repeat(100), truncated: true })

  const emoji = '😀'
  app.share(emoji.repeat(SHARED_TEXT_MAX_CODE_POINTS))
  const exact = await consumeSharedText()
  assert.equal(exact?.truncated, false, '10,000 코드포인트(20,000 UTF-16)는 자르지 않음')
  assert.equal(exact?.text.length, SHARED_TEXT_MAX_CODE_POINTS * 2)

  app.share('a' + emoji.repeat(SHARED_TEXT_MAX_CODE_POINTS))
  const over = await consumeSharedText()
  assert.equal(over?.truncated, true)
  assert.equal([...(over?.text ?? '')].length, SHARED_TEXT_MAX_CODE_POINTS)
  assert.ok(!/[\uD800-\uDBFF]$/.test(over?.text ?? ''), '반쪽 서로게이트로 끝나지 않음')
})

test('형식이 다른 응답 → null / false', async () => {
  fakeApp({ plugin: { consume: () => Promise.resolve({ text: 123 }), peek: () => Promise.resolve({ available: 'yes' }) } })
  assert.equal(await consumeSharedText(), null)
  assert.equal(await peekSharedText(), false)
  fakeApp({ plugin: { consume: () => Promise.resolve(null), peek: () => Promise.resolve(undefined) } })
  assert.equal(await consumeSharedText(), null)
  assert.equal(await peekSharedText(), false)
})

test('플러그인 오류 → 던지지 않고 false · null · 빈 해제', async () => {
  const boom = () => Promise.reject(Object.assign(new Error('fake'), { code: 'UNAVAILABLE' }))
  fakeApp({
    plugin: {
      peek: boom,
      consume: boom,
      addListener: () => {
        throw new Error('no listener')
      },
    },
  })
  assert.equal(await peekSharedText(), false)
  assert.equal(await consumeSharedText(), null)
  const off = onSharedText(() => {})
  assert.doesNotThrow(off)

  fakeApp({ plugin: { addListener: () => Promise.reject(new Error('late')) } })
  const off2 = onSharedText(() => {})
  await tick()
  assert.doesNotThrow(off2)
})

test('onSharedText: 신호에 본문 없음 · 해제 뒤로는 안 불림 · 핸들 도착 전 해제도 지운다', async () => {
  const app = fakeApp()
  const got: unknown[][] = []
  const off = onSharedText((...args: unknown[]) => got.push(args))
  await tick()
  app.emit({ text: '本文が載っても渡さない' })
  assert.deepEqual(got, [[]], '콜백은 인자 없이')
  off()
  assert.equal(app.removed.length, 1)
  app.emit()
  assert.equal(got.length, 1)

  const early = onSharedText(() => assert.fail('불리면 안 됨'))
  early()
  await tick()
  assert.equal(app.removed.length, 2, '핸들이 늦게 와도 지운다')
  assert.equal(app.listeners.size, 0)
})
