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
 * 내보내면 플러그인이 받다가 실패하는 편이 더 나쁘다. 파일은 **현재 manifest 에 적힌 것만** 서빙한다(옛 버전·임의 파일 404).
 */
import { readFile, stat } from 'node:fs/promises'
import { modelsPath, modelsRoot } from '@/modules/infra'
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

/** 지금 앱에 내줄 수 있는 모델(설정·디스크·검증 셋 다 통과). 아니면 null. */
export async function currentOnDeviceModel(): Promise<ServedModel | null> {
  const dir = await currentModelDir()
  if (!dir) return null
  const manifest = await loadManifest(dir)
  return manifest ? { dir, manifest } : null
}

export interface ModelFileTarget {
  absPath: string
  root: string
  file: ModelFile
}

/** `/models/<id>/<version>/<file>` → 서빙 대상. 현재 manifest 의 현재 버전·적힌 파일만. 그 밖은 null(404). */
export async function resolveModelFile(id: string, version: string, file: string): Promise<ModelFileTarget | null> {
  if (id !== ONDEVICE_MODEL_ID || !isValidVersion(version) || !FILE.test(file)) return null
  const served = await currentOnDeviceModel()
  if (!served || served.manifest.version !== version) return null
  const entry = served.manifest.files.find((f) => f.path === file)
  if (!entry) return null
  return { absPath: modelsPath(served.dir, version, file), root: modelsRoot(), file: entry }
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
