/**
 * 온디바이스 모델 manifest 검증 규칙 — **플러그인 `ManifestValidator.parse`(Manifest.kt)를 그대로 옮긴 것**(task-003f REV-021 HIGH).
 *
 * 서버가 "유효"로 내보내는 manifest 를 플러그인이 `MANIFEST_INVALID` 로 거부하면 모든 안드로이드 기기가 조용히 막힌다. 그래서 정본은
 * Kotlin 쪽이고, 여기는 같은 순서·같은 조건·같은 거부 사유(`manifest <reason> invalid` 의 <reason>)를 낸다. 두 구현은
 * `plugins/sherpa-stt/test-fixtures/manifest-cases.json`(developer A 관리, 사례별 플러그인 판정 `plugin`) 한 벌로 대조한다 — 서버는
 * `plugin` 이 valid·APP_UPDATE_REQUIRED(플러그인 버전 판단 — 서버는 내보낸다)인 사례만 통과시킨다. 규칙을 바꾸면 세 곳을 함께 고친다.
 *
 * 순수 모듈(import 없음) — 서버 라우트·배포 전 점검 CLI(`scripts/models-verify.sh`)·테스트가 함께 쓴다.
 * JSON 파서 차이(org.json ↔ `JSON.parse`)도 "서버가 더 느슨"한 쪽은 글자 단계에서 막는다(`parseManifestText`):
 *  - 중복 키 — org.json 은 거부(JSONException), `JSON.parse` 는 마지막 값 → 서버도 거부.
 *  - 정수 칸(`sampleRate`·`totalBytes`·`bytes`)의 소수·지수 표기(`16000.0`) — org.json 은 실수로 읽어 거부, `JSON.parse` 는 16000 → 서버도 거부.
 *  - 반대로 org.json 만 받아 주는 것(첫 값 뒤 꼬리 글자·작은따옴표)은 서버가 더 엄격한 쪽이라 둔다(서버가 안 내보냄 → 기기는 "쓸 수 없음").
 */

export const MANIFEST_RULES = {
  engine: 'sherpa-onnx',
  modelType: 'transducer',
  sampleRate: 16000,
  roles: ['encoder', 'decoder', 'joiner', 'tokens', 'vad'] as const,
  maxFiles: 16,
  maxTotalBytes: 300 * 1024 * 1024,
  maxManifestChars: 64 * 1024,
  indexFile: 'installed.json',
} as const

export type ModelRole = (typeof MANIFEST_RULES.roles)[number]

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const SHA_RE = /^[0-9a-f]{64}$/
const SEMVER_RE = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/
const ROLE_SET: ReadonlySet<string> = new Set(MANIFEST_RULES.roles)

export interface ModelFile {
  path: string
  sha256: string
  bytes: number
  role: ModelRole
}

export interface ModelManifest {
  name: string
  version: string
  totalBytes: number
  files: ModelFile[]
  minPluginVersion: string | null
  /** 그대로 옮겨 싣는 설명 필드(문자열만, 길이 제한) — 검증과 무관. */
  meta: Record<string, string>
}

export class ManifestError extends Error {
  constructor(readonly reason: string) {
    super(`manifest ${reason} invalid`)
    this.name = 'ManifestError'
  }
}

function invalid(reason: string): never {
  throw new ManifestError(reason)
}

/** 버전 = 디렉터리 이름 — 첫 글자 영숫자(임시 `.tmp-*`·`.`/`..` 와 겹치지 않게)·`..` 없음. */
export function isValidVersion(v: string): boolean {
  return VERSION_RE.test(v) && !v.includes('..')
}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function str(o: Obj, key: string): string {
  const v = o[key]
  return typeof v === 'string' ? v : invalid(key)
}

/** org.json `opt` 가 Int·Long 으로 주는 값만(문자열·실수 거부). */
function int(o: Obj, key: string): number {
  const v = o[key]
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : invalid(key)
}

const META_KEYS = ['model', 'language', 'license', 'source', 'createdAt'] as const

