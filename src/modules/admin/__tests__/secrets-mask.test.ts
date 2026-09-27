/**
 * Secret·경로 비노출(task-005b 핵심 요구 2·H1): credentialRef 존재 확인은 값을 읽지 않고, 응답 변환은 시크릿 형태·서버 경로를 가린다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeCredentialRef, isCredentialRef } from '../../infra/secrets'
import { looksSecret, maskSensitive, MASK } from '../../infra/mask'
import { displayJson, effectiveDto, healthDetail, maskPath, scrubServerPath, traceStep } from '../present'
import type { EffectiveConfiguration } from '@/modules/engine'

test('credentialRef 형식: env:NAME·file:name 만, 경로 순회·공백·대소문자 섞인 file 이름 거부', () => {
  for (const ok of ['env:HOME_M4_API_KEY', 'file:tts-service-token', 'file:a.b-c']) assert.equal(isCredentialRef(ok), true, ok)
  for (const bad of ['file:../etc/passwd', 'file:/etc/passwd', 'file:a/b', 'env:lower', 'file:ab', 'file:Upper', 'sk-123', '', 'env:', 'file:.hidden']) assert.equal(isCredentialRef(bad), false, bad)
  assert.equal(describeCredentialRef('file:../../x'), null)
})

test('env: ref 는 값이 비어 있지 않은지만 본다', () => {
  process.env.KAIWA_TEST_REF_SET = 'value-not-returned'
  process.env.KAIWA_TEST_REF_EMPTY = '   '
  const set = describeCredentialRef('env:KAIWA_TEST_REF_SET')!
  assert.deepEqual(set, { ref: 'env:KAIWA_TEST_REF_SET', source: 'env', exists: true, mtime: null })
  assert.ok(!JSON.stringify(set).includes('value-not-returned'))
  assert.equal(describeCredentialRef('env:KAIWA_TEST_REF_EMPTY')!.exists, false)
  assert.equal(describeCredentialRef('env:KAIWA_TEST_REF_NONE')!.exists, false)
})

test('file: ref 는 SECRETS_DIR 바로 아래 일반 파일 존재만(내용 미열람), 디렉토리는 false', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kaiwa-secrets-'))
  const prev = process.env.SECRETS_DIR
  try {
    process.env.SECRETS_DIR = dir
    writeFileSync(join(dir, 'tts-service-token'), 'TOP-SECRET-CONTENT', { mode: 0o600 })
    mkdirSync(join(dir, 'a-dir'))
    const r = describeCredentialRef('file:tts-service-token')!
    assert.equal(r.exists, true)
    assert.ok(typeof r.mtime === 'string')
    assert.ok(!JSON.stringify(r).includes('TOP-SECRET-CONTENT'))
    assert.equal(describeCredentialRef('file:a-dir')!.exists, false)
    assert.equal(describeCredentialRef('file:missing-one')!.exists, false)
    delete process.env.SECRETS_DIR
    assert.equal(describeCredentialRef('file:tts-service-token')!.exists, false)
  } finally {
    if (prev === undefined) delete process.env.SECRETS_DIR
    else process.env.SECRETS_DIR = prev
    rmSync(dir, { recursive: true, force: true })
  }
})

test('시크릿 형태 판정: 키·토큰·JWT·긴 hex 는 가리고, 모델 id·cuid·ref·URL 은 둔다', () => {
  for (const s of ['sk-ant-api03-abcdef', 'Bearer abc.def', 'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeKKF2QT4', '0123456789abcdef0123456789abcdef01234567', 'AbCdEfGh1234567890IjKlMnOpQrStUvWx']) assert.equal(looksSecret(s), true, s)
  for (const s of ['zipformer-ja-reazonspeech-2024-08-01-int8', 'cmg1abcdefghijklmnopqrstu', 'env:HOME_M4_API_KEY', 'file:tts-service-token', 'http://127.0.0.1:8100', 'qwen2.5:14b-instruct', 'claude-haiku-4-5']) assert.equal(looksSecret(s), false, s)
})

test('maskSensitive: 키 이름·credentialRef 자리·URL 자격증명·토큰 쿼리', () => {
  const out = maskSensitive({
    apiKey: 'hunter2',
    password: 'p',
    credentialRef: 'plain-value',
    ok: { credentialRef: 'env:X_Y' },
    url: 'http://user:pw@host:8000/x?token=abc&keep=1',
    list: ['sk-abcdef', 'fine'],
    n: 3,
  })
  assert.equal(out.apiKey, MASK)
  assert.equal(out.password, MASK)
  assert.equal(out.credentialRef, MASK)
  assert.deepEqual(out.ok, { credentialRef: 'env:X_Y' })
  assert.equal(out.url, 'http://host:8000/x?token=***&keep=1')
  assert.deepEqual(out.list, [MASK, 'fine'])
  assert.equal(out.n, 3)
})

test('서버 경로: 절대 경로는 파일 이름만, 문장 속 경로는 통째로 가림, URL 경로·상대 경로는 그대로', () => {
  assert.equal(maskPath('/home/brownjeon/.npm-global/bin/claude'), '…/claude')
  assert.equal(scrubServerPath('/home/brownjeon/apps/thekaiwa/shared/secrets'), '…/secrets')
  assert.equal(scrubServerPath('failed to open /Users/me/x.txt'), '***')
  assert.equal(scrubServerPath('/ws/speech'), '/ws/speech')
  assert.equal(scrubServerPath('.claude/agents/tutor.md'), '.claude/agents/tutor.md')
  const j = displayJson({ binPath: '/usr/local/bin/claude', wsPath: '/ws/speech', manifestUrl: '/models/x/manifest.json', dataDir: '/srv/data/kaiwa', note: 'see /home/x/y' })
  assert.deepEqual(j, { binPath: '…/claude', wsPath: '/ws/speech', manifestUrl: '/models/x/manifest.json', dataDir: '…/kaiwa', note: '***' })
})

test('Health detail 은 화이트리스트 필드만, Trace 단계는 원시값·120자 이하만', () => {
  assert.deepEqual(healthDetail({ errorCode: 'ECONNREFUSED', message: 'x', stderr: '/home/u/secret', body: { a: 1 }, httpStatus: 503, reason: 'SERVICE_DOWN', skipped: true }), {
    errorCode: 'ECONNREFUSED',
    message: 'x',
    reason: 'SERVICE_DOWN',
    httpStatus: 503,
    skipped: true,
  })
  const long = 'あ'.repeat(200)
  assert.deepEqual(traceStep({ name: 'LLM', ms: 12, model: 'haiku', text: long, nested: { a: 1 }, connection: 'claude-cli-local' }), { name: 'LLM', ms: 12, model: 'haiku', connection: 'claude-cli-local' })
  assert.equal(traceStep({ ms: 1 }), null)
})

function eff(): EffectiveConfiguration {
  return {
    environment: 'LOCAL',
    scope: 'ENGINE_CONNECTION',
    targetId: 'ec1',
    targetKey: 'claude-cli-local',
    engineId: 'claude-cli',
    schemaVersion: 1,
    resolvedAt: new Date().toISOString(),
    cacheHit: false,
    emptyLayers: ['APPLICATION_CONFIG', 'USER_SETTING'],
    warnings: ['W_UNKNOWN_KEY(runtime.x@CONNECTION_PROFILE)'],
    keys: [
      {
        key: 'connection.binPath',
        type: 'PATH',
        value: '/home/brownjeon/.npm-global/bin/claude',
        source: 'ENVIRONMENT',
        sourceRef: 'env:CLAUDE_CLI_PATH',
        editability: 'RESTART_REQUIRED',
        restartRequired: true,
        secret: false,
        shadowed: true,
        layers: [
          { source: 'DEFAULT', value: 'claude', sourceRef: 'schema:claude-cli@1#connection.binPath' },
          { source: 'ENVIRONMENT', value: '/home/brownjeon/.npm-global/bin/claude', sourceRef: 'env:CLAUDE_CLI_PATH' },
        ],
        warnings: ['I_ENV_PLACEHOLDER(CLAUDE_CLI_PATH@CONNECTION_PROFILE)'],
      },
      { key: 'connection.credentialRef', type: 'SECRET_REF', value: 'env:HOME_M4_API_KEY', source: 'CONNECTION_PROFILE', sourceRef: 'db:x', editability: 'SECRET', restartRequired: false, secret: true, shadowed: false, layers: [], warnings: [] },
    ],
  }
}

test('Effective DTO: ADMIN 요약은 sourceRef·layers 없이 shadowed 만, DEVELOPER 는 전체 — env 절대 경로는 $NAME 로', () => {
  const summary = effectiveDto(eff(), { full: false, secretExists: () => false })
  const bin = summary.keys[0]
  assert.equal(bin.value, '$CLAUDE_CLI_PATH')
  assert.equal(bin.shadowed, true)
  assert.equal(bin.sourceRef, undefined)
  assert.equal(bin.layers, undefined)
  assert.deepEqual(bin.warnings, ['I_ENV_PLACEHOLDER'])
  assert.deepEqual(summary.warnings, ['W_UNKNOWN_KEY'])
  assert.equal(summary.keys[1].exists, false)
  const full = effectiveDto(eff(), { full: true, secretExists: (r) => r === 'env:HOME_M4_API_KEY' })
  assert.equal(full.detail, 'FULL')
  assert.equal(full.keys[0].layers?.[1].value, '$CLAUDE_CLI_PATH')
  assert.equal(full.keys[1].value, 'env:HOME_M4_API_KEY')
  assert.equal(full.keys[1].exists, true)
  assert.ok(!JSON.stringify([summary, full]).includes('/home/'))
})
