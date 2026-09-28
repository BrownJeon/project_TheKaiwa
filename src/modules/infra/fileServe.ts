/**
 * 공개 대용량 파일 응답(온디바이스 모델 #10 · APK `/app/download/*`) — 단일 구간 Range(206)·ETag·If-None-Match·If-Range·HEAD.
 *
 * 경로 검증은 **호출자**가 끝낸 절대 경로만 받는다(DATA_ROOT 하위 확인·실경로 확인은 호출자 몫).
 * 본문은 파일 핸들에서 끌어 읽는 스트림이라 수백 MB 도 메모리에 올리지 않고, 끊기면(cancel) 핸들을 바로 닫는다.
 * 여러 구간(`bytes=0-1,5-9`)은 무시하고 전체를 준다(RFC 9110 §14.2 — 서버는 Range 를 무시할 수 있다). 이어받기 클라이언트는 단일 구간만 쓴다.
 */
import { open, stat } from 'node:fs/promises'

/** 양 끝 포함 구간. */
export interface ByteRange {
  start: number
  end: number
}

/**
 * `Range` 헤더 → 구간 / `'unsatisfiable'`(416) / `null`(무시하고 전체).
 * 형식이 틀린 헤더는 무시한다(오류로 만들면 이어받기 클라이언트가 처음부터 다시 받을 길까지 막힌다).
 */
export function parseRange(header: string | null, size: number): ByteRange | 'unsatisfiable' | null {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null
  const [, a, b] = m
  if (a === '' && b === '') return null
  if (a === '') {
    const n = Number(b)
    if (!Number.isSafeInteger(n)) return null
    if (n === 0 || size === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(a)
  if (!Number.isSafeInteger(start)) return null
  if (b === '') return start < size ? { start, end: size - 1 } : 'unsatisfiable'
  const end = Number(b)
  if (!Number.isSafeInteger(end) || end < start) return null
  if (start >= size) return 'unsatisfiable'
  return { start, end: Math.min(end, size - 1) }
}

/** `If-None-Match` 가 이 ETag 를 가리키는가(`*`·목록·약한 비교). */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false
  const bare = etag.replace(/^W\//, '')
  return header.split(',').some((t) => {
    const v = t.trim()
    return v === '*' || v.replace(/^W\//, '') === bare
  })
}

/** 동시 스트림 상한(프로세스 단위) — 공개 대용량 경로가 Node 프로세스·NFS 대역을 다 쓰지 못하게. */
export class StreamSlots {
  private used = 0
  constructor(readonly max: number) {}
  get inUse(): number {
    return this.used
  }
  /** 자리가 없으면 null. 돌려받은 함수는 여러 번 불러도 한 번만 반납한다. */
  tryAcquire(): (() => void) | null {
    if (this.used >= this.max) return null
    this.used++
    let done = false
    return () => {
      if (done) return
      done = true
      this.used--
    }
  }
}

const CHUNK = 256 * 1024

function fileStream(path: string, range: ByteRange, onClose: () => void): ReadableStream<Uint8Array> {
  let pos = range.start
  let handle: Awaited<ReturnType<typeof open>> | null = null
  let closed = false
  const finish = async () => {
    if (closed) return
    closed = true
    onClose()
    await handle?.close().catch(() => undefined)
  }
  return new ReadableStream<Uint8Array>({
    // 파일은 첫 pull 에서 연다 — start 에서 열면 본문을 읽기 전에 끊긴 응답(cancel)이 여는 도중과 겹쳐 핸들이 샌다.
    async pull(controller) {
      try {
        if (!handle) {
          const h = await open(path, 'r')
          if (closed) {
            await h.close().catch(() => undefined)
            return
          }
          handle = h
        }
        const left = range.end - pos + 1
        if (left <= 0) {
          await finish()
          controller.close()
          return
        }
        const buf = Buffer.allocUnsafe(Math.min(CHUNK, left))
        const { bytesRead } = await handle.read(buf, 0, buf.length, pos)
        if (closed) return
        if (bytesRead === 0) {
          // 응답 도중 파일이 줄었다(교체 중) — 선언한 Content-Length 를 채울 수 없으니 연결을 오류로 끊는다.
          await finish()
          controller.error(new Error('file truncated while streaming'))
          return
        }
        pos += bytesRead
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, bytesRead))
      } catch (e) {
        await finish()
        controller.error(e)
      }
    },
    async cancel() {
      await finish()
    },
  })
}

export interface ServeFileOptions {
  /** 호출자가 검증한 절대 경로. */
  path: string
  /** 강한 ETag(따옴표 포함). 내용 해시를 쓴다 — 이어받기 `If-Range` 의 기준. */
  etag: string
  contentType: string
  cacheControl: string
  /** 정해 두면 디스크 크기와 다를 때 404 — 기록과 다른 파일을 내보내지 않는다. */
  expectedSize?: number
  headers?: Record<string, string>
  /** 본문을 보낼 때만 쓰는 자리. 없으면 제한 없음. */
  slots?: StreamSlots
}

function notFound(): Response {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

/** 파일이 없거나(ENOENT)·일반 파일이 아니거나·크기가 기록과 다르면 404. */
export async function serveFile(req: Request, o: ServeFileOptions): Promise<Response> {
  let size: number
  try {
    const st = await stat(o.path)
    if (!st.isFile()) return notFound()
    size = st.size
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT' || (e as { code?: string }).code === 'ENOTDIR') return notFound()
    throw e
  }
  if (o.expectedSize !== undefined && size !== o.expectedSize) {
    console.error('[fileServe] 크기가 기록과 다른 파일 — 내보내지 않음')
    return notFound()
  }

  const base: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    ETag: o.etag,
    'Cache-Control': o.cacheControl,
    'X-Content-Type-Options': 'nosniff',
    ...(o.headers ?? {}),
  }
  if (etagMatches(req.headers.get('if-none-match'), o.etag)) return new Response(null, { status: 304, headers: base })

  const ifRange = req.headers.get('if-range')
  const rangeAllowed = ifRange === null || ifRange.trim() === o.etag
  const r = rangeAllowed ? parseRange(req.headers.get('range'), size) : null
  if (r === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } })
  }
  const range = r ?? { start: 0, end: size - 1 }
  const length = size === 0 ? 0 : range.end - range.start + 1
  const headers: Record<string, string> = { ...base, 'Content-Type': o.contentType, 'Content-Length': String(length) }
  const status = r ? 206 : 200
  if (r) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`

  if (req.method === 'HEAD' || length === 0) return new Response(null, { status, headers })

  const release = o.slots ? o.slots.tryAcquire() : () => undefined
  if (!release) {
    return new Response(null, { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } })
  }
  return new Response(fileStream(o.path, range, release), { status, headers })
}
