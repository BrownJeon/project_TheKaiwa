/**
 * 업로드 wav 헤더 판독(#21) — 길이는 클라이언트 보고값이 아니라 **헤더의 data 청크 크기**로 계산한다.
 * RIFF 청크를 순서대로 걷는다(LIST 등 부가 청크 허용). data 크기가 실제보다 크게 적힌 스트리밍 파일은 남은 바이트로 자른다.
 */
export interface WavInfo {
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  dataOffset: number
  dataBytes: number
  durationMs: number
}

const PCM = 1
const EXTENSIBLE = 0xfffe

export function parseWav(buf: Buffer): WavInfo | null {
  if (buf.length < 44) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let fmt: Omit<WavInfo, 'dataOffset' | 'dataBytes' | 'durationMs'> | null = null
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
      const dataBytes = Math.min(size, buf.length - body)
      const bytesPerSec = (fmt.sampleRate * fmt.channels * fmt.bitsPerSample) / 8
      if (bytesPerSec <= 0) return null
      return { ...fmt, dataOffset: body, dataBytes, durationMs: Math.round((dataBytes * 1000) / bytesPerSec) }
    }
    off = body + size + (size % 2)
  }
  return null
}

/** #21 이 받는 형식: PCM16 mono 16kHz. */
export function isPcm16Mono16k(w: WavInfo): boolean {
  return w.audioFormat === PCM && w.channels === 1 && w.sampleRate === 16_000 && w.bitsPerSample === 16
}
