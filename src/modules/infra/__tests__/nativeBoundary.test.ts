import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * 웹 번들 경계(task-003f 완료 기준 2, module-dependency §6) — eslint 규칙과 이중 확인:
 *  ① src 어디에서도 `@capacitor/*`·`@thekaiwa/sherpa-stt` 를 import 하지 않는다(같은 번들이 PC 브라우저에도 나간다).
 *  ② `window.Capacitor` 를 읽는 코드는 `infra/native/bridge.ts` 하나뿐(주석 제외).
 *  ③ 플러그인을 꺼내는 `getOnDeviceStt()` 호출자는 모델 스토어 하나(Leader ⑥ — 온디바이스 클라이언트는 스토어가 넘긴 플러그인만 쓴다).
 */
const SRC = join(__dirname, '..', '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : walk(p)
    return /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const files = walk(SRC).filter((f) => !f.includes(`${sep}__tests__${sep}`))
const rel = (f: string) => relative(SRC, f).split(sep).join('/')

test('① 네이티브 패키지 import 0', () => {
  assert.ok(files.length > 100)
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g), ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g), ...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
    for (const s of specs) assert.doesNotMatch(s, /^(@capacitor\/|@capacitor-community\/|@thekaiwa\/sherpa-stt)/, `${rel(f)}: '${s}'`)
  }
})

test('② window.Capacitor 를 읽는 곳은 bridge 하나', () => {
  const readers = files.filter((f) => /\bCapacitor\s*\?*\.|\['Capacitor'\]|\{\s*Capacitor\??\s*:/.test(code(readFileSync(f, 'utf8')))).map(rel)
  assert.deepEqual(readers, ['modules/infra/native/bridge.ts'])
})

test('③ 플러그인 꺼내기(getOnDeviceStt) 호출자는 모델 스토어 하나', () => {
  const callers = files.filter((f) => /getOnDeviceStt\b/.test(code(readFileSync(f, 'utf8')))).map(rel).filter((f) => f !== 'modules/infra/native/bridge.ts')
  assert.deepEqual(callers, ['modules/speech/stt/client/onDeviceModel.ts'])
})
