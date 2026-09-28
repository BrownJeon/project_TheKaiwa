/**
 * 온디바이스 인식 모델 배포본(#9·#10) — 앱(플러그인)이 첫 실행 때 받아 가는 manifest·파일.
 *
 * ── 공개 경로는 불투명 id ────────────────────────────────────────────────
 * 앱이 받는 주소는 `/models/<ONDEVICE_MODEL_ID>/manifest.json`·`/models/<id>/<version>/<file>` 이다. 디스크 디렉터리 이름
 * (엔진·모델 이름이 들어 있다)은 ONDEVICE connection 설정(`connection.manifestUrl`)에만 있고, 여기서는 그 값을 **읽어서** 쓴다 —
 * #19 사용자 응답에 엔진명이 실리지 않게(task-003e 이월 결정, 003f 완료 기준 8). 실제 모델 이름은 manifest 본문에만 남는다.
 *
 * ── manifest 규칙(task-003f C1-3) ─────────────────────────────────────────
 * 디스크 manifest 를 **플러그인과 같은 규칙**(`manifestRules.ts` — Kotlin `ManifestValidator` 를 옮긴 것: engine·modelType·sampleRate·역할 5종·
 * 파일별 sha256·크기 상한·총량 ≤300MiB·합계 일치)으로 검증한 뒤에만 내보내고(REV-021),
 * 파일마다 **같은 운영 origin 의 절대 URL** 을 붙인다. 검증에 실패한 manifest 는 없는 것으로 친다(404) — 반쯤 맞는 목록을
 * 내보내면 플러그인이 받다가 실패하는 편이 더 나쁘다. 파일은 **현재 manifest 에 적힌 것**과, 버전 전환 뒤 24시간은 **직전 버전의 검증된
 * 스냅샷에 적힌 것**만 서빙한다(진행 중이던 받기의 이어받기 — `ModelDistribution`). 목록 밖·만료된 옛 버전·임의 파일은 404.
 */
import { readFile, stat } from 'node:fs/promises'
import { modelsPath, modelsRoot, realpathInside, serveFile, type StreamSlots } from '@/modules/infra'
import { stt } from '@/modules/engine'
import { isValidVersion, MANIFEST_RULES, ManifestError, parseManifest, parseManifestText, type ModelFile, type ModelManifest } from './manifestRules'

export { MANIFEST_RULES, ManifestError, parseManifest, parseManifestText, isValidVersion }
export type { ModelFile, ModelManifest }

/** 공개 모델 패키지 id — 경로·#19 `onDevice.model.id`. 모델 계열이 바뀌면(다른 엔진) 새 id 를 쓴다. 같은 계열의 갱신은 manifest `version`. */
export const ONDEVICE_MODEL_ID = 'ondevice-ja-v1'

export const MODEL_TOTAL_MAX_BYTES = MANIFEST_RULES.maxTotalBytes
export const MODEL_FILES_MAX = MANIFEST_RULES.maxFiles
const MANIFEST_MAX_BYTES = MANIFEST_RULES.maxManifestChars

const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const CONFIG_MANIFEST = /^\/models\/([A-Za-z0-9][A-Za-z0-9._-]{0,63})\/manifest\.json$/

/** `connection.manifestUrl`(`/models/<dir>/manifest.json`) → 디스크 디렉터리 이름. 형식이 다르면 null. */
export function modelDirFromConfig(manifestUrl: string | null): string | null {
  if (!manifestUrl) return null
  const m = CONFIG_MANIFEST.exec(manifestUrl)
  return m && !m[1].includes('..') ? m[1] : null
}

export function modelFileUrl(origin: string, version: string, file: string): string {
  return `${origin}/models/${ONDEVICE_MODEL_ID}/${encodeURIComponent(version)}/${encodeURIComponent(file)}`
}

/**
 * 앱에 내보내는 manifest — 파일마다 같은 origin 의 절대 URL. `origin` 은 `https://host` 형태(끝 `/` 없음).
 * 플러그인 검증 필드(name·version·engine·modelType·sampleRate·files[path·sha256·bytes·role]·totalBytes·minPluginVersion)는 검증한 값 그대로,
 * 그 밖(id·baseUrl·url·설명)은 플러그인이 무시하는 덧붙임이다 — 내보낸 본문이 다시 같은 규칙을 통과한다(테스트).
 */
