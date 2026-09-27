/**
 * 마이크 샘플 → gateway 프레임(PCM16LE mono 16kHz, 40ms = 640샘플 = 1,280바이트) — 순수 계산(테스트 가능).
 *
 * 다운샘플은 출력 한 샘플이 덮는 입력 구간의 **평균**(상자 필터)이다. 48kHz→16kHz 에서는 3샘플 평균이라
 * 8kHz 위 성분이 크게 줄어 접힘이 약하다 — 음성 인식에는 충분하고, 청크 경계를 넘어 상태를 이어 가므로 끊김이 없다.
 * 브라우저가 16kHz AudioContext 를 받아 주면 비율 1 이라 변환만 한다.
 */
export const TARGET_RATE = 16_000
export const FRAME_SAMPLES = 640

function toInt16(s: number): number {
  const c = s > 1 ? 1 : s < -1 ? -1 : s
  return c < 0 ? Math.round(c * 0x8000) : Math.round(c * 0x7fff)
}

export class Downsampler {
  private readonly ratio: number
  private acc = 0
  private cnt = 0
  private inIndex = 0
  private outIndex = 0
  private nextBoundary: number

  constructor(readonly inputRate: number) {
    if (!Number.isFinite(inputRate) || inputRate < TARGET_RATE) throw new Error(`지원하지 않는 입력 샘플레이트 ${inputRate}`)
    this.ratio = inputRate / TARGET_RATE
    this.nextBoundary = this.ratio
  }

  process(input: Float32Array): Int16Array {
    if (this.ratio === 1) {
      const out = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) out[i] = toInt16(input[i])
      return out
    }
    const out = new Int16Array(Math.ceil(input.length / this.ratio) + 1)
    let n = 0
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i]
      this.cnt++
      this.inIndex++
      if (this.inIndex >= this.nextBoundary) {
        out[n++] = toInt16(this.acc / this.cnt)
        this.acc = 0
        this.cnt = 0
        this.outIndex++
        this.nextBoundary = (this.outIndex + 1) * this.ratio
      }
    }
    return out.subarray(0, n)
  }
}

/** 16kHz Int16 → 정확히 640샘플 프레임(ArrayBuffer 1,280바이트, 리틀엔디언 — Int16Array 는 플랫폼 엔디언이며 대상 기기는 모두 LE). */
export class FrameChunker {
  private buf = new Int16Array(FRAME_SAMPLES)
  private n = 0

  push(samples: Int16Array, emit: (frame: ArrayBuffer) => void): void {
    let i = 0
    while (i < samples.length) {
      const take = Math.min(FRAME_SAMPLES - this.n, samples.length - i)
      this.buf.set(samples.subarray(i, i + take), this.n)
      this.n += take
      i += take
      if (this.n === FRAME_SAMPLES) {
        emit(this.buf.buffer.slice(0))
        this.n = 0
      }
    }
  }

  /** 남은 샘플을 무음으로 채워 마지막 프레임을 낸다(gateway 는 1,280바이트가 아닌 프레임을 버린다). */
  flush(emit: (frame: ArrayBuffer) => void): void {
    if (this.n === 0) return
    this.buf.fill(0, this.n)
    emit(this.buf.buffer.slice(0))
    this.n = 0
  }

  reset(): void {
    this.n = 0
  }
}

export const SILENCE_DB = -100

/** RMS → dBFS(무음 −100). */
export function rmsDb(sumSquares: number, count: number): number {
  if (count <= 0 || sumSquares <= 0) return SILENCE_DB
  const db = 20 * Math.log10(Math.sqrt(sumSquares / count))
  return Number.isFinite(db) ? Math.max(SILENCE_DB, Math.round(db * 10) / 10) : SILENCE_DB
}

/** 약 100ms 마다 레벨(dBFS)을 낸다(화면 레벨 미터 ≈10Hz). */
export class LevelMeter {
  private sum = 0
  private cnt = 0
  private readonly window: number

  constructor(inputRate: number, windowMs = 100) {
    this.window = Math.max(1, Math.round((inputRate * windowMs) / 1000))
  }

  push(input: Float32Array, emit: (db: number) => void): void {
    for (let i = 0; i < input.length; i++) {
      this.sum += input[i] * input[i]
      if (++this.cnt >= this.window) {
        emit(rmsDb(this.sum, this.cnt))
        this.sum = 0
        this.cnt = 0
      }
    }
  }
}
