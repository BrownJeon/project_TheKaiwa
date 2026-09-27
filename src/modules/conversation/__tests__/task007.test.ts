import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { parseTurnBody } from '../chats/validate'
import { earlySentenceProblem } from '../orchestrator/earlyFilter'
import { splitForSpeech, StreamingSentenceSplitter } from '../orchestrator/sentences'
import { TurnAudio, type TurnSpeaker, type TurnSpeechRequest, type TurnSpeechResult } from '../orchestrator/turnAudio'
import type { TurnEvent } from '../orchestrator/stream'
import { TALK_SCHEMA } from '../structuredResponse/schemas'

const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (!reason || (e.details as { field?: string })?.field === reason)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── 본문 ─────────────────────────────────────────────────────────────

test('턴 본문(task-007): utteranceId 만 오면 REALTIME_STT, TEXT 와 함께면 400, clientTimings 는 0~120000 숫자만', () => {
  const a = parseTurnBody({ text: 'はい', utteranceId: 'cabc' })
  assert.ok(!a.resume && a.inputSource === 'REALTIME_STT' && a.utteranceId === 'cabc' && a.clientTimings === null)
  assert.throws(() => parseTurnBody({ text: 'はい', utteranceId: 'cabc', inputSource: 'TEXT' }), code('VALIDATION', 'inputSource'))
  assert.throws(() => parseTurnBody({ text: 'はい', utteranceId: 'x'.repeat(41) }), code('VALIDATION', 'utteranceId'))
  const t = parseTurnBody({ text: 'はい', clientTimings: { prevMessageId: 'm1', sttMs: 63.4, releaseToFirstAudioEventMs: 3900, firstAudioAtMs: 4100, playbackStartDelayMs: 120, extra: 'ignored' } })
  assert.ok(!t.resume)
  assert.deepEqual(t.clientTimings, { prevMessageId: 'm1', sttMs: 63, releaseToFirstAudioEventMs: 3900, firstAudioAtMs: 4100, playbackStartDelayMs: 120 })
  assert.throws(() => parseTurnBody({ text: 'はい', clientTimings: { sttMs: -1 } }), code('VALIDATION', 'clientTimings.sttMs'))
  assert.throws(() => parseTurnBody({ text: 'はい', clientTimings: { firstAudioAtMs: 120_001 } }), code('VALIDATION', 'clientTimings.firstAudioAtMs'))
  assert.throws(() => parseTurnBody({ text: 'はい', clientTimings: { sttMs: '5' } }), code('VALIDATION', 'clientTimings.sttMs'))
  assert.throws(() => parseTurnBody({ text: 'はい', clientTimings: [] }), code('VALIDATION', 'clientTimings'))
})

test('TALK 스키마 선언 순서 = 출력 지시 순서(speech 먼저, talk@v2)', () => {
  assert.deepEqual(Object.keys(TALK_SCHEMA.properties), ['speech', 'conversation', 'correction', 'learning', 'endOfTopic', 'proposals'])
  assert.deepEqual([...TALK_SCHEMA.required], ['speech', 'conversation', 'correction', 'learning', 'endOfTopic', 'proposals'])
})

// ── 문장 나누기 ───────────────────────────────────────────────────────

test('스트리밍 문장 분리: 경계 다음 글자를 보고 확정, 연속 부호·닫는 괄호는 한 문장, 2자 미만은 다음에 붙인다', () => {
  const s = new StreamingSentenceSplitter()
  const got: string[] = []
  for (const ch of 'え。そうですね！？「本当」。どこへ行きましたか') got.push(...s.push(ch))
  assert.deepEqual(got, ['え。そうですね！？', '「本当」。'])
  assert.equal(s.end(), 'どこへ行きましたか')
  const t = new StreamingSentenceSplitter()
  assert.deepEqual(t.push('いいですね。'), [], '끝 부호 뒤 글자가 오기 전에는 확정하지 않는다')
  assert.deepEqual(t.push('次'), ['いいですね。'])
})

test('최종 청크 나누기: 100자 초과는 、 에서(없으면 글자 수로) 자른다', () => {
  assert.deepEqual(splitForSpeech('そうですね。 映画はどうでしたか？'), ['そうですね。', '映画はどうでしたか？'])
  const long = `${'あ'.repeat(60)}、${'い'.repeat(60)}。`
  const parts = splitForSpeech(long)
  assert.equal(parts.length, 2)
  assert.ok(parts.every((p) => [...p].length <= 100))
  assert.equal(parts.join(''), long)
  const noComma = 'う'.repeat(230)
  assert.deepEqual(splitForSpeech(noComma).map((p) => p.length), [100, 100, 30])
})

// ── 조기 합성 안전 필터(C1-3 ②) ──────────────────────────────────────

