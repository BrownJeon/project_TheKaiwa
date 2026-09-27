import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `speech/stt/client/**` 는 브라우저 번들에 들어간다 — 서버 코드를 import 하지 않는다(Leader M4, eslint 규칙과 이중 확인).
 * 허용: 같은 디렉터리 상대 경로(`./x`) · `@/modules/infra/native` · `@/types/*`.
 */
const DIR = join(__dirname, '..', 'stt', 'client')
const ALLOWED = [/^\.\/[A-Za-z0-9_-]+$/, /^@\/modules\/infra\/native(\/|$)/, /^@\/types\//]

test('speech 클라이언트 진입점은 서버 모듈을 import 하지 않는다', () => {
  const files = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f))
  assert.ok(files.includes('index.ts'))
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8')
    const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g), ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
    for (const s of specs) assert.ok(ALLOWED.some((re) => re.test(s)), `${f}: 허용되지 않은 import '${s}'`)
    assert.doesNotMatch(src, /process\.env|reazon|sherpa|whisper/i, `${f}: 서버 설정·엔진명`)
  }
})
