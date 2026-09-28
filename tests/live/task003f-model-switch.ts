/**
 * task-003f Codex C2 지적 2 라이브 — 모델 버전 전환 중 이어받기.
 *
 *   1) prepare <루트>: 루트에 가짜 모델 패키지 v1(역할 5개·작은 파일·규칙 통과 manifest)을 만든다.
 *   2) dev 서버를 `SPEECH_MODELS_DIR=<루트>` 로 띄운다(운영·저장소 모델 디렉터리를 건드리지 않는다).
 *   3) run <루트>: manifest(v1) → v1 파일 앞부분 Range 받기 → v2 배치 + manifest.json 원자적 교체 → manifest 가 v2 인지 →
 *      **v1 이어받기 206(바이트 일치)** · v1 스냅샷 밖 파일 404 · v2 파일 200 · 옛 v0(스냅샷 없음) 404.
 *   node --env-file=.env --import tsx tests/live/task003f-model-switch.ts prepare /tmp/…/switch-root
 *   BASE=http://127.0.0.1:3011 node --env-file=.env --import tsx tests/live/task003f-model-switch.ts run /tmp/…/switch-root
 * 루트는 스크래치(임시) 디렉터리만 쓴다. 끝나면 호출자가 지운다.
 */
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [mode, root] = process.argv.slice(2)
if (!root || !['prepare', 'run'].includes(mode)) throw new Error('사용: task003f-model-switch.ts prepare|run <루트>')
const PKG = 'reazonspeech-int8'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const ROLES = ['encoder', 'decoder', 'joiner', 'tokens', 'vad']

function writeVersion(version: string, stray = false): Record<string, unknown> {
  const dir = join(root, PKG, version)
  mkdirSync(dir, { recursive: true })
  const files = ROLES.map((role, i) => {
    const data = randomBytes(40_000 + i * 1000)
    const path = `${role}.bin`
    writeFileSync(join(dir, path), data)
    return { path, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length, role }
  })
  if (stray) writeFileSync(join(dir, 'stray.bin'), randomBytes(100))
  return { name: PKG, version, engine: 'sherpa-onnx', modelType: 'transducer', sampleRate: 16000, files, totalBytes: files.reduce((a, f) => a + f.bytes, 0) }
}

function publish(manifest: Record<string, unknown>): void {
  const tmp = join(root, PKG, 'manifest.new.json')
  writeFileSync(tmp, JSON.stringify(manifest, null, 2))
  renameSync(tmp, join(root, PKG, 'manifest.json'))
}

const results: boolean[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

async function manifest(): Promise<{ version: string; files: Array<{ path: string; bytes: number; url: string; sha256: string }> }> {
  const r = await fetch(`${BASE}/models/ondevice-ja-v1/manifest.json`, { cache: 'no-store' })
  if (r.status !== 200) throw new Error(`manifest ${r.status}`)
  return r.json()
}

async function main(): Promise<void> {
  if (mode === 'prepare') {
    publish(writeVersion('switch-v1', true))
    console.log(`prepared ${join(root, PKG)} (v1)`)
    return
  }
  const m1 = await manifest()
  check('S1 전환 전 manifest = v1', m1.version === 'switch-v1')
  const enc = m1.files[0]
  const whole = readFileSync(join(root, PKG, 'switch-v1', enc.path))
  const head = await fetch(enc.url, { headers: { Range: 'bytes=0-999' } })
  check('S2 v1 받기 시작(Range 206)', head.status === 206 && Buffer.from(await head.arrayBuffer()).equals(whole.subarray(0, 1000)))

  publish(writeVersion('switch-v2'))
  const m2 = await manifest()
  check('S3 전환 뒤 manifest(#9) = v2(늘 최신)', m2.version === 'switch-v2')
  const resume = await fetch(enc.url, { headers: { Range: 'bytes=1000-', 'If-Range': `"${enc.sha256}"` } })
  const rest = Buffer.from(await resume.arrayBuffer())
  check('S4 전환 전에 시작한 v1 받기 이어받기 206·바이트 일치', resume.status === 206 && rest.equals(whole.subarray(1000)), `${resume.status}`)
  const stray = await fetch(`${BASE}/models/ondevice-ja-v1/switch-v1/stray.bin`)
  check('S5 v1 디렉터리에 있어도 스냅샷 밖 파일은 404', stray.status === 404)
  const v2 = await fetch(m2.files[1].url)
  await v2.arrayBuffer()
  check('S6 v2 파일 200', v2.status === 200)
  const v0 = await fetch(`${BASE}/models/ondevice-ja-v1/switch-v0/${enc.path}`)
  check('S7 스냅샷이 없는 옛 버전 404', v0.status === 404)
  const failed = results.filter((x) => !x).length
  console.log(`\n== task-003f model switch: ${results.length - failed}/${results.length} PASS`)
  process.exitCode = failed ? 1 : 0
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : String(e))
  process.exitCode = 1
})
