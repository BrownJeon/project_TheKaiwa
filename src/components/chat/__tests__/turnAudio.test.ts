import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TurnAudioEvent, TurnDoneEvent } from '@/types/chat'
import { correctionFromDone } from '../messages'
import { parseEventData, readSse, type SseEvent } from '../sse'

/** 바이트 스트림을 임의 위치(UTF-8 다바이트 문자 중간 포함)에서 잘라 흘린다. */
function streamOf(text: string, cut: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, cut))
      c.enqueue(bytes.slice(cut))
      c.close()
    },
  })
}

const TURN =
  'event: accepted\ndata: {"userMessageId":"m_u","assistantMessageId":"m_a"}\n\n' +
  'event: status\ndata: {"stage":"LLM","elapsedMs":10}\n\n' +
  'event: audio\ndata: {"chunkIndex":1,"text":"何を見ましたか？","url":"/api/v1/speech/tts/t1","durationMs":900,"cached":true,"pauseBeforeMs":250,"last":true,"runtime":{"executionMode":"SERVER"},"status":"OK"}\n\n' +
  'event: audio\ndata: {"chunkIndex":0,"text":"そうですか。","url":"/api/v1/speech/tts/t0","durationMs":700,"cached":false,"pauseBeforeMs":0,"last":false,"ttfaMs":640,"runtime":{"executionMode":"SERVER"},"status":"OK"}\n\n' +
  'event: status\ndata: {"stage":"TTS","warning":"AUDIO_TEXT_MISMATCH"}\n\n' +
  'event: done\ndata: {"userMessageId":"m_u","assistantMessageId":"m_a","conversation":{"replyJa":"そうですか。何を見ましたか？"},"audioCount":2}\n\n'

test('턴 SSE: audio 이벤트가 UTF-8 경계에서 잘려도 순서·필드 그대로(chunkIndex 뒤바뀜은 큐가 정렬)', async () => {
  const whole = new TextEncoder().encode(TURN).length
  for (const cut of [1, 57, 180, 181, 182, 300, whole - 3]) {
    const events: SseEvent[] = []
    await readSse(streamOf(TURN, cut), (e) => events.push(e))
    assert.deepEqual(
      events.map((e) => e.event),
      ['accepted', 'status', 'audio', 'audio', 'status', 'done'],
      `cut=${cut}`,
    )
    const a1 = parseEventData<TurnAudioEvent>(events[2])
    const a0 = parseEventData<TurnAudioEvent>(events[3])
    assert.equal(a1?.chunkIndex, 1)
    assert.equal(a1?.text, '何を見ましたか？')
    assert.equal(a1?.cached, true)
    assert.equal(a1?.pauseBeforeMs, 250)
    assert.equal(a1?.last, true)
    assert.equal(a0?.chunkIndex, 0)
    assert.equal(a0?.status, 'OK')
    assert.equal(parseEventData<{ warning?: string }>(events[4])?.warning, 'AUDIO_TEXT_MISMATCH')
    assert.equal(parseEventData<TurnDoneEvent>(events[5])?.audioCount, 2)
  }
})

test('턴 done.correction → #29 교정 모양(required 버림·explanationKo → explanation·기본 PROPOSED)', () => {
  const c = correctionFromDone({
    id: 'cr_1',
    required: true,
    original: '昨日映画を見に行くました',
    corrected: '昨日映画を見に行きました',
    explanationKo: '「行くました」가 아니라 「行きました」',
    errorType: 'CONJUGATION',
    severity: 'MINOR',
    chunkType: 'ACTION',
  })
  assert.deepEqual(c, {
    id: 'cr_1',
    status: 'PROPOSED',
    original: '昨日映画を見に行くました',
    corrected: '昨日映画を見に行きました',
    explanation: '「行くました」가 아니라 「行きました」',
    errorType: 'CONJUGATION',
    severity: 'MINOR',
    chunkType: 'ACTION',
  })
  assert.ok(!('required' in c))
  assert.equal(correctionFromDone({ id: 'x', original: 'a', corrected: 'b', errorType: 'OTHER', severity: 'MAJOR' }).chunkType, null)
})
