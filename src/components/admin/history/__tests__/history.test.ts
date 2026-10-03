import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AuditItemDto, ConfigVersionItemDto } from '@/types/admin'
import { actionLabel } from '../../configEditor/configCopy'
import {
  actorOptions,
  actorText,
  auditLines,
  auditPath,
  auditVersion,
  dayLabel,
  historyHref,
  isOldLexicon,
  isReadAudit,
  parseEditScope,
  parseHistoryTab,
  periodFrom,
  versionTargetOptions,
} from '../historyQuery'

// 2026-10-01 14:30 KST = 05:30Z
const NOW = Date.parse('2026-10-01T05:30:00.000Z')

test('감사 경로: 분류 → scope(발음 사전 = LEXICON) · 작업 · 사람 · 환경 · 기간 시작(한국 시각 오늘 0시) · 커서', () => {
  const p = auditPath({ category: 'lex', period: '1d', action: 'lexicon.', actorUserId: 'u1', environment: 'PRODUCTION' }, NOW, 'cur', 30)
  const q = new URL(p, 'http://x').searchParams
  assert.equal(q.get('scope'), 'LEXICON')
  assert.equal(q.get('action'), 'lexicon.')
  assert.equal(q.get('actorUserId'), 'u1')
  assert.equal(q.get('environment'), 'PRODUCTION')
  assert.equal(q.get('from'), '2026-09-30T15:00:00.000Z')
  assert.equal(q.get('cursor'), 'cur')
  const all = new URL(auditPath({ category: 'all', period: 'all', action: '', actorUserId: '', environment: null }, NOW), 'http://x').searchParams
  assert.equal(all.get('scope'), null)
  assert.equal(all.get('from'), null)
  assert.equal(periodFrom('7d', NOW), new Date(NOW - 7 * 86_400_000).toISOString())
  assert.equal(periodFrom('7d', 0), null)
})

const audit = (p: Partial<AuditItemDto>): AuditItemDto => ({
  id: 'a1',
  environment: 'LOCAL',
  actor: { id: 'u1', email: 'qa-admin@thekaiwa.test', roleSnap: 'ADMIN' },
  action: 'config.apply',
  scope: 'ENGINE_CONNECTION',
  targetId: 'c1',
  before: { version: 1, values: { 'connection.timeoutMs': 20000 } },
  after: { versionId: 'v2', version: 2, values: { 'connection.timeoutMs': 45000 } },
  reason: '응답이 느려서',
  ip: '10.0.0.0/24',
  traceId: null,
  createdAt: '2026-10-01T05:00:00.000Z',
  summary: 'v2 · connection.timeoutMs',
  versionId: 'v2',
  ...p,
})

test('감사 행 펼침(d3 = A): values 키마다 전 → 후 · 값 없는 조회 감사 · 옛 발음 사전 기록', () => {
  assert.deepEqual(auditLines(audit({})), [{ key: 'connection.timeoutMs', before: 20000, after: 45000, hasBefore: true }])
  assert.deepEqual(auditLines(audit({ before: null, after: { version: 1 } })), [])
  const cred = auditLines(audit({ action: 'credentials.set', before: { version: 2, values: { 'connection.credentialRef': null } }, after: { version: 3, values: { 'connection.credentialRef': 'env:HOME_M4_API_KEY' } } }))
  assert.deepEqual(cred[0].after, 'env:HOME_M4_API_KEY')
  assert.equal(auditVersion(audit({})), 2)
  assert.equal(isReadAudit('secrets.read_ref'), true)
  assert.equal(isReadAudit('config.apply'), false)
  assert.equal(isOldLexicon({ scope: null, action: 'lexicon.update' }), true)
  assert.equal(isOldLexicon({ scope: 'LEXICON', action: 'lexicon.update' }), false)
  assert.equal(actionLabel('config.raw_apply'), '설정 적용(Raw JSON)')
  assert.equal(actionLabel('unknown.action'), 'unknown.action')
})

test('날짜 머리·작업자·사람 필터 선택지', () => {
  assert.equal(dayLabel('2026-10-01T00:10:00.000Z', NOW), '오늘')
  assert.equal(dayLabel('2026-09-30T14:59:00.000Z', NOW), '어제')
  assert.equal(dayLabel('2026-09-27T03:00:00.000Z', NOW), '9월 27일')
  assert.equal(actorText(null), '시스템')
  assert.equal(actorText({ email: 'a@x', roleSnap: 'ADMIN' }), 'a@x(ADMIN)')
  assert.deepEqual(actorOptions([audit({}), audit({ id: 'a2' }), audit({ id: 'a3', actor: { id: 'u2', email: 'b@x', roleSnap: null } }), audit({ id: 'a4', actor: { id: null, email: null, roleSnap: null } })]), [
    { value: 'u1', label: 'qa-admin@thekaiwa.test' },
    { value: 'u2', label: 'b@x' },
  ])
})

test('설정 버전 대상 칩 · 주소', () => {
  const v = (p: Partial<ConfigVersionItemDto>): ConfigVersionItemDto => ({
    id: 'v1',
    scope: 'ENGINE_CONNECTION',
    targetId: 'c1',
    targetKey: 'llm-main',
    targetName: 'LLM 주 연결',
    environment: 'LOCAL',
    version: 1,
    status: 'ACTIVE',
    origin: 'APPLY',
    actor: null,
    reason: null,
    diffSummary: null,
    restoredFromVersion: null,
    testResult: null,
    integrity: 'OK',
    createdAt: '',
    supersededAt: null,
    ...p,
  })
  const opts = versionTargetOptions([v({}), v({ id: 'v2', version: 2 }), v({ id: 'v3', scope: 'APP_SETTING', targetId: 'voice.preview.defaultText', targetKey: 'voice.preview.defaultText', targetName: null })], { value: 'FALLBACK_POLICY:fp1', label: 'fp1', scope: 'FALLBACK_POLICY', targetId: 'fp1' })
  assert.deepEqual(
    opts.map((o) => [o.value, o.label]),
    [
      ['FALLBACK_POLICY:fp1', 'fp1'],
      ['ENGINE_CONNECTION:c1', 'LLM 주 연결'],
      ['APP_SETTING:voice.preview.defaultText', 'voice.preview.defaultText'],
    ],
  )
  assert.equal(historyHref({ tab: 'versions', scope: 'APP_SETTING', target: 'voice.preview.defaultText' }), '/admin/history?scope=APP_SETTING&target=voice.preview.defaultText')
  assert.equal(historyHref({ tab: 'audit' }), '/admin/history?tab=audit')
  assert.equal(parseHistoryTab('audit'), 'audit')
  assert.equal(parseHistoryTab('x'), 'versions')
  assert.equal(parseEditScope('fallback_policy'), 'FALLBACK_POLICY')
  assert.equal(parseEditScope('VOICE_PROFILE'), null)
})
