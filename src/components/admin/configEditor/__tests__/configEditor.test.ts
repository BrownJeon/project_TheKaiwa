import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEnvironment, AppSettingDto, Capability, ConfigKeyPolicyDto, EffectiveConfigDto } from '@/types/admin'
import { configAccess, configTabs, pickTab } from '../configAccess'
import { fieldLabel } from '../configCopy'
import {
  coerceInput,
  connectionFormBody,
  docText,
  docWithDraft,
  draftCount,
  EMPTY_DRAFT,
  fieldFromAppSetting,
  fieldLock,
  fieldsFromEffective,
  flatFromDoc,
  hasMaskedValue,
  isLockedRow,
  parseRawText,
  rawLineOf,
  renameRawKey,
  requestPatch,
  resetDraftKey,
  setDraftValue,
  syntaxPosition,
} from '../draft'
import { liveDraft } from '../useConfigEditor'
import FieldList, { lockCounts } from '../FieldList'
import { addItem, moveItem, removeItem } from '../FallbackEditor'
import { credentialChoices } from '../ConnectionSheets'

// role-permission §3 에서 이 화면들이 쓰는 줄만(서버 매트릭스는 modules/admin 단위 테스트가 전수 확인한다 — 컴포넌트는 modules/admin 을 import 하지 않는다).
const ADMIN: Capability[] = ['console.access', 'engine.read', 'engine.connections.manage', 'config.effective.read', 'config.edit', 'config.rollback', 'secrets.read_ref', 'health.run', 'functional_test.run', 'audit.read', 'voices.read', 'voices.manage']
const DEVELOPER: Capability[] = [...ADMIN, 'config.raw.read', 'plugins.read', 'trace.read', 'playground.use', 'prompts.read']
const SUPER: Capability[] = [...DEVELOPER, 'config.apply.production', 'credentials.manage', 'environment.policy', 'users.role.manage']
const READ_ONLY: Capability[] = ['console.access', 'engine.read', 'config.effective.read']
const can = (list: Capability[]) => (c: Capability) => list.includes(c)

test('권한 갈래: 읽기 전용 · ADMIN Form · DEVELOPER + Raw JSON · 운영 비 SUPER 는 초안·요약까지 · SUPER 운영 = 확인 창', () => {
  const cases: [string, Capability[], AdminEnvironment, Partial<ReturnType<typeof configAccess>>][] = [
    ['읽기 전용', READ_ONLY, 'LOCAL', { canEdit: false, canRaw: false, canApply: false, canTest: false, canCredential: false, canRollback: false, note: 'READ_ONLY' }],
    ['ADMIN · LOCAL', ADMIN, 'LOCAL', { canEdit: true, canRaw: false, canRawEdit: false, canApply: true, needsConfirm: false, canCredential: false, canManageConn: true, canApplyConn: true, canRollback: true, canTrace: false, note: null }],
    ['ADMIN · PRODUCTION', ADMIN, 'PRODUCTION', { canEdit: true, canApply: false, needsConfirm: false, canApplyConn: false, canRollback: false, rollbackProdOnly: true, note: 'PROD_SUPER_ONLY' }],
    ['DEVELOPER · LOCAL', DEVELOPER, 'LOCAL', { canRaw: true, canRawEdit: true, canApply: true, canCredential: false, canTrace: true }],
    ['DEVELOPER · PRODUCTION', DEVELOPER, 'PRODUCTION', { canRaw: true, canApply: false, canCredential: false, note: 'PROD_SUPER_ONLY' }],
    ['SUPER · PRODUCTION', SUPER, 'PRODUCTION', { canApply: true, needsConfirm: true, canApplyConn: true, canCredential: true, canRollback: true, rollbackProdOnly: false, canOtherEnv: true, note: 'PROD_WARN' }],
    ['SUPER · LOCAL', SUPER, 'LOCAL', { canApply: true, needsConfirm: false, note: null }],
  ]
  for (const [name, caps, env, want] of cases) {
    const got = configAccess(can(caps), env)
    for (const [k, v] of Object.entries(want)) assert.equal(got[k as keyof typeof got], v, `${name}: ${k}`)
  }
})

