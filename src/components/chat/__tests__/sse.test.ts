import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSseParser, parseEventData, readSse, type SseEvent } from '../sse'

function collect(chunks: string[]): SseEvent[] {
  const out: SseEvent[] = []
  const p = createSseParser((e) => out.push(e))
  for (const c of chunks) p.push(c)
  p.end()
  return out
}

test('SSE: event/data 쌍을 빈 줄에서 흘려보내고 `: ping` 주석은 버린다', () => {
  const events = collect([': ping\n\nevent: accepted\ndata: {"userMessageId":"m_1"}\n\n: ping\n\nevent: done\ndata: {"a":1}\n\n'])
  assert.deepEqual(events, [
    { event: 'accepted', data: '{"userMessageId":"m_1"}' },
    { event: 'done', data: '{"a":1}' },
  ])
})

test('SSE: 청크가 줄 중간·\\r\\n 사이에서 잘려도 같은 결과', () => {
  const whole = 'event: status\r\ndata: {"stage":"LLM"}\r\n\r\nevent: done\r\ndata: {"x":"今日は😀"}\r\n\r\n'
  const expected = collect([whole])
  assert.equal(expected.length, 2)
  for (let cut = 1; cut < whole.length; cut++) {
    assert.deepEqual(collect([whole.slice(0, cut), whole.slice(cut)]), expected, `cut=${cut}`)
  }
})

test('SSE: 여러 data 줄은 \\n 으로 잇고, 이름 없는 이벤트는 message', () => {
  assert.deepEqual(collect(['data: a\ndata: b\n\n']), [{ event: 'message', data: 'a\nb' }])
})

test('SSE: 마지막 빈 줄 없이 끊긴 이벤트도 end() 에서 살린다', () => {
  assert.deepEqual(collect(['event: done\ndata: {"ok":true}']), [{ event: 'done', data: '{"ok":true}' }])
  assert.deepEqual(collect(['event: done\ndata: {"ok":true}\r']), [{ event: 'done', data: '{"ok":true}' }])
})

test('SSE: data 없는 이벤트는 흘려보내지 않는다', () => {
  assert.deepEqual(collect(['event: status\n\n']), [])
})

test('readSse: UTF-8 다바이트 문자가 바이트 청크 경계에서 잘려도 깨지지 않는다', async () => {
  const text = 'event: done\ndata: {"replyJa":"今日は😀楽しかった🎉"}\n\n'
  const bytes = new TextEncoder().encode(text)
  for (const size of [1, 2, 3, 5, 7]) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size))
        controller.close()
      },
    })
    const out: SseEvent[] = []
    await readSse(stream, (e) => out.push(e))
    assert.equal(out.length, 1, `size=${size}`)
    assert.deepEqual(parseEventData(out[0]), { replyJa: '今日は😀楽しかった🎉' })
  }
})

test('parseEventData: 깨진 JSON 은 null', () => {
  assert.equal(parseEventData({ event: 'done', data: '{oops' }), null)
})
