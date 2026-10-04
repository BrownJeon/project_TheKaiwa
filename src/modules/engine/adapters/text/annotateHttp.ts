/**
 * 텍스트 분석 어댑터(task-026 S1) — speech gateway 내부 라우트 `POST /text/annotate`(pyopenjtalk 형태소 분석)를 부르는 **유일한 앱 코드**.
 * 엔진 레지스트리(EngineType enum) 밖 내부 서비스 어댑터다(DB·seed·Connection Profile 변경 없음 — Leader 결정 1, 2026-10-04).
 *
 * 계약(speech/gateway/kaiwa_gateway/text.py):
 *   → { texts: string[] ≤64, 각 ≤400자 }  헤더 X-Internal-Secret(= SPEECH_INTERNAL_SECRET)
 *   ← { version, items: [{ segments: [{surface, ruby: [[표기, 히라가나|null]]|null, pron|null, boundary: 'phrase'|'particle'|null}] } | null] }
 *     오류 {error:{code}}: 400 BAD_REQUEST·BAD_JSON / 401 / 413 TOO_MANY_TEXTS·TEXT_TOO_LONG·BODY_TOO_LARGE / 503 NOT_READY·BUSY(대기열 가득)
 *
 * 보안: 주소는 서버 env `SPEECH_GATEWAY_URL` 의 origin 하나(요청 본문 URL 없음), 시크릿은 그 origin 에만(`infra.readServiceSecretFor`).
 * 리다이렉트 미추종, 응답 2MB 상한. 응답은 칸마다 검증해 어긋나면 그 칸만 null(화면은 숨김) — 원문과 이어 붙인 surface 가 다르면 버린다.
 * 예외 메시지·로그에 문장·시크릿을 싣지 않는다.
 */
import { readServiceSecretFor, serviceSecretOrigin } from '@/modules/infra'

export type TextBoundary = 'phrase' | 'particle'
export interface TextSegment {
  surface: string
  ruby: Array<[string, string | null]> | null
  pron: string | null
  boundary: TextBoundary | null
}

/**
 * UNAVAILABLE(연결 거부·503) · BUSY(503 BUSY — 분석기 대기열 가득, 일시 거절) · TIMEOUT · MISCONFIGURED(주소·시크릿·401) ·
 * REJECTED(4xx — 상한 등) · ENGINE_ERROR(그 밖·응답 모양).
 */
export type TextFailureKind = 'UNAVAILABLE' | 'BUSY' | 'TIMEOUT' | 'MISCONFIGURED' | 'REJECTED' | 'ENGINE_ERROR'

export class TextAnalyzerError extends Error {
  constructor(
    readonly kind: TextFailureKind,
    readonly code: string,
  ) {
    super(`TEXT ${kind} (${code})`)
    this.name = 'TextAnalyzerError'
  }
}

export const TEXT_MAX_ITEMS = 64
export const TEXT_MAX_CHARS = 400
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_ERROR_BYTES = 4 * 1024
const MAX_SEGMENTS = 1_000
const SAFE_PRON = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]{1,2000}$/
const HIRAGANA = /^[ぁ-ゖー]{1,64}$/

function networkCode(e: unknown): string {
  const err = e as { name?: string; code?: string; cause?: { code?: string } }
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'ETIMEDOUT'
  const code = err?.cause?.code ?? err?.code
  return typeof code === 'string' && /^E[A-Z]{2,20}$/.test(code) ? code : 'NETWORK_ERROR'
}

async function readCapped(res: Response, cap: number): Promise<Buffer | null> {
  if (!res.body) return Buffer.alloc(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > cap) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

async function errorCode(res: Response): Promise<string> {
  const buf = await readCapped(res, MAX_ERROR_BYTES).catch(() => null)
  if (!buf) return ''
  try {
    const code = (JSON.parse(buf.toString('utf8')) as { error?: { code?: unknown } })?.error?.code
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,40}$/.test(code) ? code : ''
  } catch {
    return ''
  }
}

