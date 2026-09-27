/**
 * WAV 헤더 읽기 — 합성 결과 검증과 길이(ms) 계산. RIFF 청크를 순회해 `fmt `·`data` 를 찾는다(추가 청크가 있어도 된다).
 */
export interface WavInfo {
  sampleRate: number
  channels: number
  bitsPerSample: number
  dataBytes: number
  durationMs: number
}

export function wavInfo(buf: Buffer): WavInfo | null {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let off = 12
  let fmt: { sampleRate: number; channels: number; bitsPerSample: number; byteRate: number } | null = null
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ' && body + 16 <= buf.length) {
      fmt = { channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), byteRate: buf.readUInt32LE(body + 8), bitsPerSample: buf.readUInt16LE(body + 14) }
    } else if (id === 'data') {
      if (!fmt || fmt.byteRate === 0 || fmt.sampleRate === 0) return null
      const dataBytes = Math.min(size, buf.length - body)
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bitsPerSample, dataBytes, durationMs: Math.round((dataBytes * 1000) / fmt.byteRate) }
    }
    off = body + size + (size % 2)
  }
  return null
}