export function publicManifest(m: ModelManifest, origin: string) {
  return {
    id: ONDEVICE_MODEL_ID,
    name: m.name,
    version: m.version,
    engine: MANIFEST_RULES.engine,
    modelType: MANIFEST_RULES.modelType,
    sampleRate: MANIFEST_RULES.sampleRate,
    ...(m.minPluginVersion ? { minPluginVersion: m.minPluginVersion } : {}),
    ...m.meta,
    baseUrl: `${origin}/models/${ONDEVICE_MODEL_ID}/${encodeURIComponent(m.version)}/`,
    totalBytes: m.totalBytes,
    files: m.files.map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes, role: f.role, url: modelFileUrl(origin, m.version, f.path) })),
  }
}

// ── 디스크 ───────────────────────────────────────────────────────────────

const CACHE_MS = 10_000
let cache: { at: number; dir: string; mtimeMs: number; size: number; manifest: ModelManifest | null } | null = null

/** 지금 배포 중인 모델 디렉터리(ONDEVICE connection 설정). connection 이 없거나 꺼져 있으면 null — 그때는 배포도 하지 않는다. */
async function currentModelDir(): Promise<string | null> {
  const od = (await stt.realtimeTargets()).find((t) => t.connectionType === 'ONDEVICE')
  if (!od) return null
  return modelDirFromConfig((await stt.publicRuntime(od)).manifestUrl)
}

async function loadManifest(dir: string): Promise<ModelManifest | null> {
  const path = modelsPath(dir, 'manifest.json')
  let st
  try {
    st = await stat(path)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    throw e
  }
  if (cache && cache.dir === dir && cache.mtimeMs === st.mtimeMs && cache.size === st.size && Date.now() - cache.at < CACHE_MS) return cache.manifest
  let manifest: ModelManifest | null = null
  if (st.isFile() && st.size <= MANIFEST_MAX_BYTES * 4) {
    try {
      manifest = parseManifestText(await readFile(path, 'utf8'))
    } catch (e) {
      console.error('[models] manifest 검증 실패 — 배포하지 않음:', e instanceof Error ? e.message : String(e))
    }
  }
  cache = { at: Date.now(), dir, mtimeMs: st.mtimeMs, size: st.size, manifest }
  return manifest
}

export interface ServedModel {
  dir: string
  manifest: ModelManifest
}

export interface ModelFileTarget {
  absPath: string
  root: string
  file: ModelFile
  /** 은퇴 버전(전환 전에 시작한 받기의 이어받기)에서 나왔다. */
  retired: boolean
}

/**
 * 은퇴 버전 보관(task-003f Codex C2 지적 2) — manifest 가 새 버전으로 바뀌어도 **바뀌기 전에 시작한 받기**가 Range 로 이어받을 수 있게,
 * 직전까지 current 였던 **검증된 manifest 스냅샷**을 TTL 동안 들고 있다. 서빙은 그 스냅샷에 적힌 파일만(경로·크기·sha256 그대로) —
 * "디스크에 남아 있기만 하면 서빙"은 하지 않는다(검증 안 된 잔여 디렉터리를 내보내는 회귀 방지, REV-021/022).
 *  - TTL 24시간: 170MB 를 느린 가정 회선으로 받아도 넉넉하다. 플러그인은 받기를 새로 시작할 때마다 manifest 를 다시 읽고 현재 버전이 아닌
 *    `.tmp-<version>` 조각을 버리므로(ModelDownloader `dropOtherTmp`), 은퇴 버전이 쓸모 있는 것은 **이미 진행 중인 받기**뿐이다.
 *  - 최대 2개: 연달아 갈아 끼워도 무한히 쌓이지 않는다(가장 오래된 것부터 버린다).
 *  - 현재 manifest(#9)는 언제나 최신 버전만 가리킨다. 배포가 꺼지면(connection 끔·manifest 무효) 은퇴 버전도 서빙하지 않는다.
 *  - **프로세스 재시작 때 보관이 사라지는 것은 감수한다(디스크에서 되살리지 않음)**: 디스크에는 옛 버전의 manifest 가 없고(§5 에서
 *    manifest.json 을 원자적으로 교체), 버전 디렉터리만으로는 검증된 목록을 만들 수 없다 — 되살리려면 목록 없이 서빙하거나 manifest 이력을
 *    따로 보관해야 하는데, 앞은 금지 조건이고 뒤는 "전환 + 재시작 + 받기 진행 중" 이 겹칠 때만 이득이라 복잡도에 비해 작다.
 *    그 경우 플러그인은 404 로 받기를 실패하고, 다음 받기에서 새 manifest 로 처음부터 받는다(무결성 문제 없음).
 */
export const RETIRED_TTL_MS = 24 * 60 * 60 * 1000
export const RETIRED_MAX = 2

export class ModelDistribution {
  private lastServed: ServedModel | null = null
  private retired: Array<ServedModel & { retiredAt: number }> = []