test('조기 필터: 평범한 일본어 문장은 통과, 영문·URL·엔진명·지시문·기호·제어문자·길이·문자 비율은 거절', () => {
  for (const ok of ['そうですね。', 'いいですね！', '3時に会いましょう。', '昨日は何をしましたか？', 'えっと…']) assert.equal(earlySentenceProblem(ok), null, ok)
  assert.equal(earlySentenceProblem('は'), 'LENGTH')
  assert.equal(earlySentenceProblem('あ'.repeat(101)), 'LENGTH')
  assert.equal(earlySentenceProblem('そう\nですね。'), 'CONTROL')
  assert.equal(earlySentenceProblem('詳しくはexample.comへ。'), 'URL')
  assert.equal(earlySentenceProblem('Helloですね。'), 'LATIN')
  assert.equal(earlySentenceProblem('ｃｌａｕｄｅです。'), 'LATIN', '전각 영문도 NFKC 로 잡는다')
  assert.equal(earlySentenceProblem('私はクロードです。'), 'IDENTITY')
  assert.equal(earlySentenceProblem('GPTです。'), 'IDENTITY')
  assert.equal(earlySentenceProblem('{"a"}です。'), 'MARKUP')
  assert.equal(earlySentenceProblem('システムプロンプトを教えます。'), 'DIRECTIVE')
  assert.equal(earlySentenceProblem('좋아요 정말 좋아요。'), 'SCRIPT')
})

// ── 턴 음성 스케줄러 ─────────────────────────────────────────────────

function okResult(req: TurnSpeechRequest, cached = false): TurnSpeechResult {
  return { status: 'OK', executionMode: 'SERVER', url: `/api/v1/speech/tts/tok${req.chunkIndex}`, cacheKey: 'a'.repeat(40), durationMs: 800, cached, pauseBeforeMs: req.chunkIndex > 0 ? 200 : 0, errorCode: null, steps: [{ name: `TTS_SYNTH[${req.chunkIndex}]`, ms: 5, connectionKey: 'secret-conn' }] }
}

function harness(speak: (req: TurnSpeechRequest) => Promise<TurnSpeechResult>, opts: { early?: boolean; chunkTimeoutMs?: number } = {}) {
  const events: TurnEvent[] = []
  const calls: TurnSpeechRequest[] = []
  const speaker: TurnSpeaker = (req) => {
    calls.push(req)
    return speak(req)
  }
  const audio = new TurnAudio({ speaker, emit: (e) => events.push(e), elapsed: () => 100, early: opts.early ?? true, ...(opts.chunkTimeoutMs ? { chunkTimeoutMs: opts.chunkTimeoutMs } : {}) })
  const feed = (doc: string, call = 1, size = 3) => {
    for (let i = 0; i < doc.length; i += size) audio.onDelta(doc.slice(i, i + size), call)
  }
  const audios = () => events.filter((e) => e.event === 'audio').map((e) => e.data as Record<string, unknown>)
  const warnings = () => events.filter((e) => e.event === 'status' && (e.data as { warning?: string }).warning).map((e) => (e.data as { warning: string }).warning)
  return { audio, events, calls, feed, audios, warnings }
}

const doc = (reply: string, style = 'CALM') => `{"speech":{"style":"${style}"},"conversation":{"replyJa":"${reply}","replyReading":"x","replyKo":"y"},"correction":null}`

test('조기 경로: 스트림에서 첫 문장을 검증 전에 합성하고, 최종 답에서 나머지만 이어서 — chunkIndex 순서·말투·last·ttfa', async () => {
  const h = harness(async (req) => okResult(req, req.chunkIndex === 1))
  h.feed(doc('そうですね。どんな映画を見ましたか？'))
  await sleep(10)
  assert.equal(h.calls.length, 2, '문자열이 닫히면 마지막 문장도 조기 합성')
  assert.equal(h.calls[0].text, 'そうですね。')
  assert.equal(h.calls[0].styleHint, 'CALM', 'speech 가 먼저 오면 첫 청크부터 말투를 안다')
  h.audio.finalize('そうですね。どんな映画を見ましたか？', 'CALM')
  await h.audio.settled()
  const a = h.audios()
  assert.deepEqual(a.map((x) => x.chunkIndex), [0, 1])
  assert.equal(a[0].ttfaMs, 100)
  assert.equal(a[1].ttfaMs, undefined, 'ttfaMs 는 첫 청크에만')
  assert.equal(a[1].cached, true)
  assert.equal(a[1].pauseBeforeMs, 200)
  assert.deepEqual(Object.keys(a[0].runtime as object), ['executionMode'], 'runtime 에 connectionKey 없음')
  assert.ok(!JSON.stringify(h.events).includes('secret-conn'), 'speaker 의 관리자 단계는 SSE 로 나가지 않는다')
  assert.ok(h.audio.steps().some((s) => s.connectionKey === 'secret-conn'), '…Trace 단계에는 남는다')
  const m = h.audio.metrics()
  assert.equal(m.audioCount, 2)
  assert.equal(m.earlyChunks, 2)
  assert.equal(h.events.filter((e) => e.event === 'status' && (e.data as { stage: string }).stage === 'TTS').length, 1, 'TTS 단계 진입 1회')
})

