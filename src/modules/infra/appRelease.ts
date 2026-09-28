/**
 * APK 배포본(`AppRelease`, L6 소유) — #8 `GET /api/app/version` 과 `GET /app/download/<file>` 의 판단.
 *
 * 행은 deployer 가 네이티브 변경 배포 때 넣는다(삭제 경로 없음). 행이 없으면 버전 응답은 전부 null·false 이고 다운로드는 404.
 *  - 앱 버전: 앱은 `X-App-Build`(versionCode = `App.getInfo().build`)와 `X-App-Version`(versionName)을 보낸다. 비교는 **versionCode 정수로만**
 *    (task-003f Leader ③ — 이름 문자열 비교는 `1.10.0 < 1.9.0` 류 오판). 코드가 없으면 판단하지 않는다(false).
 *  - `reinstallRequired` = 앱 코드 < 최신 코드(AppRelease 행 = APK 를 새로 깔아야 하는 네이티브 변경이다). 헤더 없으면 false.
 *  - `updateRequired` = 앱 코드 < `minSupported`(닫을 수 없는 배너).
 *  - 다운로드는 **기록한 sha256 과 같은 파일만** 내보낸다(파일 교체·손상 시 404) — 받은 파일의 sha256 = 기록값(완료 기준 4).
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, isAbsolute, resolve, sep } from 'node:path'
import { prisma } from './db'
import { dataPath, realpathInside } from './storage'

export interface ReleaseRow {
  versionCode: number
  versionName: string
  apkPath: string
  sha256: string
  notes: string | null
  minSupported: number
  createdAt: Date
}

export interface ClientVersion {
  code: number | null
  name: string | null
}

export interface AppVersionInfo {
  latest: string | null
  latestCode: number | null
  minSupported: string | null
  minSupportedCode: number | null
  url: string | null
  notes: string | null
  sha256: string | null
  /** 최신 APK 크기(설치 시트 "약 30MB"). 파일을 못 찾으면 null. */
  bytes: number | null
  publishedAt: string | null
  updateAvailable: boolean
  reinstallRequired: boolean
  updateRequired: boolean
}

const NAME = /^\d{1,4}(\.\d{1,4}){0,3}$/
const APK_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.apk$/

/** 요청 헤더 → 앱 버전. 형식이 다르면 null(없는 것으로 친다). */
export function parseClientVersion(headers: Headers): ClientVersion {
  const rawCode = headers.get('x-app-build')?.trim() ?? ''
  const code = /^\d{1,9}$/.test(rawCode) ? Number(rawCode) : null
  const rawName = headers.get('x-app-version')?.trim() ?? ''
  return { code: code !== null && code > 0 ? code : null, name: NAME.test(rawName) ? rawName : null }
}

