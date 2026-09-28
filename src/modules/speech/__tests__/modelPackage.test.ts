import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelDirFromConfig, MODEL_TOTAL_MAX_BYTES, ONDEVICE_MODEL_ID, parseManifest, publicManifest } from '../stt/modelPackage'

const sha = (c: string) => c.repeat(64)

function manifest(over: Record<string, unknown> = {}) {
  return {
    name: 'pkg-a',
    version: '2024-08-01-int8-v1',
    engine: 'e',
    model: 'm',
    sampleRate: 16000,
    minPluginVersion: '0.1.0',
    files: [
      { path: 'encoder.int8.onnx', sha256: sha('a'), bytes: 1000, role: 'encoder' },
      { path: 'tokens.txt', sha256: sha('b'), bytes: 20, role: 'tokens' },
    ],
    totalBytes: 1020,
    ...over,
  }
}

/** `speech/models/manifest.example.json` 의 실제 값(미러에는 speech/ 가 동기화되지 않아 옮겨 적는다). */
const EXAMPLE = { name: "pkg-real", version: "2024-08-01-int8-v1", files: [{"path": "encoder-epoch-99-avg-1.int8.onnx", "sha256": "2c7bd08a8a99f9ddd0d9e458456577b1f6279214e51426f114f9eced44c54e1d", "bytes": 154670139, "role": "encoder"}, {"path": "decoder-epoch-99-avg-1.onnx", "sha256": "58b18211ae06265466bfa17172dab574df94f76c8bcb61a3640c28ba860e4124", "bytes": 11767836, "role": "decoder"}, {"path": "joiner-epoch-99-avg-1.int8.onnx", "sha256": "49cc7ea1d3d35a40a27442db5e89996da64bf0e683a903dce76e99e57a12e4de", "bytes": 2696970, "role": "joiner"}, {"path": "tokens.txt", "sha256": "2c3ac659818a48a0c04010e0593bbc4d7c8a24a054340b01131499c05fd52def", "bytes": 45754, "role": "tokens"}, {"path": "silero_vad.onnx", "sha256": "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6", "bytes": 643854, "role": "vad"}], totalBytes: 169824553 }

test('#9 parseManifest: 저장소 예시 manifest(실제 값)가 통과한다', () => {
  const raw = EXAMPLE
  const m = parseManifest(raw)
  assert.equal(m.files.length, 5)
  assert.equal(m.totalBytes, raw.totalBytes)
  assert.ok(m.totalBytes <= MODEL_TOTAL_MAX_BYTES)
})

test('#9 parseManifest(C1-3): 이름 패턴·sha256·크기·합계·중복·파일 수·총량 상한 위반은 거부', () => {
  assert.equal(parseManifest(manifest()).version, '2024-08-01-int8-v1')
  const bad: Array<[string, Record<string, unknown>]> = [
    ['경로 구분자', { files: [{ path: '../x', sha256: sha('a'), bytes: 1 }], totalBytes: 1 }],
    ['하위 경로', { files: [{ path: 'a/b', sha256: sha('a'), bytes: 1 }], totalBytes: 1 }],
    ['점으로 시작', { files: [{ path: '.env', sha256: sha('a'), bytes: 1 }], totalBytes: 1 }],
    ['sha256 형식', { files: [{ path: 'a', sha256: 'A'.repeat(64), bytes: 1 }], totalBytes: 1 }],
    ['sha256 누락', { files: [{ path: 'a', bytes: 1 }], totalBytes: 1 }],
    ['크기 0', { files: [{ path: 'a', sha256: sha('a'), bytes: 0 }], totalBytes: 0 }],
    ['크기 소수', { files: [{ path: 'a', sha256: sha('a'), bytes: 1.5 }], totalBytes: 1.5 }],
    ['합계 불일치', { totalBytes: 1021 }],
    ['중복 경로', { files: [{ path: 'a', sha256: sha('a'), bytes: 1 }, { path: 'a', sha256: sha('b'), bytes: 1 }], totalBytes: 2 }],
    ['파일 없음', { files: [], totalBytes: 0 }],
    ['파일 17개', { files: Array.from({ length: 17 }, (_, i) => ({ path: `f${i}`, sha256: sha('a'), bytes: 1 })), totalBytes: 17 }],
    ['총량 상한', { files: [{ path: 'a', sha256: sha('a'), bytes: MODEL_TOTAL_MAX_BYTES }, { path: 'b', sha256: sha('a'), bytes: 1 }], totalBytes: MODEL_TOTAL_MAX_BYTES + 1 }],
    ['version 형식', { version: '../v1' }],
    ['version 짧음', { version: 'v1' }],
    ['name 형식', { name: 'a/b' }],
  ]
  for (const [label, over] of bad) assert.throws(() => parseManifest(manifest(over)), { name: 'ManifestError' }, label)
  assert.throws(() => parseManifest(null), { name: 'ManifestError' })
  assert.throws(() => parseManifest([]), { name: 'ManifestError' })
})

test('#9 publicManifest: 불투명 id·같은 origin 절대 URL(= manifest 디렉터리/version/path)·설명 필드는 문자열만', () => {
  const m = parseManifest(manifest({ source: 'x\u0000y', license: 'Apache-2.0' }))
  const p = publicManifest(m, 'https://kaiwa.example')
  assert.equal(p.id, ONDEVICE_MODEL_ID)
  assert.equal(p.version, '2024-08-01-int8-v1')
  assert.equal(p.totalBytes, 1020)
  assert.equal(p.baseUrl, `https://kaiwa.example/models/${ONDEVICE_MODEL_ID}/2024-08-01-int8-v1/`)
  for (const f of p.files) {
    const u = new URL(f.url)
    assert.equal(u.origin, 'https://kaiwa.example')
    assert.equal(f.url, `${p.baseUrl}${f.path}`, '플러그인 규칙(manifest 디렉터리/version/path)과 같은 주소')
    assert.match(f.sha256, /^[0-9a-f]{64}$/)
  }
  assert.equal((p as Record<string, unknown>).source, undefined, '제어문자가 든 설명 필드는 버린다')
  assert.equal((p as Record<string, unknown>).license, 'Apache-2.0')
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