test('탭: ADMIN 에게 Raw JSON 탭은 없다 · 읽기 전용은 Effective 만 · 요청 탭이 없으면 Form(없으면 Effective)', () => {
  assert.deepEqual(configTabs(configAccess(can(ADMIN), 'LOCAL')), ['effective', 'form', 'diff'])
  assert.deepEqual(configTabs(configAccess(can(DEVELOPER), 'LOCAL')), ['effective', 'form', 'raw', 'diff'])
  assert.deepEqual(configTabs(configAccess(can(READ_ONLY), 'LOCAL')), ['effective'])
  assert.equal(pickTab('raw', ['effective', 'form', 'diff']), 'form')
  assert.equal(pickTab(null, ['effective']), 'effective')
  assert.equal(pickTab('effective', ['effective', 'form', 'diff']), 'effective')
})

const policy = (p: Partial<ConfigKeyPolicyDto> & { key: string }): ConfigKeyPolicyDto => ({
  type: 'INTEGER',
  description: '요청 상한(문장 1건은 8s fail-fast)',
  editability: 'RUNTIME_EDITABLE',
  strict: false,
  editable: true,
  lock: null,
  lockMessage: null,
  verifiable: 'YES',
  consumer: 'APP',
  restartTarget: null,
  stored: undefined,
  shadowedByEnv: false,
  ...p,
})

function eff(keys: ConfigKeyPolicyDto[], values: Record<string, unknown> = {}): EffectiveConfigDto {
  return {
    environment: 'LOCAL',
    scope: 'ENGINE_CONNECTION',
    targetId: 'c1',
    targetKey: 'k1',
    engineId: 'e',
    schemaVersion: 2,
    resolvedAt: '',
    cacheHit: false,
    detail: 'SUMMARY',
    keys: Object.entries(values).map(([key, value]) => ({ key, value, source: 'DEFAULT' as const, editability: 'RUNTIME_EDITABLE' as const, restartRequired: false, secret: false, shadowed: false })),
    emptyLayers: [],
    warnings: [],
    edit: { version: 3, keys },
  }
}

test('칸 잠금 순서: 서버 잠금 → env 가 덮음 → 운영에서 실행 검증 없음 · 비밀 참조 CREDENTIAL_ONLY 는 입력 쪽 전용 행', () => {
  assert.equal(fieldLock({ lock: 'SERVICE_MANAGED', shadowedByEnv: true, verifiable: 'NO' }, true), 'SERVICE_MANAGED')
  assert.equal(fieldLock({ lock: null, shadowedByEnv: true, verifiable: 'NO' }, true), 'SHADOW')
  assert.equal(fieldLock({ lock: null, shadowedByEnv: false, verifiable: 'NO' }, true), 'NOVERIFY')
  assert.equal(fieldLock({ lock: null, shadowedByEnv: false, verifiable: 'NO' }, false), null)
  const fs = fieldsFromEffective(
    eff(
      [
        policy({ key: 'connection.timeoutMs', stored: 20000, min: 5000, max: 60000 }),
        policy({ key: 'runtime.prewarm', type: 'BOOLEAN', verifiable: 'NO' }),
        policy({ key: 'connection.credentialRef', type: 'SECRET_REF', lock: 'CREDENTIAL_ONLY', lockMessage: '비밀 참조는 전용 경로', stored: 'env:X' }),
        policy({ key: 'runtime.device', lock: 'RESTART_REQUIRED', lockMessage: '재시작 필요' }),
      ],
      { 'runtime.prewarm': true },
    ),
    true,
  )
  const by = Object.fromEntries(fs.map((f) => [f.key, f]))
  assert.equal(by['connection.timeoutMs'].lock, null)
  assert.equal(by['connection.timeoutMs'].hasStored, true)
  assert.equal(by['runtime.prewarm'].lock, 'NOVERIFY')
  assert.equal(by['runtime.prewarm'].hasStored, false)
  assert.equal(by['runtime.prewarm'].effective, true)
  assert.equal(isLockedRow(by['connection.credentialRef']), false)
  assert.equal(isLockedRow(by['runtime.device']), true)
  assert.equal(by['runtime.device'].lockWhy, '재시작 필요')
  assert.equal(lockCounts(fs), '운영 잠금 1 · 재시작 필요 1')
})

