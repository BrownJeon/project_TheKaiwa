import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MANIFEST_RULES, ManifestError, parseManifest, parseManifestText } from '../stt/manifestRules'
import { modelDirFromConfig, ONDEVICE_MODEL_ID, publicManifest } from '../stt/modelPackage'

/**
 * 서버 manifest 검증 = 플러그인 `ManifestValidator`(Manifest.kt) — REV-021 HIGH. 공용 픽스처 `plugins/sherpa-stt/test-fixtures/manifest-cases.json`
 * (developer A 관리 — Kotlin `ManifestFixtureTest` 도 같은 파일을 읽는다)의 사례마다 `plugin` 판정을 보고, 서버는 valid·APP_UPDATE_REQUIRED
 * (플러그인 버전 판단 — 서버는 내보낸다)만 통과시키고 나머지는 거절해야 한다. "서버 통과 → 기기 거부"가 한 건도 없어야 한다.
 */
const ROOT = join(__dirname, '..', '..', '..', '..')
const FIXTURE = join(ROOT, 'plugins', 'sherpa-stt', 'test-fixtures', 'manifest-cases.json')

interface Case {
  name: string
  plugin: 'valid' | 'MANIFEST_INVALID' | 'APP_UPDATE_REQUIRED'
  manifest?: unknown
  raw?: string
}
interface Fixture {
  limits: { maxManifestBytes: number; maxTotalBytes: number; minFiles: number; maxFiles: number; roles: string[]; engine: string; modelType: string; sampleRate: number }
  cases: Case[]
}

const fx = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture
const base = fx.cases.find((c) => c.name === 'valid-disk')?.manifest as Record<string, unknown>

test('규칙 상수 = 픽스처 limits(= Kotlin ManifestValidator)', () => {
  assert.deepEqual(
    {
      maxManifestBytes: MANIFEST_RULES.maxManifestChars,
      maxTotalBytes: MANIFEST_RULES.maxTotalBytes,
      minFiles: MANIFEST_RULES.roles.length,
      maxFiles: MANIFEST_RULES.maxFiles,
      roles: [...MANIFEST_RULES.roles],
      engine: MANIFEST_RULES.engine,
      modelType: MANIFEST_RULES.modelType,
      sampleRate: MANIFEST_RULES.sampleRate,
    },
    fx.limits,
  )
})

test('#9 공용 픽스처 전 사례 — 서버 판정 = 플러그인 판정(valid·APP_UPDATE_REQUIRED 만 통과)', () => {
  assert.ok(fx.cases.length >= 40 && !!base)
  const mismatch: string[] = []
  for (const c of fx.cases) {
    const text = c.raw ?? JSON.stringify(c.manifest)
    let serverOk = true
    try {
      parseManifestText(text)
    } catch (e) {
      if (!(e instanceof ManifestError)) throw e
      serverOk = false
    }
    const pluginOk = c.plugin === 'valid' || c.plugin === 'APP_UPDATE_REQUIRED'
    if (serverOk !== pluginOk) mismatch.push(`${c.name}(server=${serverOk ? 'ok' : 'reject'}, plugin=${c.plugin})`)
  }
  assert.deepEqual(mismatch, [], '서버와 플러그인 판정이 갈리는 사례')
})