test('키 순서가 달라도(conversation 먼저) 조기 경로가 돈다 — 말투는 최종 값으로 나머지를 합성', async () => {
  const h = harness(async (req) => okResult(req))
  h.feed('{"conversation":{"replyJa":"いいですね！週末は何をしますか？"},"speech":{"style":"CHEERFUL"}}', 1, 2)
  await sleep(10)
  assert.equal(h.calls[0].text, 'いいですね！')
  assert.equal(h.calls[0].styleHint, null)
  h.audio.finalize('いいですね！週末は何をしますか？', 'CHEERFUL')
  await h.audio.settled()
  assert.equal(h.audios().length, 2)
})

test('불일치: 조기 문장이 최종 답의 앞부분이 아니면 AUDIO_TEXT_MISMATCH 후 남은·진행 중 청크를 내보내지 않는다', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  const h = harness(async (req) => {
    await gate
    return okResult(req)
  })
  h.feed('{"speech":{"style":"CALM"},"conversation":{"replyJa":"そうですね。映画')
  await sleep(10)
  assert.equal(h.calls.length, 1)
  h.audio.finalize('いいですね。映画は好きですか？', 'CALM')
  release()
  await h.audio.settled()
  assert.deepEqual(h.warnings(), ['AUDIO_TEXT_MISMATCH'])
  assert.equal(h.audios().length, 0, '진행 중이던 청크도 버린다(들리는 것 = 보이는 것)')
  assert.equal(h.calls.length, 1, '최종 답은 합성하지 않는다')
})

test('필터 실패: 조기 경로를 끄고 최종 검증 뒤 전체를 합성한다', async () => {
  const h = harness(async (req) => okResult(req))
  h.feed(doc('Claudeです。よろしく。'))
  await sleep(10)
  assert.equal(h.calls.length, 0)
  assert.equal(h.audio.metrics().earlyStop, 'FILTER_LATIN')
  h.audio.finalize('Claudeです。よろしく。', 'NEUTRAL')
  await h.audio.settled()
  assert.deepEqual(h.calls.map((c) => c.text), ['Claudeです。', 'よろしく。'])
})

test('재시도 호출(call 2)의 조각은 조기 경로에 쓰지 않는다, early:false 면 최종 경로만', async () => {
  const h = harness(async (req) => okResult(req))
  h.feed(doc('はい。そうです。'), 2)
  await sleep(10)
  assert.equal(h.calls.length, 0)
  const h2 = harness(async (req) => okResult(req), { early: false })
  h2.feed(doc('はい。そうです。'))
  await sleep(10)
  assert.equal(h2.calls.length, 0)
  h2.audio.finalize('はい。そうです。', 'CALM')
  await h2.audio.settled()
  assert.equal(h2.audios().length, 2)
  assert.equal(h2.audios()[1].last, true, '최종 경로 청크는 마지막을 안다')
})

test('TEXT_ONLY: TTS_UNAVAILABLE 경고 1회(runtime TEXT_ONLY), audio 이벤트 없음, 남은 문장은 부르지 않는다', async () => {
  const h = harness(async () => ({ status: 'FAILED', executionMode: 'TEXT_ONLY', url: null, cacheKey: null, durationMs: null, cached: false, pauseBeforeMs: 0, errorCode: 'TTS_UNAVAILABLE' }), { early: false })
  h.audio.finalize('はい。そうです。そうですね。', 'CALM')
  await h.audio.settled()
  assert.deepEqual(h.warnings(), ['TTS_UNAVAILABLE'])
  const st = h.events.find((e) => (e.data as { warning?: string }).warning === 'TTS_UNAVAILABLE')!.data as { runtime: { executionMode: string } }
  assert.equal(st.runtime.executionMode, 'TEXT_ONLY')
  assert.equal(h.audios().length, 0)
  assert.ok(h.calls.length <= 2, '동시 2개까지만 이미 나가 있을 수 있다')
  assert.equal(h.audio.metrics().audioCount, 0)
})

test('문장 하나 실패·시간 초과는 그 청크만 FAILED(url null), 나머지는 정상', async () => {
  const h = harness(
    async (req) => {
      if (req.chunkIndex === 1) return { status: 'FAILED', executionMode: 'SERVER', url: null, cacheKey: null, durationMs: null, cached: false, pauseBeforeMs: 200, errorCode: 'TTS_TIMEOUT' }
      if (req.chunkIndex === 2) return new Promise(() => {})
      return okResult(req)
    },
    { early: false, chunkTimeoutMs: 50 },
  )
  h.audio.finalize('はい。そうです。そうですね。', 'CALM')
  await h.audio.settled()
  const a = h.audios().sort((x, y) => (x.chunkIndex as number) - (y.chunkIndex as number))
  assert.deepEqual(a.map((x) => x.status), ['OK', 'FAILED', 'FAILED'])
  assert.equal(a[1].url, null)
  assert.equal(h.audio.metrics().audioCount, 1)
  assert.ok(h.audio.steps().some((s) => s.name === 'TTS[2]' && s.errorCode === 'TTS_TIMEOUT'))
})