test('초안: 기준값과 같아지면 뺀다(저장값 없는 키는 Effective 기준) · 되돌리기 · 다시 불러온 저장값과 같아진 키만 화면에서 뺀다', () => {
  const stored = { key: 'connection.timeoutMs', hasStored: true, stored: 20000, effective: 20000 }
  const noStore = { key: 'runtime.prewarm', hasStored: false, stored: undefined, effective: true }
  let d = setDraftValue(EMPTY_DRAFT, stored, 45000)
  assert.deepEqual(d.patch, { 'connection.timeoutMs': 45000 })
  d = setDraftValue(d, stored, 20000)
  assert.equal(draftCount(d), 0)
  d = setDraftValue(d, noStore, true)
  assert.equal(draftCount(d), 0, 'Effective 와 같으면 새로 쓰지 않는다')
  d = setDraftValue(d, noStore, false)
  assert.deepEqual(d.patch, { 'runtime.prewarm': false })
  d = { ...d, unknown: { 'runtime.modle': 'x' } }
  assert.deepEqual(requestPatch(d), { 'runtime.prewarm': false, 'runtime.modle': 'x' })
  assert.equal(draftCount(resetDraftKey(d, 'runtime.modle')), 1)
  const fields = fieldsFromEffective(eff([policy({ key: 'connection.timeoutMs', stored: 45000 }), policy({ key: 'runtime.prewarm', type: 'BOOLEAN' })]), false)
  const live = liveDraft({ patch: { 'connection.timeoutMs': 45000, 'runtime.prewarm': false }, unknown: {} }, fields)
  assert.deepEqual(live.patch, { 'runtime.prewarm': false }, '409 뒤 새 저장값과 같아진 키는 빠지고, 저장값이 없던 키는 남는다')
})

test('입력 글자 → 값: 숫자 칸은 숫자·비우면 null·이상하면 글자 그대로(서버가 type 오류) · JSON 칸', () => {
  assert.equal(coerceInput('INTEGER', '45000'), 45000)
  assert.equal(coerceInput('NUMBER', '0.5'), 0.5)
  assert.equal(coerceInput('NUMBER', ''), null)
  assert.equal(coerceInput('NUMBER', '0.'), '0.')
  assert.equal(coerceInput('INTEGER', '12a'), '12a')
  assert.deepEqual(coerceInput('JSON', '["a"]'), ['a'])
  assert.equal(coerceInput('JSON', '[a'), '[a')
  assert.equal(coerceInput('STRING', ' x '), ' x ')
})

const CONN_DOC = { connection: { baseUrl: 'http://127.0.0.1:9000', timeoutMs: 20000 }, runtime: { model: 'm', modelByTier: { fast: 'a' } }, credentialRef: 'env:K', logLevel: 'INFO', enabled: true, 'x-note': '메모' }

test('Raw 문서 ↔ 평면 키: 서버 #111 과 같은 대응(credentialRef·logLevel·enabled, 중첩 키) · x- 마디는 초안 밖', () => {
  const flat = flatFromDoc('ENGINE_CONNECTION', CONN_DOC)
  assert.deepEqual(flat, {
    'connection.baseUrl': 'http://127.0.0.1:9000',
    'connection.timeoutMs': 20000,
    'runtime.model': 'm',
    'runtime.modelByTier.fast': 'a',
    'connection.credentialRef': 'env:K',
    'logging.level': 'INFO',
    enabled: true,
  })
  const doc = docWithDraft('ENGINE_CONNECTION', CONN_DOC, { patch: { 'connection.timeoutMs': 45000, 'runtime.modelByTier.deep': 'c', enabled: false }, unknown: { 'runtime.modle': 'x' } })
  assert.equal((doc.connection as Record<string, unknown>).timeoutMs, 45000)
  assert.deepEqual((doc.runtime as Record<string, unknown>).modelByTier, { fast: 'a', deep: 'c' })
  assert.equal((doc.runtime as Record<string, unknown>).modle, 'x')
  assert.equal(doc.enabled, false)
  assert.equal(doc['x-note'], '메모', 'x- 키 보존')
  assert.equal((CONN_DOC.connection as Record<string, unknown>).timeoutMs, 20000, '원본 불변')
  assert.deepEqual(flatFromDoc('FALLBACK_POLICY', { primaryConnectionId: 'a', fallbackConnectionIds: ['b'], 'x-y': 1 }), { primaryConnectionId: 'a', fallbackConnectionIds: ['b'] })
  assert.deepEqual(flatFromDoc('APP_SETTING', { value: 'こんにちは' }), { value: 'こんにちは' })
})

