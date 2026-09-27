/**
 * 업로드 wav 헤더 판독(#21) — 길이는 클라이언트 보고값이 아니라 **파일에 실제로 있는 PCM 바이트**로 계산한다.
 * RIFF 청크를 순서대로 걷는다(data 앞의 LIST 등 부가 청크 허용).
 *  - data 크기가 실제보다 크게 적힌 파일(잘림)·스트리밍 자리표시(0 / 0xFFFFFFFF)는 **남은 바이트 전부**를 data 로 본다.
 *  - data 선언 크기 뒤에 바이트가 더 붙어 있으면 `trailingBytes` 로 알린다 — 저장은 버퍼 전체라, 선언 크기로만 길이를 재면
 *    60초 상한을 헤더 조작으로 넘길 수 있다(REV-013 M1). 업로드 경로는 이 값이 0 이 아니면 거부한다.
 */
export interface WavInfo {
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  dataOffset: number
  /** 파일에 실제로 있는 data 바이트(선언 크기와 남은 바이트 중 작은 쪽, 자리표시면 남은 바이트). */
  dataBytes: number
  /** data 선언 크기 뒤에 남은 바이트(패딩 1바이트 제외). 0 이 정상. */
  trailingBytes: number
  durationMs: number
}

const PCM = 1
const EXTENSIBLE = 0xfffe

export function parseWav(buf: Buffer): WavInfo | null {
  if (buf.length < 44) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let fmt: Omit<WavInfo, 'dataOffset' | 'dataBytes' | 'trailingBytes' | 'durationMs'> | null = null
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > buf.length) return null
      let audioFormat = buf.readUInt16LE(body)
      // WAVE_FORMAT_EXTENSIBLE 은 SubFormat GUID 앞 2바이트가 실제 포맷(1 = PCM).
      if (audioFormat === EXTENSIBLE && size >= 40 && body + 26 <= buf.length) audioFormat = buf.readUInt16LE(body + 24)
      fmt = { audioFormat, channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bitsPerSample: buf.readUInt16LE(body + 14) }
    } else if (id === 'data') {
      if (!fmt) return null
      const available = buf.length - body
      const placeholder = size === 0 || size === 0xffffffff
      const dataBytes = placeholder ? available : Math.min(size, available)
      const rest = placeholder ? 0 : Math.max(0, available - size)
      const trailingBytes = rest === 1 && size % 2 === 1 ? 0 : rest
      const bytesPerSec = (fmt.sampleRate * fmt.channels * fmt.bitsPerSample) / 8
      if (bytesPerSec <= 0) return null
      return { ...fmt, dataOffset: body, dataBytes, trailingBytes, durationMs: Math.round((dataBytes * 1000) / bytesPerSec) }
    }
    off = body + size + (size % 2)
  }
  return null
}

/** #21 이 받는 형식: PCM16 mono 16kHz. */
export function isPcm16Mono16k(w: WavInfo): boolean {
  return w.audioFormat === PCM && w.channels === 1 && w.sampleRate === 16_000 && w.bitsPerSample === 16
}