/** 이미 JSON 으로 읽은 값 검증. Kotlin 과 같은 순서로 검사한다. */
export function parseManifest(raw: unknown): ModelManifest {
  if (!isObj(raw)) invalid('manifest is not an object')
  const root = raw
  const name = str(root, 'name')
  const version = str(root, 'version')
  if (!NAME_RE.test(name) || name.includes('..')) invalid('name')
  if (!isValidVersion(version)) invalid('version')
  if (str(root, 'engine') !== MANIFEST_RULES.engine) invalid('engine')
  if (str(root, 'modelType') !== MANIFEST_RULES.modelType) invalid('modelType')
  if (int(root, 'sampleRate') !== MANIFEST_RULES.sampleRate) invalid('sampleRate')

  const arr = root.files
  if (!Array.isArray(arr)) invalid('files')
  if (arr.length < MANIFEST_RULES.roles.length || arr.length > MANIFEST_RULES.maxFiles) invalid('files count')
  const files: ModelFile[] = []
  const paths = new Set<string>()
  const roles = new Set<string>()
  arr.forEach((entry, i) => {
    if (!isObj(entry)) invalid(`files[${i}]`)
    const path = str(entry, 'path')
    if (!FILE_RE.test(path) || path.includes('..') || path === MANIFEST_RULES.indexFile || path.endsWith('.part')) invalid(`files[${i}].path`)
    // 소문자만 — 대문자를 받아 주면 두 검증기의 판정이 갈린다(플러그인도 소문자만).
    const sha256 = str(entry, 'sha256')
    if (!SHA_RE.test(sha256)) invalid(`files[${i}].sha256`)
    const bytes = int(entry, 'bytes')
    if (bytes <= 0 || bytes > MANIFEST_RULES.maxTotalBytes) invalid(`files[${i}].bytes`)
    const role = str(entry, 'role')
    if (!ROLE_SET.has(role)) invalid(`files[${i}].role`)
    if (paths.has(path)) invalid('duplicate path')
    paths.add(path)
    if (roles.has(role)) invalid('duplicate role')
    roles.add(role)
    files.push({ path, sha256, bytes, role: role as ModelRole })
  })
  if (roles.size !== ROLE_SET.size || [...ROLE_SET].some((r) => !roles.has(r))) invalid('missing roles')
  const sum = files.reduce((a, f) => a + f.bytes, 0)
  if (sum > MANIFEST_RULES.maxTotalBytes) invalid('total too large')
  if (int(root, 'totalBytes') !== sum) invalid('totalBytes mismatch')

  let minPluginVersion: string | null = null
  const mp = root.minPluginVersion
  if (mp !== undefined && mp !== null) {
    if (typeof mp !== 'string' || !SEMVER_RE.test(mp)) invalid('minPluginVersion')
    minPluginVersion = mp
  }

  const meta: Record<string, string> = {}
  for (const k of META_KEYS) {
    const v = root[k]
    if (typeof v === 'string' && v.length > 0 && v.length <= 300 && !/[\x00-\x1f\x7f]/.test(v)) meta[k] = v
  }
  return { name, version, totalBytes: sum, files, minPluginVersion, meta }
}

/**
 * 객체마다 같은 키가 두 번 나오는지 — 키는 **JSON 문자열 이스케이프를 푼 값**으로 비교한다(`"engine"` 과 `"\u0065ngine"` 은 같은 키).
 * 원문 글자로 비교하면 이스케이프로 쓴 중복 키를 놓쳐 서버가 플러그인보다 느슨해진다(REV-021 부류, A 가 찾은 틈).
 * 문자열 끝은 이스케이프(`\x`)를 건너뛰며 찾고, 키 글자는 그 조각을 `JSON.parse` 로 풀어 쓴다(파서와 같은 규칙).
 * 원문이 JSON 으로 읽히는지는 호출부(`parseManifestText`)가 먼저 확인한다 — 여기서 못 푸는 조각은 거절 쪽(true)으로 둔다.
 */
export function hasDuplicateKeys(text: string): boolean {
  const stack: Array<Set<string> | null> = []
  let expectKey = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      const top = stack[stack.length - 1]
      if (expectKey && top) {
        let key: unknown
        try {
          key = JSON.parse(text.slice(i, j + 1))
        } catch {
          return true
        }
        if (typeof key !== 'string' || top.has(key)) return true
        top.add(key)
      }
      expectKey = false
      i = j
      continue
    }
    if (ch === '{') {
      stack.push(new Set())
      expectKey = true
    } else if (ch === '[') stack.push(null)
    else if (ch === '}' || ch === ']') stack.pop()
    else if (ch === ',') expectKey = !!stack[stack.length - 1]
  }
  return false
}

const NON_INTEGER_FIELD = /"(sampleRate|totalBytes|bytes)"\s*:\s*-?\d+(?:\.\d*|[eE][+-]?\d+)/

/** manifest 파일 글자 그대로 검증(크기 상한 → 파서 차이 → JSON → 규칙). */
export function parseManifestText(text: string): ModelManifest {
  if (text.length > MANIFEST_RULES.maxManifestChars) invalid('manifest too large')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    invalid('manifest is not valid json')
  }
  if (hasDuplicateKeys(text)) invalid('manifest is not valid json')
  const frac = NON_INTEGER_FIELD.exec(text)
  if (frac) invalid(frac[1])
  return parseManifest(raw)
}