test('Raw 글 → 초안: 저장값 기준 · 스키마 밖 키 · 지운 저장 키 · 문법 오류 줄·칸', () => {
  const stored = flatFromDoc('ENGINE_CONNECTION', CONN_DOC)
  const known = [...Object.keys(stored), 'runtime.prewarm']
  const text = docText(docWithDraft('ENGINE_CONNECTION', CONN_DOC, { patch: { 'connection.timeoutMs': 45000 }, unknown: {} }))
  const ok = parseRawText(text, 'ENGINE_CONNECTION', stored, known)
  assert.ok(ok.ok)
  if (ok.ok) {
    assert.deepEqual(ok.draft.patch, { 'connection.timeoutMs': 45000 })
    assert.deepEqual(ok.missing, [])
  }
  const edited = text.replace('"model": "m"', '"modle": "m"')
  const r = parseRawText(edited, 'ENGINE_CONNECTION', stored, known)
  assert.ok(r.ok)
  if (r.ok) {
    assert.deepEqual(r.draft.unknown, { 'runtime.modle': 'm' })
    assert.deepEqual(r.missing, ['runtime.model'])
  }
  const bad = text.replace('"timeoutMs": 45000', '"timeoutMs": 45000 "x": 1')
  const s = parseRawText(bad, 'ENGINE_CONNECTION', stored, known)
  assert.equal(s.ok, false)
  if (!s.ok) assert.ok(s.line >= 3 && s.line <= 5, `줄 ${s.line}`)
  assert.equal(parseRawText('[1]', 'ENGINE_CONNECTION', stored, known).ok, false)
  // 스키마 밖이지만 저장 문서에 늘 있는 칸(예: ONDEVICE 연결의 credentialRef: null)은 그대로면 초안이 아니다.
  const noCred = parseRawText(text, 'ENGINE_CONNECTION', stored, known.filter((k) => k !== 'connection.credentialRef'))
  assert.ok(noCred.ok && Object.keys(noCred.draft.unknown).length === 0)
  assert.deepEqual(syntaxPosition('{\n  "a": 1\n  "b": 2\n}', 'Expected , at position 15'), { line: 3, column: 5 })
  assert.deepEqual(syntaxPosition('', "Expected ',' or '}' after property value in JSON at position 15 (line 3 column 3)"), { line: 3, column: 3 })
})

test('Raw 오류 줄 찾기·제안 키로 바꾸기 · 가림 값 문서는 편집 금지 · #93 본문', () => {
  const text = docText(CONN_DOC)
  assert.equal(rawLineOf(text, 'ENGINE_CONNECTION', 'connection.timeoutMs'), 4)
  assert.equal(rawLineOf(text, 'ENGINE_CONNECTION', 'connection.credentialRef'), 12)
  assert.equal(rawLineOf(text, 'ENGINE_CONNECTION', 'runtime.nope'), 0)
  const typo = text.replace('"model"', '"modle"')
  assert.match(renameRawKey(typo, 'ENGINE_CONNECTION', 'runtime.modle', 'runtime.model'), /"model": "m"/)
  assert.equal(hasMaskedValue({ connection: { token: '***' } }), true)
  assert.equal(hasMaskedValue(CONN_DOC), false)
  assert.deepEqual(connectionFormBody({ 'connection.timeoutMs': 1, 'runtime.modelByTier.fast': 'a', enabled: true }), { connection: { timeoutMs: 1 }, runtime: { modelByTier: { fast: 'a' } }, enabled: true })
  assert.equal(connectionFormBody({ 'logging.level': 'DEBUG' }), null)
  assert.equal(connectionFormBody({ 'connection.credentialRef': 'env:K' }), null)
})

test('운영 설정 한 키 → 칸: 행이 없으면 출처 DEFAULT · 운영에서 검증 없는 키는 운영 잠금 · 정책 키는 POLICY', () => {
  const dto = (p: Partial<AppSettingDto>): AppSettingDto => ({
    key: 'speech.review.threshold',
    environment: 'LOCAL',
    value: null,
    exists: false,
    description: '발화 재확인 임계',
    type: 'NUMBER',
    editability: 'RUNTIME_EDITABLE',
    policy: false,
    lock: null,
    lockMessage: null,
    verifiable: 'NO',
    version: 0,
    ...p,
  })
  const local = fieldFromAppSetting(dto({}), { key: 'speech.review.threshold', label: '재확인 신뢰도' }, false)
  assert.equal(local.lock, null)
  assert.equal(local.source, 'DEFAULT')
  assert.equal(local.key, 'value')
  assert.equal(fieldFromAppSetting(dto({}), null, true).lock, 'NOVERIFY')
  const pol = fieldFromAppSetting(dto({ key: 'trace.retentionDays', lock: 'POLICY', lockMessage: '환경 정책 키', policy: true, verifiable: 'NONE' as never }), null, false)
  assert.equal(pol.lock, 'POLICY')
  assert.equal(pol.lockWhy, '환경 정책 키')
})

