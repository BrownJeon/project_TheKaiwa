/**
 * role-permission.md §3 매트릭스 ↔ `permissions/matrix.ts` 전수 대조(문서가 정본).
 * 표는 아래 `CANONICAL_TABLE` 에 그대로 복사해 두고, 정본 문서에 닿을 수 있으면(NFS 원본 또는 KAIWA_REPO_ROOT) 복사본과 문서가 같은지도 본다
 * — 미러(~/.node-local)에는 docs/ 가 동기화되지 않기 때문이다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CAPABILITIES, ROLE_CAPABILITIES, ROLES } from '../permissions/matrix'
import { can, capabilitiesOf, derivesConsoleAccess } from '../permissions/can'
import { ADMIN_MENU, menuFor } from '../console/menu'
import type { AdminRole, Capability } from '@/types/admin'

const CANONICAL_TABLE = `
| \`settings.read\` | O | O | O | O |
| \`settings.write\` | O | O | O | O |
| \`voices.read\` | O | O | O | O |
| \`voices.manage\` | - | O (disable/delete P) | O (P) | O |
| \`engine.read\` | - | O | O | O |
| \`engine.connections.manage\` | - | O (P) | O (P) | O |
| \`config.effective.read\` | - | O (요약: 값+Source 이름) | O (전체: sourceRef·env 이름) | O |
| \`config.raw.read\` | - | - | O | O |
| \`config.edit\` | - | O (Form, P) | O (Form+JSON, P) | O |
| \`config.apply.production\` | - | - | - | O |
| \`config.rollback\` | - | O (P) | O (P) | O |
| \`credentials.manage\` | - | - | - | O |
| \`secrets.read_ref\` | - | O | O | O |
| \`plugins.read\` | - | - | O | O |
| \`health.run\` | - | O | O | O |
| \`functional_test.run\` | - | O | O | O |
| \`playground.use\` | - | - | O | O |
| \`e2e.run\` | - | - | O | O |
| \`trace.read\` | - | - | O | O |
| \`debug_session.create\` | - | - | O (PRODUCTION 은 - ) | O |
| \`override.create\` | - | - | O (PRODUCTION 은 - ) | O |
| \`override.production\` | - | - | - | O (게이트 켜진 때만) |
| \`prompts.read\` | - | - | O | O |
| \`prompts.edit\` | - | - | O | O |
| \`prompts.activate\` | - | - | O (P) | O |
| \`presets.manage\` | - | - | O | O |
| \`config.export\` | - | - | O | O |
| \`config.import\` | - | - | O (비Production) | O |
| \`config.import.production\` | - | - | - | O |
| \`audit.read\` | - | O | O | O |
| \`environment.policy\` | - | - | - | O |
| \`users.role.manage\` | - | - | - | O |
| \`console.access\` (파생) | - | O | O | O |
`

type Row = { cap: string; cells: boolean[] }

function parseTable(text: string): Row[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\| `[a-z0-9_.]+`/.test(l))
    .map((l) => {
      const parts = l.split('|').slice(1, -1).map((c) => c.trim())
      const cap = /`([a-z0-9_.]+)`/.exec(parts[0])![1]
      return { cap, cells: parts.slice(1, 5).map((c) => c.startsWith('O')) }
    })
}

function canonicalDoc(): string | null {
  const roots = [process.env.KAIWA_REPO_ROOT, join(homedir(), 'NFS/homes/brownjeon/project/TheKaiwa'), process.cwd()].filter(Boolean) as string[]
  for (const r of roots) {
    const p = join(r, 'docs/design/role-permission.md')
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  return null
}

const rows = parseTable(CANONICAL_TABLE)

test('복사본 표가 정본 문서 §3 과 같다(문서에 닿을 수 있을 때)', (t) => {
  const doc = canonicalDoc()
  if (!doc) return t.skip('정본 문서 경로 없음(미러 단독 실행)')
  const section = doc.slice(doc.indexOf('## 3. Role × Capability 매트릭스'), doc.indexOf('## 4.'))
  assert.deepEqual(parseTable(section), rows)
})

test('매트릭스 행 수·순서가 정본과 같다(33행)', () => {
  assert.equal(rows.length, 33)
  assert.deepEqual(rows.map((r) => r.cap), [...CAPABILITIES])
})

test('역할 × capability 전 칸이 정본과 같다(누적 전개)', () => {
  for (const r of rows) {
    ROLES.forEach((role, i) => {
      assert.equal(ROLE_CAPABILITIES[role].has(r.cap as Capability), r.cells[i], `${role} × ${r.cap}`)
      assert.equal(can(role, r.cap as Capability).allowed, r.cells[i], `can(${role}, ${r.cap})`)
    })
  }
})

test('누적 구조: USER ⊆ ADMIN ⊆ DEVELOPER ⊆ SUPER_ADMIN, SUPER_ADMIN 은 전부', () => {
  for (let i = 1; i < ROLES.length; i++) for (const c of ROLE_CAPABILITIES[ROLES[i - 1]]) assert.ok(ROLE_CAPABILITIES[ROLES[i]].has(c), `${ROLES[i]} ⊇ ${c}`)
  assert.equal(ROLE_CAPABILITIES.SUPER_ADMIN.size, CAPABILITIES.length)
})

test('console.access 는 파생 규칙(settings.*·voices.read 외 하나라도)과 상수가 일치', () => {
  for (const role of ROLES) {
    const others = [...ROLE_CAPABILITIES[role]].filter((c) => c !== 'console.access')
    assert.equal(derivesConsoleAccess(others), ROLE_CAPABILITIES[role].has('console.access'), role)
  }
})

test('모르는 역할·null 은 아무것도 못 한다(JWT 위조 역할 문자열 포함)', () => {
  for (const r of [null, undefined, 'OWNER', 'admin', 'SUPER_ADMIN ', { role: 'ROOT' }] as const) {
    assert.equal(can(r as never, 'settings.read').allowed, false)
    assert.deepEqual(capabilitiesOf(r as never), [])
  }
})

test('PRODUCTION 대상 변경은 P 칸 capability 에 SUPER_ADMIN 확인을 더 요구한다', () => {
  const P = { targetEnvironment: 'PRODUCTION' as const }
  assert.deepEqual(can('ADMIN', 'config.edit', P), { allowed: false, missing: ['config.apply.production'] })
  assert.deepEqual(can('DEVELOPER', 'engine.connections.manage', P).missing, ['config.apply.production'])
  assert.deepEqual(can('DEVELOPER', 'override.create', P).missing, ['override.production'])
  assert.deepEqual(can('DEVELOPER', 'config.import', P).missing, ['config.import.production'])
  assert.deepEqual(can('DEVELOPER', 'debug_session.create', P).missing, ['config.apply.production'])
  assert.equal(can('SUPER_ADMIN', 'config.edit', P).allowed, true)
  // voices.manage 는 disable/delete(productionSensitive)만 P
  assert.equal(can('ADMIN', 'voices.manage', P).allowed, true)
  assert.deepEqual(can('ADMIN', 'voices.manage', { ...P, productionSensitive: true }).missing, ['config.apply.production'])
  // 읽기·실행 capability 는 PRODUCTION 이어도 그대로
  for (const c of ['engine.read', 'health.run', 'functional_test.run', 'config.effective.read', 'secrets.read_ref'] as const) assert.equal(can('ADMIN', c, P).allowed, true, c)
  // LOCAL 대상은 추가 요구 없음
  assert.equal(can('ADMIN', 'config.edit', { targetEnvironment: 'LOCAL' }).allowed, true)
  // 기본 capability 자체가 없으면 그것만 missing 의 첫 항목
  assert.deepEqual(can('USER', 'config.edit', P).missing, ['config.edit', 'config.apply.production'])
})

test('메뉴: USER 는 비어 있고, ADMIN 은 Plugins·Trace 탭이 없고, DEVELOPER 는 있다. Phase 1 만', () => {
  const ids = (role: AdminRole) => menuFor({ role }).map((m) => m.id)
  assert.deepEqual(ids('USER'), [])
  assert.ok(!ids('ADMIN').includes('plugins'))
  assert.ok(ids('DEVELOPER').includes('plugins'))
  const diag = (role: AdminRole) => menuFor({ role }).find((m) => m.id === 'diagnostics')!.tabs!.map((t) => t.id)
  assert.deepEqual(diag('ADMIN'), ['health'])
  assert.deepEqual(diag('DEVELOPER'), ['health', 'traces'])
  assert.ok(menuFor({ role: 'SUPER_ADMIN' }).every((m) => m.phase === 1))
  assert.ok(!ids('SUPER_ADMIN').includes('prompts'))
  assert.ok(menuFor({ role: 'SUPER_ADMIN' }, { maxPhase: 2 }).some((m) => m.id === 'prompts'))
  // 메뉴 capability 는 모두 매트릭스에 있는 이름
  for (const m of ADMIN_MENU) assert.ok((CAPABILITIES as readonly string[]).includes(m.capability), m.id)
})
