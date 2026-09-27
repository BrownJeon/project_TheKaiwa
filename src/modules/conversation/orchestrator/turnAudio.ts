/**
 * TALK 턴의 문장 음성 스케줄러(task-007 K2-2·K3) — conversation 은 speech 를 모른다. 합성은 라우트가 speech 로 구현해
 * 넘긴 `TurnSpeaker` 가 하고, 여기서는 **어떤 문장을 언제 몇 번째 청크로** 보낼지와 SSE `audio`/`status` 이벤트만 정한다.
 *
 * 두 경로:
 *  ① 조기(early): LLM 스트림 조각 → 경로 인식 JSON 리더(`conversation.replyJa`·`speech.style` 만) → 문장 분리 → 안전 필터 →
 *     통과 문장부터 바로 합성. 첫 LLM 호출의 조각만 쓴다(재시도·폴백 호출은 조기 경로에 쓰지 않는다).
 *     리더 문법 오류·필터 실패면 조기 경로를 끈다(이미 보낸 문장은 그대로, 나머지는 최종 경로).
 *  ② 최종(final): 검증을 통과한 replyJa 에서 이미 보낸 문장들을 **앞부분 일치**로 떼고 나머지를 나눠 합성.
 *     앞부분이 맞지 않으면(재시도로 답이 바뀜) 남은 청크를 멈추고 `status{TTS, warning:AUDIO_TEXT_MISMATCH}` —
 *     이후 도착하는 청크 이벤트도 버린다(클라는 재생을 끊고 최종 텍스트만 보인다).
 *
 * 청크: `chunkIndex` 0 부터, 동시 2개, 청크당 9초(합성 8초 + 준비) 상한. 실패는 그 청크만 `audio{status:FAILED}`.
 * TTS 를 쓸 수 없으면(TEXT_ONLY) `status{TTS, warning:TTS_UNAVAILABLE}` 1회 후 남은 청크는 부르지 않는다(audio 이벤트 없음).
 * 이벤트·Trace 에 엔진명·connection 키가 없다(speaker 결과의 `steps` 는 관리자 Trace 전용 — SSE 로 나가지 않는다).
 */
import { createJsonPathStreamReader, type JsonPathStreamReader, type TraceStep } from '@/modules/engine'
import { SPEECH_STYLES, type SpeechStyle } from '../structuredResponse/schemas'
import { earlySentenceProblem } from './earlyFilter'
import { splitForSpeech, StreamingSentenceSplitter } from './sentences'
import type { TurnEvent } from './stream'

export interface TurnSpeechRequest {
  chunkIndex: number
  /** 원문 문장(정규화 전). */
  text: string
  /** LLM `speech.style` — Parameter Resolver 5순위 입력일 뿐이다. 아직 모르면 null. */
  styleHint: SpeechStyle | null
  /** 직전 청크 오디오 길이(알면) — SHADOWING 같은 "직전 길이만큼 쉼" 프로필용. */
  previousDurationMs: number | null
}

export interface TurnSpeechResult {
  status: 'OK' | 'FAILED'
  /** TEXT_ONLY = 서버 TTS 를 쓸 수 없음(이 턴의 나머지 청크도 부르지 않는다). */
  executionMode: 'SERVER' | 'TEXT_ONLY'
  url: string | null
  cacheKey: string | null
  durationMs: number | null
  cached: boolean
  pauseBeforeMs: number
  errorCode: string | null
  /** 관리자 Trace 용 하위 단계(허용 meta 만). */
  steps?: TraceStep[]
}

export type TurnSpeaker = (req: TurnSpeechRequest) => Promise<TurnSpeechResult>

export interface TurnAudioOptions {
  speaker: TurnSpeaker
  emit: (e: TurnEvent) => void
  /** 턴 시작(요청 수신)부터 경과 ms. */
  elapsed: () => number
  /** 조기 경로 허용(스트림 조각이 오지 않으면 자연히 최종 경로만 돈다). */
  early: boolean
  concurrency?: number
  chunkTimeoutMs?: number
}

export const TURN_AUDIO_CONCURRENCY = 2
export const TURN_CHUNK_TIMEOUT_MS = 9_000

interface Job {
  index: number
  text: string
  early: boolean
}

export interface TurnAudioMetrics {
  chunks: number
  earlyChunks: number
  audioCount: number
  failedCount: number
  /** 턴 시작 → 첫 문장이 스트림에서 확정된 시각(조기 경로). */
  firstSentenceMs: number | null
  /** 턴 시작 → 첫 청크 합성 시작. */
  ttsStartMs: number | null
  /** 턴 시작 → 청크 0 오디오 준비(서버 기준 첫 음성). */
  ttfaMs: number | null
  /** 청크 0 합성 시작 → 준비(speech-platform/16 §6.4 ttfaServerMs). */
  ttfaServerMs: number | null
  earlyStop: string | null
  mismatch: boolean
  textOnly: boolean
}