  constructor(
    private readonly loader: () => Promise<ServedModel | null>,
    private readonly now: () => number = Date.now,
  ) {}

  /** 지금 내줄 모델. 버전(또는 디렉터리)이 바뀌었으면 직전 것을 은퇴 목록에 넣는다. */
  async current(): Promise<ServedModel | null> {
    const s = await this.loader()
    if (s) this.note(s)
    return s
  }

  private note(s: ServedModel): void {
    const prev = this.lastServed
    const t = this.now()
    this.retired = this.retired.filter((r) => t - r.retiredAt < RETIRED_TTL_MS && !(r.dir === s.dir && r.manifest.version === s.manifest.version))
    if (prev && (prev.dir !== s.dir || prev.manifest.version !== s.manifest.version)) {
      console.log(`[models] 버전 전환 — 직전 버전을 ${RETIRED_TTL_MS / 3_600_000}시간 동안 이어받기용으로만 보관`)
      this.retired = [{ ...prev, retiredAt: t }, ...this.retired.filter((r) => !(r.dir === prev.dir && r.manifest.version === prev.manifest.version))].slice(0, RETIRED_MAX)
    }
    this.lastServed = s
  }

  /** 테스트·진단 — TTL 안의 은퇴 버전들. */
  retiredVersions(): string[] {
    const t = this.now()
    return this.retired.filter((r) => t - r.retiredAt < RETIRED_TTL_MS).map((r) => r.manifest.version)
  }

  /**
   * `/models/<id>/<version>/<file>` → 서빙 대상. 현재 manifest 의 파일, 또는 TTL 안의 은퇴 스냅샷에 적힌 파일만. 그 밖은 null(404).
   * 배포가 꺼져 있으면(현재 없음) 은퇴 버전도 null.
   */
  async resolveFile(id: string, version: string, file: string): Promise<ModelFileTarget | null> {
    if (id !== ONDEVICE_MODEL_ID || !isValidVersion(version) || !FILE.test(file)) return null
    const served = await this.current()
    if (!served) return null
    const t = this.now()
    const source =
      served.manifest.version === version ? served : this.retired.find((r) => r.manifest.version === version && t - r.retiredAt < RETIRED_TTL_MS) ?? null
    if (!source) return null
    const entry = source.manifest.files.find((f) => f.path === file)
    if (!entry) return null
    return { absPath: modelsPath(source.dir, version, file), root: modelsRoot(), file: entry, retired: source !== served }
  }
}

async function loadCurrent(): Promise<ServedModel | null> {
  const dir = await currentModelDir()
  if (!dir) return null
  const manifest = await loadManifest(dir)
  return manifest ? { dir, manifest } : null
}

const distribution = new ModelDistribution(loadCurrent)

/** 지금 앱에 내줄 수 있는 모델(설정·디스크·검증 셋 다 통과). 아니면 null. */
export function currentOnDeviceModel(): Promise<ServedModel | null> {
  return distribution.current()
}

export function resolveModelFile(id: string, version: string, file: string): Promise<ModelFileTarget | null> {
  return distribution.resolveFile(id, version, file)
}

/**
 * 서빙 대상 → 응답(실경로가 모델 루트 안 · 디스크 크기 = 기록 · Range·ETag=sha256). 라우트와 테스트가 같은 경로를 쓴다.
 * 파일은 버전 디렉터리 안에서 불변이므로 은퇴 버전도 같은 캐시 규칙.
 */
export async function serveModelFile(req: Request, target: ModelFileTarget, slots?: StreamSlots): Promise<Response> {
  const real = await realpathInside(target.root, target.absPath)
  if (!real) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return serveFile(req, {
    path: real,
    etag: `"${target.file.sha256}"`,
    expectedSize: target.file.bytes,
    contentType: 'application/octet-stream',
    cacheControl: 'public, max-age=31536000, immutable',
    headers: { 'X-Content-SHA256': target.file.sha256 },
    ...(slots ? { slots } : {}),
  })
}

/** #19 `onDevice.model` 에 싣는 요약(엔진명 없음). 배포본이 없으면 version·totalBytes 가 null. */
export async function onDeviceModelSummary(): Promise<{ id: string; version: string | null; totalBytes: number | null; manifestUrl: string }> {
  let served: ServedModel | null = null
  try {
    served = await currentOnDeviceModel()
  } catch (e) {
    console.error('[models] 배포본 확인 실패:', e instanceof Error ? e.message : String(e))
  }
  return {
    id: ONDEVICE_MODEL_ID,
    version: served?.manifest.version ?? null,
    totalBytes: served?.manifest.totalBytes ?? null,
    manifestUrl: `/models/${ONDEVICE_MODEL_ID}/manifest.json`,
  }
}
