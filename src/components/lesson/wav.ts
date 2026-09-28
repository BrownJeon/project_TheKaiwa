/**
 * WAV 이어 붙이기(순수) — 대화 한 줄이 문장 조각 2개 이상으로 합성되면(#62c `clips`) 재생 큐에는 **줄 하나 = part 하나**로 넘긴다
 * (줄 강조·"{i}/{n}줄"이 줄 단위라서). 같은 목소리의 PCM 이라 형식(채널·표본율·비트)이 같을 때만 잇고, 다르면 첫 조각만 쓴다.
 * 조각 사이에는 `pauseBeforeMs` 만큼 무음을 넣는다.
 */

interface WavParts {
  fmt: Uint8Array
  channels: number
  sampleRate: number
  bitsPerSample: number
  data: Uint8Array
}

function ascii(v: DataView, off: number): string {
  return String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3))
}

export function parseWav(buf: ArrayBuffer): WavParts | null {
  if (buf.byteLength < 12) return null
  const v = new DataView(buf)
  if (ascii(v, 0) !== 'RIFF' || ascii(v, 8) !== 'WAVE') return null
  let off = 12
  let fmt: Uint8Array | null = null
  let data: Uint8Array | null = null
  while (off + 8 <= buf.byteLength) {
    const id = ascii(v, off)
    const size = v.getUint32(off + 4, true)
    const body = off + 8
    const end = Math.min(buf.byteLength, body + size)
    if (id === 'fmt ') fmt = new Uint8Array(buf.slice(body, end))
    else if (id === 'data') data = new Uint8Array(buf.slice(body, end))
    off = body + size + (size % 2)
  }
  if (!fmt || !data || fmt.byteLength < 16) return null
  const f = new DataView(fmt.buffer, fmt.byteOffset, fmt.byteLength)
  return { fmt, channels: f.getUint16(2, true), sampleRate: f.getUint32(4, true), bitsPerSample: f.getUint16(14, true), data }
}

export function concatWav(bufs: readonly ArrayBuffer[], gapsMs: readonly number[] = []): ArrayBuffer {
  if (bufs.length === 0) return new ArrayBuffer(0)
  if (bufs.length === 1) return bufs[0]
  const parts = bufs.map(parseWav)
  const first = parts[0]
  if (!first || parts.some((p) => !p || p.channels !== first.channels || p.sampleRate !== first.sampleRate || p.bitsPerSample !== first.bitsPerSample)) return bufs[0]
  const blockAlign = (first.channels * first.bitsPerSample) / 8
  const silence = (ms: number) => {
    const frames = Math.max(0, Math.round((first.sampleRate * ms) / 1000))
    return frames * blockAlign
  }
  const chunks: (Uint8Array | number)[] = []
  parts.forEach((p, i) => {
    if (i > 0) chunks.push(silence(gapsMs[i] ?? 0))
    chunks.push((p as WavParts).data)
  })
  const dataLen = chunks.reduce<number>((n, c) => n + (typeof c === 'number' ? c : c.byteLength), 0)
  const fmtLen = first.fmt.byteLength
  const out = new ArrayBuffer(12 + 8 + fmtLen + (fmtLen % 2) + 8 + dataLen)
  const v = new DataView(out)
  const bytes = new Uint8Array(out)
  const w = (off: number, s: string) => {
    for (let k = 0; k < 4; k++) v.setUint8(off + k, s.charCodeAt(k))
  }
  w(0, 'RIFF')
  v.setUint32(4, out.byteLength - 8, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  v.setUint32(16, fmtLen, true)
  bytes.set(first.fmt, 20)
  let off = 20 + fmtLen + (fmtLen % 2)
  w(off, 'data')
  v.setUint32(off + 4, dataLen, true)
  off += 8
  for (const c of chunks) {
    if (typeof c === 'number') off += c
    else {
      bytes.set(c, off)
      off += c.byteLength
    }
  }
  return out
}
