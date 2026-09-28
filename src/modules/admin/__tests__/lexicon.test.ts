/**
 * task-003g 발음 사전 관리 — 권한(voices.read/manage)·PRODUCTION 보호(SUPER_ADMIN + 확인 문구)·쓰기 메타·목록 쿼리 검증.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { LEXICON_PRODUCTION_CONFIRM } from '@/types/lexicon'
import { can, capabilitiesOf } from '../permissions/can'
import type { AdminActor } from '../permissions/guard'
import { authorizeLexiconWrite, fieldErrors, lexiconAuditEntry, lexiconAuditTarget, parseLexiconListQuery, parsePreviewBody, readWriteMeta } from '../speech/lexicon'

function actor(role: AdminActor['role'], environment: AdminActor['environment'] = 'LOCAL'): AdminActor {
  return { id: `u_${role}`, email: `${role.toLowerCase()}@thekaiwa.test`, name: null, role, capabilities: capabilitiesOf(role), environment, ip: '127.0.0.1' }
}

function apiError(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('ApiError 가 나지 않았다')
}

test('권한 매트릭스: voices.read 는 모든 역할(USER 는 console.access 없음 → API 404), voices.manage 는 ADMIN 이상', () => {
  assert.equal(can('USER', 'voices.read').allowed, true)
  assert.equal(can('USER', 'console.access').allowed, false)
  assert.equal(can('USER', 'voices.manage').allowed, false)
  for (const r of ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'] as const) assert.equal(can(r, 'voices.manage').allowed, true, r)
})

test('PRODUCTION 보호: 비운영은 ADMIN 쓰기 가능, 운영은 SUPER_ADMIN + confirm "PRODUCTION" 만', () => {
  for (const r of ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'] as const) authorizeLexiconWrite(actor(r, 'LOCAL'), { confirm: null })
  for (const r of ['ADMIN', 'DEVELOPER'] as const) {
    const e = apiError(() => authorizeLexiconWrite(actor(r, 'PRODUCTION'), { confirm: LEXICON_PRODUCTION_CONFIRM }))
    assert.equal(e.code, 'FORBIDDEN')
    assert.deepEqual(e.details?.missing, ['config.apply.production'])
  }
  const noConfirm = apiError(() => authorizeLexiconWrite(actor('SUPER_ADMIN', 'PRODUCTION'), { confirm: null }))
  assert.deepEqual([noConfirm.code, noConfirm.details?.reason], ['FORBIDDEN', 'PRODUCTION_CONFIRMATION_REQUIRED'])
  assert.equal(apiError(() => authorizeLexiconWrite(actor('SUPER_ADMIN', 'PRODUCTION'), { confirm: 'production' })).code, 'FORBIDDEN')
  authorizeLexiconWrite(actor('SUPER_ADMIN', 'PRODUCTION'), { confirm: LEXICON_PRODUCTION_CONFIRM })
})

test('쓰기 메타: baseVersion 정수(없으면 400)·reason 칸 오류 E_REASON(1~200자, 제어문자 제거)', () => {
  assert.deepEqual(readWriteMeta({ baseVersion: 3, reason: '  오독 수정\u0007 ' }), { baseVersion: 3, reason: '오독 수정', confirm: null, reasonErrors: [] })
  assert.equal(readWriteMeta({ baseVersion: '4', reason: 'x' }).baseVersion, 4) // multipart 필드는 문자열
  assert.equal(apiError(() => readWriteMeta({ reason: 'x' })).details?.field, 'baseVersion')
  assert.equal(apiError(() => readWriteMeta({ baseVersion: 'x', reason: 'x' })).code, 'VALIDATION')
  assert.equal(readWriteMeta({ baseVersion: 0, reason: '   ' }).reasonErrors[0]?.code, 'E_REASON')
  assert.equal(readWriteMeta({ baseVersion: 0, reason: 'あ'.repeat(201) }).reasonErrors[0]?.code, 'E_REASON')
  const e = fieldErrors([{ field: 'reading', code: 'E_READING', message: 'x' }, { field: 'reason', code: 'E_REASON', message: 'y' }])
  assert.deepEqual([e.code, e.details?.reason, e.details?.fields], ['UNPROCESSABLE', 'E_LEXICON_ENTRY_INVALID', { reading: 'E_READING', reason: 'E_REASON' }])
})

test('목록 쿼리: 기본값·enabled 1/0/all·범위·page·limit 검증', () => {
  const q = parseLexiconListQuery(new URLSearchParams(''))
  assert.deepEqual(q, { q: null, scope: null, scopeRefId: null, enabled: null, sort: 'recent', page: 1, pageSize: 50 })
  assert.equal(parseLexiconListQuery(new URLSearchParams('scope=ALL&enabled=all')).scope, null)
  assert.deepEqual(parseLexiconListQuery(new URLSearchParams('q=にほん&scope=user&scopeRefId=u_1&enabled=1&sort=surface&page=2&pageSize=100')), {
    q: 'にほん',
    scope: 'USER',
    scopeRefId: 'u_1',
    enabled: true,
    sort: 'surface',
    page: 2,
    pageSize: 100,
  })
  assert.equal(parseLexiconListQuery(new URLSearchParams('enabled=0')).enabled, false)
  for (const bad of ['scope=TEAM', 'enabled=yes', 'page=0', 'pageSize=101', 'scopeRefId=../x', 'sort=old']) {
    assert.equal(apiError(() => parseLexiconListQuery(new URLSearchParams(bad))).code, 'VALIDATION', bad)
  }
})

test('미리듣기 본문: 예문 1~200자·초안 ≤20(칸 오류는 422 index)·compare/side', () => {
  const p = parsePreviewBody({ text: ' 日本橋へ ', draftEntries: [{ surface: '日本橋', reading: 'ニッポンバシ', reason: 'x' }], compare: true, side: 'after' })
  assert.deepEqual([p.text, p.drafts.length, p.drafts[0].reading, p.compare, p.side], ['日本橋へ', 1, 'ニッポンバシ', true, 'after'])
  assert.equal(apiError(() => parsePreviewBody({ text: '' })).details?.field, 'text')
  assert.equal(apiError(() => parsePreviewBody({ text: 'あ'.repeat(201) })).details?.field, 'text')
  assert.equal(apiError(() => parsePreviewBody({ text: 'あ', draftEntries: Array.from({ length: 21 }, () => ({})) })).details?.field, 'draftEntries')
  const bad = apiError(() => parsePreviewBody({ text: 'あ', draftEntries: [{ surface: '日本橋', reading: 'にっぽんばし' }] }))
  assert.deepEqual([bad.code, bad.details?.reason, bad.details?.index], ['UNPROCESSABLE', 'E_LEXICON_ENTRY_INVALID', 0])
  assert.equal(apiError(() => parsePreviewBody({ text: 'あ', side: 'both' })).details?.field, 'side')
})

test('감사 대상 id 는 버전과 1:1', () => {
  assert.equal(lexiconAuditTarget(7), 'lexicon:v7')
})

test('사전 감사 행: scope=LEXICON(task-018 ②)·targetId lexicon:v<새 버전>·작업자 스냅샷·이유·IP', () => {
  const e = lexiconAuditEntry(actor('ADMIN', 'PRODUCTION'), 9, { action: 'lexicon.rollback', before: { version: 8 }, after: { version: 9, restoredFrom: 7 } }, '오독 되돌림')
  assert.deepEqual(e, {
    environment: 'PRODUCTION',
    actor: { id: 'u_ADMIN', email: 'admin@thekaiwa.test', role: 'ADMIN' },
    action: 'lexicon.rollback',
    scope: 'LEXICON',
    targetId: 'lexicon:v9',
    before: { version: 8 },
    after: { version: 9, restoredFrom: 7 },
    reason: '오독 되돌림',
    ip: '127.0.0.1',
  })
})
