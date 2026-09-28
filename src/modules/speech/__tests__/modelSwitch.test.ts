import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseManifest } from '../stt/manifestRules'
import { ModelDistribution, ONDEVICE_MODEL_ID, RETIRED_MAX, RETIRED_TTL_MS, serveModelFile, type ServedModel } from '../stt/modelPackage'

/**
 * 모델 버전 전환 중 이어받기(task-003f Codex C2 지적 2) — 전환 전에 시작한 받기는 직전 버전의 **검증된 스냅샷**에 적힌 파일만 TTL 동안 받는다.
 * 디스크에 남아 있기만 한 파일(스냅샷 밖)·TTL 지난 버전·배포가 꺼진 뒤는 404.
 */
const ROLES = ['encoder', 'decoder', 'joiner', 'tokens', 'vad'] as const

function makeVersion(root: string, dir: string, version: string, extra = false) {
  const vdir = join(root, dir, version)
  mkdirSync(vdir, { recursive: true })
  const files = ROLES.map((role, i) => {
    const data = randomBytes(1000 + i * 37)
    const path = `${role}-${version}.bin`
    writeFileSync(join(vdir, path), data)
    return { path, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length, role }
  })
  if (extra) writeFileSync(join(vdir, 'stray.bin'), randomBytes(50))
  const manifest = parseManifest({ name: dir, version, engine: 'sherpa-onnx', modelType: 'transducer', sampleRate: 16000, files, totalBytes: files.reduce((a, f) => a + f.bytes, 0) })
  return { dir, manifest } satisfies ServedModel
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'kaiwa-switch-'))
  const prevEnv = process.env.SPEECH_MODELS_DIR
  process.env.SPEECH_MODELS_DIR = root
  let now = 1_000_000
  let current: ServedModel | null = null
  const dist = new ModelDistribution(async () => current, () => now)
  return {
    root,
    dist,
    set: (s: ServedModel | null) => (current = s),
    advance: (ms: number) => (now += ms),
    done: () => {
      if (prevEnv === undefined) delete process.env.SPEECH_MODELS_DIR
      else process.env.SPEECH_MODELS_DIR = prevEnv
      rmSync(root, { recursive: true, force: true })
    },
  }
}

async function status(dist: ModelDistribution, version: string, file: string, headers: Record<string, string> = {}): Promise<number> {
  const target = await dist.resolveFile(ONDEVICE_MODEL_ID, version, file)
  if (!target) return 404
  const res = await serveModelFile(new Request('http://x/m', { headers }), target)
  await res.body?.cancel()
  return res.status
}

test('C2: 전환 전에는 현재 버전만, 전환 뒤 TTL 동안 직전 버전 파일도 200/206(이어받기), 스냅샷 밖 파일은 404', async () => {
  const t = setup()
  try {
    const v1 = makeVersion(t.root, 'pkg', 'm-2024-v1', true)
    const v2 = makeVersion(t.root, 'pkg', 'm-2024-v2')
    t.set(v1)
    const f1 = v1.manifest.files[0].path
    const f2 = v2.manifest.files[0].path
    assert.equal(await status(t.dist, 'm-2024-v1', f1), 200)
    assert.equal(await status(t.dist, 'm-2024-v2', f2), 404, '아직 현재가 아닌 새 버전은 404(디스크에 있어도)')

    t.set(v2)
    assert.equal((await t.dist.current())?.manifest.version, 'm-2024-v2', '현재 manifest 는 늘 최신')
    assert.deepEqual(t.dist.retiredVersions(), ['m-2024-v1'])
    assert.equal(await status(t.dist, 'm-2024-v2', f2), 200)
    assert.equal(await status(t.dist, 'm-2024-v1', f1), 200, '전환 전에 시작한 받기 — 직전 버전 파일')
    assert.equal(await status(t.dist, 'm-2024-v1', f1, { Range: 'bytes=100-' }), 206, '이어받기(Range)')
    const target = await t.dist.resolveFile(ONDEVICE_MODEL_ID, 'm-2024-v1', f1)
    assert.equal(target?.retired, true)
    assert.equal(await status(t.dist, 'm-2024-v1', 'stray.bin'), 404, '스냅샷에 없는 파일은 디스크에 있어도 404')
    assert.equal(await status(t.dist, 'm-2024-v1', f2), 404, '다른 버전의 파일 이름')

    t.advance(RETIRED_TTL_MS - 1)
    assert.equal(await status(t.dist, 'm-2024-v1', f1), 200, 'TTL 직전까지')
    t.advance(2)
    assert.equal(await status(t.dist, 'm-2024-v1', f1), 404, 'TTL 이 지나면 404')
    assert.deepEqual(t.dist.retiredVersions(), [])
  } finally {
    t.done()
  }
})

test('C2: 은퇴 보관은 최대 2개, 배포가 꺼지면 은퇴 버전도 404, 되돌아온 버전은 은퇴 목록에서 빠진다', async () => {
  const t = setup()
  try {
    const vs = ['m-v1', 'm-v2', 'm-v3', 'm-v4'].map((v) => makeVersion(t.root, 'pkg', v))
    for (const v of vs) {
      t.set(v)
      await t.dist.current()
    }
    assert.equal(RETIRED_MAX, 2)
    assert.deepEqual(t.dist.retiredVersions(), ['m-v3', 'm-v2'])
    assert.equal(await status(t.dist, 'm-v1', vs[0].manifest.files[0].path), 404, '가장 오래된 것은 밀려났다')
    assert.equal(await status(t.dist, 'm-v2', vs[1].manifest.files[0].path), 200)

    t.set(vs[2])
    await t.dist.current()
    assert.deepEqual(t.dist.retiredVersions(), ['m-v4', 'm-v2'], 'v3 로 되돌리면 v3 는 현재 — 은퇴 목록에서 빠진다')

    t.set(null)
    assert.equal(await status(t.dist, 'm-v2', vs[1].manifest.files[0].path), 404, '배포가 꺼지면(connection 끔·manifest 무효) 은퇴 버전도 서빙하지 않는다')
    assert.equal(await status(t.dist, 'm-v3', vs[2].manifest.files[0].path), 404)
  } finally {
    t.done()
  }
})

test('C2: 은퇴 버전 파일도 기록과 크기가 다르면 404(검증된 스냅샷 기준 서빙)', async () => {
  const t = setup()
  try {
    const v1 = makeVersion(t.root, 'pkg', 'm-v1')
    const v2 = makeVersion(t.root, 'pkg', 'm-v2')
    t.set(v1)
    await t.dist.current()
    t.set(v2)
    await t.dist.current()
    const f = v1.manifest.files[1]
    writeFileSync(join(t.root, 'pkg', 'm-v1', f.path), randomBytes(f.bytes + 5))
    assert.equal(await status(t.dist, 'm-v1', f.path), 404)
  } finally {
    t.done()
  }
})
