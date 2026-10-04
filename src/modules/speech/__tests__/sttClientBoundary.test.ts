import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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

/**
 * 컴포넌트가 쓰는 speech 는 클라이언트 진입점 `@/modules/speech/stt/client`·`@/modules/speech/tts/client`(task-007 재생 큐) 뿐 —
 * 루트 index(Prisma·engine 포함)·다른 하위 경로 금지(REV-013 M2, eslint 와 이중 확인).
 */
const COMPONENTS = join(__dirname, '..', '..', '..', 'components')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

function speechImportViolations(src: string): string[] {
  const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g), ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
  // reading/client = 히라가나·한글 줄 변환기(task-026 — eslint 컴포넌트 경계와 같은 허용 목록).
  return specs.filter((s) => /^@\/modules\/speech(\/|$)/.test(s) && !/^@\/modules\/speech\/(stt|tts|reading)\/client(\/|$)/.test(s))
}

test('컴포넌트는 speech 루트 index 를 import 하지 않는다(stt/tts/reading client 만)', () => {
  assert.deepEqual(speechImportViolations(`import { x } from '@/modules/speech'`), ['@/modules/speech'], '루트 금지를 잡는다')
  assert.deepEqual(speechImportViolations(`import type { Y } from '@/modules/speech/tts'`), ['@/modules/speech/tts'])
  assert.deepEqual(speechImportViolations(`import { z } from '@/modules/speech/stt/client'`), [])
  assert.deepEqual(speechImportViolations(`import { q } from '@/modules/speech/tts/client'`), [])
  assert.deepEqual(speechImportViolations(`import { q } from '@/modules/speech/tts/cache'`), ['@/modules/speech/tts/cache'])
  assert.deepEqual(speechImportViolations(`import { h } from '@/modules/speech/reading/client'`), [])
  assert.deepEqual(speechImportViolations(`import { r } from '@/modules/speech/reading'`), ['@/modules/speech/reading'])
  const files = walk(COMPONENTS)
  assert.ok(files.length > 10)
  for (const f of files) assert.deepEqual(speechImportViolations(readFileSync(f, 'utf8')), [], f)
})
