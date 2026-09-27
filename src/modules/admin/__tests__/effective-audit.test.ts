/**
 * REV-009 Medium·Codex C2: PRODUCTION 대상 Effective 를 FULL(config.raw.read)로 볼 때만 AuditLog(config.raw.read) 1행 — 값 없이 메타만.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AuditEntry } from '@/modules/infra'
import type { EffectiveConfiguration } from '@/modules/engine'
import { getEffectiveConfig, type EffectiveDeps } from '../configuration/effective'
import type { AdminActor } from '../permissions/guard'
import { capabilitiesOf } from '../permissions/can'

function actor(role: AdminActor['role'], environment: AdminActor['environment'] = 'LOCAL'): AdminActor {
  return { id: `u_${role}`, email: `${role.toLowerCase()}@thekaiwa.test`, name: null, role, capabilities: capabilitiesOf(role), environment, ip: '127.0.0.1' }
}

function fakeDeps(): EffectiveDeps & { calls: AuditEntry[] } {
  const calls: AuditEntry[] = []
  return {
    calls,
    audit: async (e) => {
      calls.push(e)
    },
    resolve: async ({ environment, scope, targetId }) =>
      ({
        environment,
        scope,
        targetId: 'ec_1',
        targetKey: targetId,
        engineId: 'x',
        schemaVersion: 1,
        resolvedAt: new Date().toISOString(),
        cacheHit: false,
        emptyLayers: [],
        warnings: [],
        keys: [{ key: 'connection.credentialRef', type: 'SECRET_REF', value: 'env:SOME_KEY', source: 'CONNECTION_PROFILE', sourceRef: 'db:x', editability: 'SECRET', restartRequired: false, secret: true, shadowed: false, layers: [], warnings: [] }],
      }) as EffectiveConfiguration,
  }
}

const Q = { scope: 'ENGINE_CONNECTION', targetId: 'whisper-voicevault', context: null }

test('PRODUCTION + config.raw.read(FULL) → AuditLog 1행(action·scope·targetId·actor 스냅샷, 값 없음)', async () => {
  for (const role of ['DEVELOPER', 'SUPER_ADMIN'] as const) {
    const deps = fakeDeps()
    const dto = await getEffectiveConfig(actor(role, role === 'SUPER_ADMIN' ? 'LOCAL' : 'PRODUCTION'), 'PRODUCTION', Q, deps)
    assert.equal(dto.detail, 'FULL')
    assert.equal(deps.calls.length, 1, role)
    const e = deps.calls[0]
    assert.equal(e.action, 'config.raw.read')
    assert.equal(e.environment, 'PRODUCTION')
    assert.equal(e.scope, 'ENGINE_CONNECTION')
    assert.equal(e.targetId, 'ec_1')
    assert.deepEqual(e.actor, { id: `u_${role}`, email: `${role.toLowerCase()}@thekaiwa.test`, role })
    assert.equal(e.ip, '127.0.0.1')
    assert.deepEqual(e.after, role === 'SUPER_ADMIN' ? { detail: 'FULL', crossEnvironment: true } : { detail: 'FULL' })
    assert.ok(!JSON.stringify(e).includes('env:SOME_KEY'))
  }
})

test('LOCAL 이거나 config.raw.read 가 없으면(ADMIN 요약) 감사 0행', async () => {
  const local = fakeDeps()
  assert.equal((await getEffectiveConfig(actor('DEVELOPER'), 'LOCAL', Q, local)).detail, 'FULL')
  assert.equal(local.calls.length, 0)
  const summary = fakeDeps()
  assert.equal((await getEffectiveConfig(actor('ADMIN', 'PRODUCTION'), 'PRODUCTION', Q, summary)).detail, 'SUMMARY')
  assert.equal(summary.calls.length, 0)
})

test('검증 실패(400)는 해석·감사 전에 끝난다', async () => {
  const deps = fakeDeps()
  await assert.rejects(getEffectiveConfig(actor('SUPER_ADMIN', 'PRODUCTION'), 'PRODUCTION', { ...Q, scope: 'NOPE' }, deps))
  assert.equal(deps.calls.length, 0)
})
