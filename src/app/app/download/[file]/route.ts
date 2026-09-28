import type { NextRequest } from 'next/server'
import { apkDownloadName, resolveReleaseDownload, serveFile, StreamSlots } from '@/modules/infra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * `GET /app/download/<file>` — APK 배포본(공개). `latest.apk` = 최신 `AppRelease`, 그 밖은 apkPath 파일 이름이 같은 행.
 * `DATA_ROOT/releases/` 아래에서 **기록한 sha256 과 같은 파일만** 스트리밍한다(Range·ETag=sha256, 헤더 `X-Content-SHA256`).
 * 행·파일이 없거나 다르면 같은 404. nginx 는 이 경로를 프록시만 한다(www-data 가 DATA_ROOT 를 못 읽음 — docs/nginx).
 */
const slots = new StreamSlots(4)

async function handle(req: NextRequest, ctx: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await ctx.params
  try {
    const d = await resolveReleaseDownload(file)
    if (!d) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    return await serveFile(req, {
      path: d.path,
      etag: `"${d.sha256}"`,
      expectedSize: d.size,
      contentType: 'application/vnd.android.package-archive',
      // latest 는 가리키는 파일이 바뀐다 — 매번 확인(ETag 로 304). 버전 이름 파일은 불변.
      cacheControl: file === 'latest.apk' ? 'no-cache' : 'public, max-age=86400',
      headers: {
        // 받는 파일 이름은 제품 이름(task-003h), 서버 저장 이름(thekaiwa-*.apk)은 그대로.
        'Content-Disposition': `attachment; filename="${apkDownloadName(d.release)}"`,
        'X-Content-SHA256': d.sha256,
        'X-App-Version-Code': String(d.release.versionCode),
      },
      slots,
    })
  } catch (e) {
    console.error('[app-download] 실패:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return new Response(null, { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } })
  }
}

export const GET = handle
export const HEAD = handle