test('칸 이름: 설명 첫 마디(— . → 앞) · 길면 40자 · 설명이 없으면 키 끝 두 마디', () => {
  assert.deepEqual(fieldLabel('tier fast(회화·채팅·단어 보강) → --model 값', 'runtime.modelByTier.fast'), { label: 'tier fast(회화·채팅·단어 보강)', rest: 'tier fast(회화·채팅·단어 보강) → --model 값' })
  assert.deepEqual(fieldLabel('요청 상한(문장 1건은 8s fail-fast)', 'connection.timeoutMs'), { label: '요청 상한(문장 1건은 8s fail-fast)', rest: null })
  assert.equal(fieldLabel('', 'runtime.vad.threshold').label, 'vad.threshold')
  assert.equal(Array.from(fieldLabel('가'.repeat(60), 'k').label).length, 40)
})

test('Form 렌더: 잠긴 칸은 입력 DOM 이 없다 · 비밀 참조는 값 입력 없이 이름만, [비밀 참조 연결]은 권한이 있을 때만 · 바뀐 칸은 "바뀜"+원래대로', () => {
  const fields = fieldsFromEffective(
    eff([
      policy({ key: 'connection.timeoutMs', stored: 20000 }),
      policy({ key: 'connection.credentialRef', type: 'SECRET_REF', lock: 'CREDENTIAL_ONLY', stored: 'env:HOME_KEY' }),
      policy({ key: 'runtime.device', type: 'ENUM', enum: ['cpu', 'mps'], lock: 'SERVICE_MANAGED', lockMessage: '서비스 설정 파일에서 관리', stored: 'mps' }),
    ]),
    false,
  )
  const noop = () => undefined
  const base = { fields, errors: {}, onChange: noop, onReset: noop }
  const html = renderToStaticMarkup(createElement(FieldList, { ...base, draft: { patch: { 'connection.timeoutMs': 45000 }, unknown: {} }, secret: { canRead: true, canLink: false, onRead: noop, onLink: noop } }))
  assert.equal((html.match(/<input/g) ?? []).length, 1, '입력칸은 timeoutMs 하나')
  assert.match(html, /env:HOME_KEY/)
  assert.match(html, /있는지 확인/)
  assert.doesNotMatch(html, /비밀 참조 연결/)
  assert.match(html, /바뀜/)
  assert.match(html, /원래대로/)
  assert.match(html, /바꿀 수 없는 설정 1개/)
  assert.doesNotMatch(html, /<select/)
  const sup = renderToStaticMarkup(createElement(FieldList, { ...base, draft: EMPTY_DRAFT, secret: { canRead: true, canLink: true, onRead: noop, onLink: noop } }))
  assert.match(sup, /비밀 참조 연결/)
  assert.doesNotMatch(sup, /바뀜/)
})

test('예비 순서 조작: 위·아래·빼기(마지막 하나는 안 빠짐)·넣기(중복·5개 초과 안 됨)', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c'])
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b'])
  assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b'])
  assert.deepEqual(removeItem(['a', 'b'], 0), ['b'])
  assert.deepEqual(removeItem(['a'], 0), ['a'])
  assert.deepEqual(addItem(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(addItem(['a', 'b'], 'b'), ['a', 'b'])
  assert.deepEqual(addItem(['a', 'b', 'c', 'd', 'e'], 'f'), ['a', 'b', 'c', 'd', 'e'])
})

test('비밀 참조 선택지: 이 연결이 허용한 것 중 서버에 있는 것 · 허용됐지만 없는 것은 이름만', () => {
  const r = (ref: string, exists: boolean, allowedFor: string[]) => ({ ref, source: 'env' as const, exists, mtime: null, usedBy: [], allowedFor, lastUsedAt: null })
  const { ok, missing } = credentialChoices([r('env:A', true, ['k1']), r('env:B', false, ['k1']), r('env:C', true, ['k2'])], 'k1')
  assert.deepEqual(ok.map((x) => x.ref), ['env:A'])
  assert.deepEqual(missing.map((x) => x.ref), ['env:B'])
})