function isStyle(v: unknown): v is SpeechStyle {
  return typeof v === 'string' && (SPEECH_STYLES as readonly string[]).includes(v)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('chunk timeout'), { code: 'TTS_TIMEOUT' })), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export class TurnAudio {
  private readonly o: Required<Omit<TurnAudioOptions, 'early'>> & { early: boolean }
  private readonly reader: JsonPathStreamReader
  private readonly splitter = new StreamingSentenceSplitter()
  private earlyOn: boolean
  private replyDone = false
  private readonly earlyTexts: string[] = []
  private streamStyle: SpeechStyle | null = null
  private finalStyle: SpeechStyle | null = null
  private readonly queue: Job[] = []
  private running = 0
  private nextIndex = 0
  private total: number | null = null
  private readonly durations = new Map<number, number>()
  private readonly traceSteps: TraceStep[] = []
  private readonly m: TurnAudioMetrics = {
    chunks: 0,
    earlyChunks: 0,
    audioCount: 0,
    failedCount: 0,
    firstSentenceMs: null,
    ttsStartMs: null,
    ttfaMs: null,
    ttfaServerMs: null,
    earlyStop: null,
    mismatch: false,
    textOnly: false,
  }
  private resolveSettled: (() => void) | null = null
  private readonly settledPromise: Promise<void>

  constructor(opts: TurnAudioOptions) {
    this.o = { concurrency: TURN_AUDIO_CONCURRENCY, chunkTimeoutMs: TURN_CHUNK_TIMEOUT_MS, ...opts }
    this.earlyOn = opts.early
    this.settledPromise = new Promise((r) => (this.resolveSettled = r))
    this.reader = createJsonPathStreamReader([
      { path: ['speech', 'style'], onComplete: (v) => (this.streamStyle = isStyle(v) ? v : null) },
      { path: ['conversation', 'replyJa'], onChunk: (t) => this.onReplyChunk(t), onComplete: () => this.onReplyComplete() },
    ])
  }

  /** LLM 스트림 조각(`call` = 이 요청 안의 몇 번째 LLM 호출). 첫 호출만 쓴다. */
  onDelta(delta: string, call: number): void {
    if (!this.earlyOn || this.total !== null) return
    if (call !== 1) {
      this.stopEarly('RETRY')
      return
    }
    this.reader.push(delta)
    if (this.reader.failed) this.stopEarly('PARSE')
  }

  private stopEarly(reason: string): void {
    if (!this.earlyOn) return
    this.earlyOn = false
    this.m.earlyStop = reason
  }

  private onReplyChunk(text: string): void {
    if (this.replyDone) return
    for (const s of this.splitter.push(text)) this.earlySentence(s)
  }

  private onReplyComplete(): void {
    if (this.replyDone) return
    const rest = this.splitter.end()
    if (rest) this.earlySentence(rest)
    // 같은 경로가 또 나와도(중복 키) 첫 값만 쓴다 — 최종 대조(앞부분 일치)가 정리한다.
    this.replyDone = true
  }

  private earlySentence(s: string): void {
    if (!this.earlyOn) return
    const problem = earlySentenceProblem(s)
    if (problem) {
      this.stopEarly(`FILTER_${problem}`)
      return
    }
    if (this.m.firstSentenceMs === null) this.m.firstSentenceMs = Math.round(this.o.elapsed())
    this.earlyTexts.push(s)
    this.m.earlyChunks++
    this.enqueue(s, true)
  }

  /**
   * 검증을 통과한 최종 답. 조기 경로를 닫고, 이미 보낸 문장들이 최종 replyJa 의 앞부분이면 나머지를 합성한다.
   * 한 번만 부른다. 호출 뒤 `settled()` 가 모든 청크가 끝날 때 풀린다.
   */
  finalize(replyJa: string, style: SpeechStyle | null): void {
    if (this.total !== null) return
    this.earlyOn = false
    this.finalStyle = isStyle(style) ? style : null
    const sent = this.earlyTexts
    let offset = 0
    let aligned = true
    for (const s of sent) {
      const at = replyJa.indexOf(s, offset)
      // 앞부분 일치 — 보낸 문장 사이에는 공백만 허용한다.
      if (at < 0 || replyJa.slice(offset, at).trim() !== '') {
        aligned = false
        break
      }
      offset = at + s.length
    }
    if (!aligned) {
      this.m.mismatch = true
      this.queue.length = 0
      this.o.emit({ event: 'status', data: { stage: 'TTS', elapsedMs: Math.round(this.o.elapsed()), warning: 'AUDIO_TEXT_MISMATCH' } })
      this.total = this.nextIndex
      this.checkSettled()
      return
    }
    for (const p of splitForSpeech(replyJa.slice(offset))) this.enqueue(p, false)
    this.total = this.nextIndex
    this.checkSettled()
  }

  settled(): Promise<void> {
    return this.settledPromise
  }

  metrics(): TurnAudioMetrics {
    return { ...this.m, chunks: this.nextIndex }
  }

  steps(): TraceStep[] {
    return [...this.traceSteps]
  }

  private enqueue(text: string, early: boolean): void {
    this.queue.push({ index: this.nextIndex++, text, early })
    this.pump()
  }

  private pump(): void {
    while (this.running < this.o.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!
      this.running++
      void this.run(job).finally(() => {
        this.running--
        this.pump()
        this.checkSettled()
      })
    }
  }

  private checkSettled(): void {
    if (this.total !== null && this.running === 0 && this.queue.length === 0) this.resolveSettled?.()
  }

  private async run(job: Job): Promise<void> {
    if (this.m.textOnly || this.m.mismatch) return
    if (this.m.ttsStartMs === null) {
      this.m.ttsStartMs = Math.round(this.o.elapsed())
      this.o.emit({ event: 'status', data: { stage: 'TTS', elapsedMs: this.m.ttsStartMs } })
    }
    const t0 = performance.now()
    let r: TurnSpeechResult
    try {
      r = await withTimeout(
        this.o.speaker({
          chunkIndex: job.index,
          text: job.text,
          styleHint: this.finalStyle ?? this.streamStyle,
          previousDurationMs: this.durations.get(job.index - 1) ?? null,
        }),
        this.o.chunkTimeoutMs,
      )
    } catch (e) {
      const code = (e as { code?: unknown })?.code === 'TTS_TIMEOUT' ? 'TTS_TIMEOUT' : 'TTS_ERROR'
      r = { status: 'FAILED', executionMode: 'SERVER', url: null, cacheKey: null, durationMs: null, cached: false, pauseBeforeMs: 0, errorCode: code }
    }
    const ms = Math.round(performance.now() - t0)
    const stepMeta = { chunkIndex: job.index, early: job.early, cacheHit: r.cached, status: r.status, errorCode: r.errorCode }
    if (r.steps) this.traceSteps.push(...r.steps)
    if (r.executionMode === 'TEXT_ONLY') {
      this.traceSteps.push({ name: `TTS[${job.index}]`, ms, ...stepMeta, status: 'SKIPPED' })
      if (!this.m.textOnly && !this.m.mismatch) {
        this.m.textOnly = true
        this.queue.length = 0
        this.o.emit({ event: 'status', data: { stage: 'TTS', elapsedMs: Math.round(this.o.elapsed()), warning: 'TTS_UNAVAILABLE', runtime: { executionMode: 'TEXT_ONLY' } } })
      }
      return
    }
    const ok = r.status === 'OK'
    if (job.index === 0 && ok) {
      this.m.ttfaServerMs = ms
      this.m.ttfaMs = Math.round(this.o.elapsed())
    }
    this.traceSteps.push({ name: `TTS[${job.index}]`, ms, ...stepMeta, ...(job.index === 0 && ok ? { ttfaServerMs: ms } : {}) })
    if (ok && r.durationMs !== null) this.durations.set(job.index, r.durationMs)
    // 불일치·자막 전환 뒤에 끝난 청크는 내보내지 않는다(합성 결과는 캐시에만 남는다 — 들리는 것 = 보이는 것).
    if (this.m.mismatch || this.m.textOnly) return
    if (ok) this.m.audioCount++
    else this.m.failedCount++
    this.o.emit({
      event: 'audio',
      data: {
        chunkIndex: job.index,
        text: job.text,
        url: ok ? r.url : null,
        cacheKey: ok ? r.cacheKey : null,
        durationMs: ok ? r.durationMs : null,
        cached: ok ? r.cached : false,
        pauseBeforeMs: r.pauseBeforeMs,
        last: this.total !== null && job.index === this.total - 1,
        ...(job.index === 0 ? { ttfaMs: ok ? this.m.ttfaMs : null } : {}),
        runtime: { executionMode: 'SERVER' },
        status: r.status,
      },
    })
  }
}
