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

function pcmOf(buf: Buffer): { fmt: Buffer; data: Buffer; info: WavInfo } | null {
  const info = wavInfo(buf)
  if (!info) return null
  let off = 12
  let fmt: Buffer | null = null
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') fmt = buf.subarray(body, Math.min(buf.length, body + size))
    else if (id === 'data') return fmt ? { fmt, data: buf.subarray(body, body + info.dataBytes), info } : null
    off = body + size + (size % 2)
  }
  return null
}

/**
 * 같은 형식(샘플레이트·채널·비트)의 WAV 여러 개를 `gapMs` 무음을 끼워 하나로 잇는다(사전 미리듣기의 여러 문장, task-003g).
 * 형식이 다르거나 WAV 가 아니면 null. 한 개면 그대로 돌려준다.
 */
export function concatWav(parts: readonly Buffer[], gapMs = 0): Buffer | null {
  if (parts.length === 0) return null
  if (parts.length === 1) return wavInfo(parts[0]) ? parts[0] : null
  const pcm = parts.map(pcmOf)
  if (pcm.some((p) => !p)) return null
  const first = pcm[0]!
  const same = pcm.every((p) => p!.info.sampleRate === first.info.sampleRate && p!.info.channels === first.info.channels && p!.info.bitsPerSample === first.info.bitsPerSample)
  if (!same) return null
  const blockAlign = Math.max(1, (first.info.channels * first.info.bitsPerSample) / 8)
  const gapBytes = Math.round((first.info.sampleRate * gapMs) / 1000) * blockAlign
  const chunks: Buffer[] = []
  pcm.forEach((p, i) => {
    if (i > 0 && gapBytes > 0) chunks.push(Buffer.alloc(gapBytes))
    chunks.push(p!.data)
  })
  const data = Buffer.concat(chunks)
  const fmt = first.fmt
  const header = Buffer.alloc(12 + 8 + fmt.length + (fmt.length % 2) + 8)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(header.length - 8 + data.length, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(fmt.length, 16)
  fmt.copy(header, 20)
  const dataHdr = 20 + fmt.length + (fmt.length % 2)
  header.write('data', dataHdr, 'ascii')
  header.writeUInt32LE(data.length, dataHdr + 4)
  return Buffer.concat([header, data])
}
