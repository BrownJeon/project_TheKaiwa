import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { publicOrigin, StreamSlots } from '@/modules/infra'
import { currentOnDeviceModel, ONDEVICE_MODEL_ID, publicManifest, resolveModelFile, serveModelFile } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #9 `GET /models/<id>/manifest.json` · #10 `GET /models/<id>/<version>/<file>` — 온디바이스 모델 배포(공개, 인증 없음).
 * `<id>` 는 불투명 패키지 id(`speech.ONDEVICE_MODEL_ID`), 디스크 위치는 `DATA_ROOT/models/<connection 설정 디렉터리>/`.
 * manifest 는 매번 검증해 파일별 같은 origin 절대 URL 을 붙여 내보낸다(no-cache + ETag). 파일은 현재 manifest 에 적힌 것만,
 * 기록 크기와 같을 때만, Range·If-Range·ETag(=sha256) 로 서빙한다(immutable). 버전 전환 뒤 24시간은 직전 버전의 검증된 스냅샷에 적힌
 * 파일도(진행 중이던 받기의 이어받기 — Codex C2). 그 밖은 전부 같은 404.
 *
 * 분당 제한 대신 **동시 스트림 4개**(프로세스 단위, 넘으면 503 Retry-After) — 이어받기 클라이언트는 짧은 시간에 요청을 여러 번 보내고,
 * nginx `/models/` 는 X-Forwarded-For 를 넘기지 않아 IP 별 제한을 앱에서 걸 수 없다. 대역 제한이 필요하면 nginx 쪽(limit_conn/limit_rate).
 */
const slots = new StreamSlots(4)

function notFound(): Response {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

async function manifest(req: NextRequest, id: string): Promise<Response> {
  if (id !== ONDEVICE_MODEL_ID) return notFound()
  const served = await currentOnDeviceModel()
  if (!served) return notFound()
  const body = JSON.stringify(publicManifest(served.manifest, publicOrigin(req.nextUrl.origin, req.headers.get('host'))))
  const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`
  const headers = { ETag: etag, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }
  const inm = req.headers.get('if-none-match')
  if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) return new Response(null, { status: 304, headers })
  const bytes = Buffer.from(body, 'utf8')
  return new Response(req.method === 'HEAD' ? null : bytes, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(bytes.length) },
  })
}

async function file(req: NextRequest, id: string, version: string, name: string): Promise<Response> {
  const target = await resolveModelFile(id, version, name)
  if (!target) return notFound()
  return serveModelFile(req, target, slots)
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params
  try {
    if (path.length === 2 && path[1] === 'manifest.json') return await manifest(req, path[0])
    if (path.length === 3) return await file(req, path[0], path[1], path[2])
    return notFound()
  } catch (e) {
    console.error('[models] 서빙 실패:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return new Response(null, { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } })
  }
}

export const GET = handle
export const HEAD = handle