/** 점 구분 숫자 비교(1.2 < 1.10). 음수=a<b. */
export function compareVersionNames(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** `rows` 는 versionCode 내림차순. 순수 함수. */
export function buildVersionInfo(rows: readonly ReleaseRow[], client: ClientVersion, downloadUrl: string, bytes: number | null = null): AppVersionInfo {
  const latest = rows[0]
  if (!latest) {
    return { latest: null, latestCode: null, minSupported: null, minSupportedCode: null, url: null, notes: null, sha256: null, bytes: null, publishedAt: null, updateAvailable: false, reinstallRequired: false, updateRequired: false }
  }
  const minRow = rows.find((r) => r.versionCode === latest.minSupported) ?? null
  const code = client.code
  const behind = code !== null && code < latest.versionCode
  const blocked = code !== null && code < latest.minSupported
  return {
    latest: latest.versionName,
    latestCode: latest.versionCode,
    minSupported: minRow?.versionName ?? null,
    minSupportedCode: latest.minSupported,
    url: downloadUrl,
    notes: latest.notes,
    sha256: latest.sha256,
    bytes,
    publishedAt: latest.createdAt.toISOString(),
    updateAvailable: behind,
    reinstallRequired: behind,
    updateRequired: blocked,
  }
}

const ROWS_CACHE_MS = 30_000
let rowsCache: { at: number; rows: ReleaseRow[] } | null = null

export async function listReleases(): Promise<ReleaseRow[]> {
  if (rowsCache && Date.now() - rowsCache.at < ROWS_CACHE_MS) return rowsCache.rows
  const rows = await prisma.appRelease.findMany({ orderBy: { versionCode: 'desc' }, take: 50 })
  rowsCache = { at: Date.now(), rows }
  return rows
}

/** 배너가 여는 주소 — `APK_DOWNLOAD_BASE`(https, 끝 `/` 없이) + `/latest.apk`. 없거나 형식이 다르면 같은 출처 상대 경로. */
export function apkDownloadUrl(): string {
  const raw = process.env.APK_DOWNLOAD_BASE?.trim()
  if (raw) {
    try {
      const u = new URL(raw)
      if (u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash) return `${u.origin}${u.pathname.replace(/\/+$/, '')}/latest.apk`
    } catch {
      // 아래 기본값
    }
  }
  return '/app/download/latest.apk'
}

/** 최신 APK 파일 크기(stat 만 — 해시는 다운로드 때). 없으면 null. */
async function latestApkBytes(rows: readonly ReleaseRow[]): Promise<number | null> {
  const latest = rows[0]
  if (!latest) return null
  try {
    const dir = dataPath('releases')
    const p = releaseFilePath(latest.apkPath, dir)
    const real = p ? await realpathInside(dir, p) : null
    const st = real ? await stat(real) : null
    return st?.isFile() ? st.size : null
  } catch {
    return null
  }
}

export async function getAppVersionInfo(headers: Headers): Promise<AppVersionInfo> {
  const rows = await listReleases()
  return buildVersionInfo(rows, parseClientVersion(headers), apkDownloadUrl(), await latestApkBytes(rows))
}

// ── 다운로드 ─────────────────────────────────────────────────────────────

/** `/app/download/<file>` → 행. `latest.apk` = 최신, 그 밖은 apkPath 파일 이름이 같은 행. 순수 함수. */
export function pickReleaseForFile(rows: readonly ReleaseRow[], file: string): ReleaseRow | null {
  if (!APK_FILE.test(file)) return null
  if (file === 'latest.apk') return rows[0] ?? null
  return rows.find((r) => basename(r.apkPath) === file) ?? null
}

/**
 * apkPath → `DATA_ROOT/releases/` 아래 절대 경로. 파일 이름만 적혔으면 releases 아래, 절대 경로면 releases 아래일 때만.
 * 그 밖(상대 경로 조각·루트 밖)은 null.
 */
export function releaseFilePath(apkPath: string, releasesDir: string): string | null {
  if (!apkPath.includes('/')) return APK_FILE.test(apkPath) ? resolve(releasesDir, apkPath) : null
  if (!isAbsolute(apkPath)) return null
  const full = resolve(apkPath)
  return full.startsWith(releasesDir + sep) && APK_FILE.test(basename(full)) ? full : null
}

const shaCache = new Map<string, { size: number; mtimeMs: number; sha256: string }>()

async function sha256OfFile(path: string): Promise<{ sha256: string; size: number } | null> {
  const st = await stat(path).catch(() => null)
  if (!st?.isFile()) return null
  const hit = shaCache.get(path)
  if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return { sha256: hit.sha256, size: st.size }
  const h = createHash('sha256')
  await new Promise<void>((ok, bad) => {
    createReadStream(path)
      .on('data', (c) => h.update(c))
      .on('end', () => ok())
      .on('error', bad)
  })
  const sha256 = h.digest('hex')
  if (shaCache.size > 20) shaCache.clear()
  shaCache.set(path, { size: st.size, mtimeMs: st.mtimeMs, sha256 })
  return { sha256, size: st.size }
}

export interface ReleaseDownload {
  path: string
  fileName: string
  sha256: string
  size: number
  release: ReleaseRow
}

/** 내보낼 APK — 행·경로·실경로·sha256 이 전부 맞을 때만. 아니면 null(404). 기록과 다른 파일은 서버 로그에 남긴다. */
export async function resolveReleaseDownload(file: string): Promise<ReleaseDownload | null> {
  const release = pickReleaseForFile(await listReleases(), file)
  if (!release) return null
  const dir = dataPath('releases')
  const candidate = releaseFilePath(release.apkPath, dir)
  if (!candidate) return null
  const real = await realpathInside(dir, candidate)
  if (!real) return null
  const actual = await sha256OfFile(real)
  if (!actual) return null
  if (actual.sha256 !== release.sha256.toLowerCase()) {
    console.error(`[app-release] versionCode=${release.versionCode} 파일 sha256 이 기록과 다름 — 내보내지 않음`)
    return null
  }
  return { path: real, fileName: basename(candidate), sha256: actual.sha256, size: actual.size, release }
}