test('#9 파서 차이도 서버가 느슨하지 않게: 중복 키·정수 칸의 소수/지수 표기는 거절(org.json 이 거부하는 것)', () => {
  const good = JSON.stringify(base)
  assert.doesNotThrow(() => parseManifestText(good))
  const dup = good.replace('"engine":"sherpa-onnx",', '"engine":"sherpa-onnx","engine":"sherpa-onnx",')
  assert.notEqual(dup, good)
  assert.throws(() => parseManifestText(dup), (e: unknown) => e instanceof ManifestError && e.reason === 'manifest is not valid json')
  assert.throws(() => parseManifestText(good.replace('"sampleRate":16000', '"sampleRate":16000.0')), (e: unknown) => e instanceof ManifestError && e.reason === 'sampleRate')
  assert.throws(() => parseManifestText(good.replace('"totalBytes":169824553', '"totalBytes":1.69824553e8')), (e: unknown) => e instanceof ManifestError && e.reason === 'totalBytes')
  const fileDup = good.replace('"role":"vad"', '"role":"vad","role":"vad"')
  assert.throws(() => parseManifestText(fileDup), /not valid json/, '파일 객체 안 중복 키도')
  assert.doesNotThrow(() => parseManifestText(good.replace('"license":"Apache-2.0"', '"license":"Apache-2.0","rtf":0.054')), '검사하지 않는 칸의 소수는 플러그인도 받는다')
  assert.doesNotThrow(() => parseManifestText(JSON.stringify({ ...base, note: 'a "quoted" \\ "engine": x' })), '문자열 안 따옴표·이스케이프는 키가 아니다')
  // 이스케이프로 쓴 같은 키 — 푼 키로 비교해야 잡힌다(Codex C2 후속, A 가 찾은 틈).
  const esc = good.replace('"engine":', '"\\u0065ngine":"sherpa-onnx","engine":')
  assert.ok(esc.includes('\\u0065ngine'))
  assert.throws(() => parseManifestText(esc), /not valid json/, '\\u0065ngine = engine')
  assert.throws(() => parseManifestText(good.replace('"role":"vad"', '"r\\u006fle":"vad","role":"vad"')), /not valid json/, '파일 객체 안 이스케이프 중복')
  assert.doesNotThrow(() => parseManifestText(good.replace('"engine":', '"\\u0065ngine":')), '이스케이프로 쓴 키가 한 번뿐이면 정상 키')
  assert.doesNotThrow(() => parseManifestText(good.replace('"engine":', '"\\/engine":"x","engine":')), '다른 값으로 풀리는 이스케이프 키(/engine)는 중복이 아니다')
})

test('#9 실제 배포 manifest(speech/models/reazonspeech-int8) 통과 — 저장소가 보이는 곳에서만(미러는 THEKAIWA_REPO)', (t) => {
  const repo = process.env.THEKAIWA_REPO ?? ROOT
  const real = join(repo, 'speech', 'models', 'reazonspeech-int8', 'manifest.json')
  const example = join(repo, 'speech', 'models', 'manifest.example.json')
  const path = existsSync(real) ? real : existsSync(example) ? example : null
  if (!path) {
    t.skip('저장소 speech/models 가 없는 실행 위치(미러) — 픽스처 valid-disk 사례와 scripts/models-verify.sh 가 같은 값을 본다')
    return
  }
  const m = parseManifestText(readFileSync(path, 'utf8'))
  assert.equal(m.files.length, 5)
  assert.deepEqual(new Set(m.files.map((f) => f.role)), new Set(MANIFEST_RULES.roles))
})

test('#9 publicManifest: 불투명 id·같은 origin 절대 URL, 내보낸 본문이 다시 같은 규칙을 통과(플러그인이 받는 그대로)', () => {
  const m = parseManifest(base)
  const p = publicManifest(m, 'https://kaiwa.example')
  assert.equal(p.id, ONDEVICE_MODEL_ID)
  assert.equal(p.baseUrl, `https://kaiwa.example/models/${ONDEVICE_MODEL_ID}/${m.version}/`)
  for (const f of p.files) assert.equal(f.url, `${p.baseUrl}${f.path}`, '플러그인 규칙(manifest 디렉터리/version/path)과 같은 주소')
  const again = parseManifestText(JSON.stringify(p))
  assert.deepEqual(again.files, m.files)
  assert.equal(again.totalBytes, m.totalBytes)
  assert.equal(again.minPluginVersion, m.minPluginVersion)
})

test('connection.manifestUrl → 디스크 디렉터리(형식이 다르면 null)', () => {
  assert.equal(modelDirFromConfig('/models/pkg-a/manifest.json'), 'pkg-a')
  assert.equal(modelDirFromConfig('/models/../manifest.json'), null)
  assert.equal(modelDirFromConfig('/models/a/b/manifest.json'), null)
  assert.equal(modelDirFromConfig('https://x/models/a/manifest.json'), null)
  assert.equal(modelDirFromConfig(null), null)
})

test('공개 id 에 엔진·모델 이름이 없다(#19 onDevice.model 불투명 — 완료 기준 8)', () => {
  assert.doesNotMatch(ONDEVICE_MODEL_ID, /reazon|sherpa|whisper|zipformer|style-?bert/i)
})
