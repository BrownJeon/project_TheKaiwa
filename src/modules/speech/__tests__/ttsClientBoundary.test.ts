import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `speech/tts/client/**` 는 브라우저 번들에 들어간다(task-007 재생 큐) — 서버 코드를 import 하지 않는다(eslint 규칙과 이중 확인).
 * 허용: 같은 디렉터리 상대 경로(`./x`) · 순수 문장 분할기 `../sentences` · `@/types/*`. 오디오·fetch 는 주입받는다.
 */
const DIR = join(__dirname, '..', 'tts', 'client')
const ALLOWED = [/^\.\/[A-Za-z0-9_-]+$/, /^\.\.\/sentences$/, /^@\/types\//]

function specsOf(src: string): string[] {
  return [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g), ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
}

test('TTS 클라이언트 진입점은 서버 모듈을 import 하지 않는다', () => {
  const files = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f))
  assert.ok(files.includes('index.ts'))
  assert.ok(files.includes('playbackQueue.ts'))
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8')
    for (const s of specsOf(src)) assert.ok(ALLOWED.some((re) => re.test(s)), `${f}: 허용되지 않은 import '${s}'`)
    assert.doesNotMatch(src, /process\.env|style-?bert|sbv2|connectionKey|console\./i, `${f}: 서버 설정·엔진명·로그`)
  }
})

test('다시 내보내는 문장 분할기(../sentences)도 순수하다 — import 0', () => {
  const src = readFileSync(join(__dirname, '..', 'tts', 'sentences.ts'), 'utf8')
  assert.deepEqual(specsOf(src), [], 'sentences.ts 가 무언가를 import 하면 클라 번들에 서버 코드가 섞일 수 있다')
})
