/**
 * DATA_ROOT 파일 저장(module-dependency L6 `infra.storage`) — 발화 wav·TTS 캐시 등.
 *
 * 경로는 **호출자가 준 조각을 검증해 DATA_ROOT 아래로만** 만든다: 조각은 `[A-Za-z0-9._-]`(선두는 영숫자)·`..` 불가,
 * 합친 결과가 루트 밖이면 거부한다. 사용자 입력은 조각으로 쓰지 않는다(호출자는 해시·서버 발급 id 만 넘긴다).
 * 쓰기는 같은 디렉터리의 임시 파일에 쓴 뒤 rename — 읽는 쪽이 반쯤 쓰인 파일을 보지 않는다.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

export function dataRoot(): string {
  const raw = process.env.DATA_ROOT?.trim()
  if (!raw) throw new StorageError('DATA_ROOT 가 설정되지 않았습니다')
  return resolve(raw)
}

function joinUnder(root: string, segments: string[]): string {
  if (segments.length === 0) throw new StorageError('경로 조각이 없습니다')
  for (const s of segments) if (!SEGMENT.test(s) || s.includes('..')) throw new StorageError('허용되지 않는 경로 조각')
  const full = resolve(root, ...segments)
  if (!full.startsWith(root + sep)) throw new StorageError('루트 밖 경로')
  return full
}

/** DATA_ROOT 아래 절대 경로. 조각 규칙 위반·루트 이탈은 StorageError. */
export function dataPath(...segments: string[]): string {
  return joinUnder(dataRoot(), segments)
}

/**
 * 온디바이스 모델 배포 루트(#9·#10) — `SPEECH_MODELS_DIR`(절대 경로) > `DATA_ROOT/models`.
 * gateway 의 우선순위(ecosystem.config.js)에서 저장소 사본(`speech/models`)만 뺐다 — 릴리스·미러 트리에는 모델이 없고,
 * 앱이 내려받는 배포본은 한 곳이어야 sha256 기록과 실제 파일이 갈라지지 않는다.
 */
export function modelsRoot(): string {
  const raw = process.env.SPEECH_MODELS_DIR?.trim()
  if (raw) {
    if (!isAbsolute(raw)) throw new StorageError('SPEECH_MODELS_DIR 는 절대 경로여야 합니다')
    return resolve(raw)
  }
  return resolve(dataRoot(), 'models')
}

export function modelsPath(...segments: string[]): string {
  return joinUnder(modelsRoot(), segments)
}

/**
 * 실경로(심볼릭 링크 해석 후)가 `root` 아래면 그 실경로, 아니면·없으면 null. 공개로 내보내는 파일에 쓴다 —
 * 배포 디렉터리 안에 누가 밖을 가리키는 링크를 두어도 따라 나가지 않는다.
 */
export async function realpathInside(root: string, full: string): Promise<string | null> {
  try {
    const [r, f] = await Promise.all([realpath(root), realpath(full)])
    return f.startsWith(r + sep) ? f : null
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    throw e
  }
}

export async function writeDataFile(segments: string[], data: Buffer): Promise<string> {
  const full = dataPath(...segments)
  await mkdir(dirname(full), { recursive: true })
  const tmp = `${full}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tmp, data, { mode: 0o640 })
    await rename(tmp, full)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => undefined)
    throw e
  }
  return full
}

/** 없으면 null(ENOENT 만 삼킨다). */
export async function readDataFile(segments: string[]): Promise<Buffer | null> {
  try {
    return await readFile(dataPath(...segments))
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return null
    throw e
  }
}

export async function removeDataFile(segments: string[]): Promise<void> {
  await rm(dataPath(...segments), { force: true })
}

/** 파일을 다른 프로세스(gateway)가 옮겨 넣을 디렉터리를 미리 만든다. 마지막 조각은 파일명이며 만들지 않는다. */
export async function ensureDataDir(segments: string[]): Promise<string> {
  const full = dataPath(...segments)
  await mkdir(dirname(full), { recursive: true })
  return full
}