function parseSegment(v: unknown): TextSegment | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const { surface, pron, boundary, ruby } = o
  if (typeof surface !== 'string' || surface.length === 0) return null
  if (pron !== null && (typeof pron !== 'string' || !SAFE_PRON.test(pron))) return null
  if (boundary !== null && boundary !== 'phrase' && boundary !== 'particle') return null
  let pieces: Array<[string, string | null]> | null = null
  if (ruby !== null) {
    if (!Array.isArray(ruby) || ruby.length === 0 || ruby.length > surface.length) return null
    pieces = []
    for (const p of ruby) {
      if (!Array.isArray(p) || p.length !== 2) return null
      const [t, r] = p as unknown[]
      if (typeof t !== 'string' || t.length === 0) return null
      if (r !== null && (typeof r !== 'string' || !HIRAGANA.test(r))) return null
      pieces.push([t, r as string | null])
    }
    if (pieces.map((p) => p[0]).join('') !== surface) return null
  }
  return { surface, ruby: pieces, pron: pron as string | null, boundary: boundary as TextBoundary | null }
}

/** 응답 검증 — 칸 수가 다르면 전체 오류, 칸 하나가 어긋나면 그 칸만 null. */
export function parseAnnotateResponse(json: unknown, texts: readonly string[]): Array<TextSegment[] | null> {
  const items = (json && typeof json === 'object' ? (json as { items?: unknown }).items : undefined) as unknown
  if (!Array.isArray(items) || items.length !== texts.length) throw new TextAnalyzerError('ENGINE_ERROR', 'BAD_SHAPE')
  return items.map((item, i) => {
    const segs = item && typeof item === 'object' ? (item as { segments?: unknown }).segments : undefined
    if (!Array.isArray(segs) || segs.length > MAX_SEGMENTS) return null
    const out: TextSegment[] = []
    for (const s of segs) {
      const seg = parseSegment(s)
      if (!seg) return null
      out.push(seg)
    }
    return out.map((s) => s.surface).join('') === texts[i] ? out : null
  })
}

export async function annotateHttp(texts: readonly string[], opts: { timeoutMs: number }): Promise<Array<TextSegment[] | null>> {
  if (texts.length === 0) return []
  if (texts.length > TEXT_MAX_ITEMS || texts.some((t) => t.length > TEXT_MAX_CHARS)) throw new TextAnalyzerError('REJECTED', 'TOO_LARGE')
  const origin = serviceSecretOrigin('SPEECH_INTERNAL_SECRET')
  if (!origin) throw new TextAnalyzerError('MISCONFIGURED', 'TARGET_UNSET')
  const url = new URL('/text/annotate', origin)
  const grant = readServiceSecretFor('SPEECH_INTERNAL_SECRET', url)
  if (!grant.ok) throw new TextAnalyzerError('MISCONFIGURED', grant.reason)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-internal-secret': grant.secret },
      body: JSON.stringify({ texts }),
    })
  } catch (e) {
    const code = networkCode(e)
    throw new TextAnalyzerError(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'UNAVAILABLE', code)
  }
  if (res.status !== 200) {
    const code = (await errorCode(res)) || `HTTP_${res.status}`
    if (res.status === 401 || res.status === 403) throw new TextAnalyzerError('MISCONFIGURED', code)
    if (res.status === 503 && code === 'BUSY') throw new TextAnalyzerError('BUSY', code)
    if (res.status === 502 || res.status === 503 || res.status === 504) throw new TextAnalyzerError('UNAVAILABLE', code)
    if (res.status >= 400 && res.status < 500) throw new TextAnalyzerError('REJECTED', code)
    throw new TextAnalyzerError('ENGINE_ERROR', code)
  }
  let json: unknown
  try {
    const buf = await readCapped(res, MAX_RESPONSE_BYTES)
    if (!buf) throw new TextAnalyzerError('ENGINE_ERROR', 'TOO_LARGE_RESPONSE')
    json = JSON.parse(buf.toString('utf8'))
  } catch (e) {
    if (e instanceof TextAnalyzerError) throw e
    const code = networkCode(e)
    throw new TextAnalyzerError(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'ENGINE_ERROR', code === 'NETWORK_ERROR' ? 'BAD_JSON' : code)
  }
  return parseAnnotateResponse(json, texts)
}
