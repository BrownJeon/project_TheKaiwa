import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MASKED_TEXT,
  PATH_TEXT,
  displayValue,
  flattenDot,
  formatAgo,
  formatMs,
  groupByPrefix,
  maskDeep,
  modelLabel,
  refName,
  sourceCounts,
} from '../console/format'

test('displayValue: 기본 표기', () => {
  assert.equal(displayValue('a', null), '없음')
  assert.equal(displayValue('a', undefined), '없음')
  assert.equal(displayValue('a', true), '예')
  assert.equal(displayValue('a', false), '아니요')
  assert.equal(displayValue('timeoutMs', 15000), '15000')
  assert.equal(displayValue('tasks', ['talk', 'review']), 'talk, review')
  assert.equal(displayValue('vad', { model: 'silero', threshold: 0.5 }), '{"model":"silero","threshold":0.5}')
  assert.equal(displayValue('baseUrl', 'http://127.0.0.1:8100'), 'http://127.0.0.1:8100')
})

test('displayValue: 서버 절대 경로는 키와 상관없이 가린다(H1)', () => {
  assert.equal(displayValue('connection.binPath', '/home/someone/.local/bin/cli'), PATH_TEXT)
  assert.equal(displayValue('anything', '/Users/me/x'), PATH_TEXT)
  assert.equal(displayValue('root', '/root/.cache'), PATH_TEXT)
  assert.equal(displayValue('dir', '~/kaiwa-tts-run'), PATH_TEXT)
  assert.equal(displayValue('dir', 'C:\\Users\\x'), PATH_TEXT)
  // ref 는 그대로(값이 아니라 이름)
  assert.equal(displayValue('connection.binPath', '$LLM_CLI_PATH', 'PATH'), '$LLM_CLI_PATH')
  assert.equal(displayValue('connection.binPath', 'bin/cli', 'PATH'), PATH_TEXT)
  // 서버가 이미 가린 모양(…/basename)은 그대로
  assert.equal(displayValue('connection.binPath', '…/cli'), '…/cli')
})

test('displayValue: 시크릿 의심 키·"***" 는 가린다, 숫자는 그대로', () => {
  assert.equal(displayValue('connection.apiKey', 'sk-abc'), MASKED_TEXT)
  assert.equal(displayValue('connection.api_key', 'sk-abc'), MASKED_TEXT)
  assert.equal(displayValue('runtime.authToken', 'x'), MASKED_TEXT)
  assert.equal(displayValue('password', 'p'), MASKED_TEXT)
  assert.equal(displayValue('any', '***'), MASKED_TEXT)
  assert.equal(displayValue('runtime.maxTokens', 1024), '1024')
  assert.equal(displayValue('connection.credentialRef', 'file:tts-service-token'), 'file:tts-service-token')
})

test('maskDeep: 객체 안쪽 경로·시크릿도 가린다', () => {
  const out = maskDeep({ a: { binPath: '/home/x/cli', token: 'abc', n: 3 }, list: ['/tmp/x', 'ok'] }) as Record<string, unknown>
  assert.deepEqual(out, { a: { binPath: PATH_TEXT, token: MASKED_TEXT, n: 3 }, list: [PATH_TEXT, 'ok'] })
  assert.equal(displayValue('runtime', { cwd: '/home/brownjeon' }).includes('/home'), false)
})

test('refName: ref 이름만, 값·경로·exists 는 쓰지 않는다', () => {
  assert.equal(refName('env:HOME_M4_API_KEY'), 'env:HOME_M4_API_KEY')
  assert.equal(refName('file:tts-service-token'), 'file:tts-service-token')
  assert.equal(refName({ credentialRef: 'env:X', exists: true }), 'env:X')
  assert.equal(refName('sk-live-secret'), MASKED_TEXT)
  assert.equal(refName('file:/etc/secret'), MASKED_TEXT)
  assert.equal(refName('***'), MASKED_TEXT)
  assert.equal(refName(null), '없음')
})

test('flattenDot: 점 표기, 배열·빈 객체는 값 그대로', () => {
  assert.deepEqual(flattenDot({ baseUrl: 'u', vad: { model: 'm', th: { a: 1 } }, tasks: ['a'], empty: {} }), [
    ['baseUrl', 'u'],
    ['vad.model', 'm'],
    ['vad.th.a', 1],
    ['tasks', ['a']],
    ['empty', {}],
  ])
  assert.deepEqual(flattenDot(null), [])
})

test('modelLabel: model → defaultModel → modelVersion → modelByTier', () => {
  assert.equal(modelLabel({ model: 'large-v3' }), 'large-v3')
  assert.equal(modelLabel({ defaultModel: 'small' }), 'small')
  assert.equal(modelLabel({ modelVersion: 'z@1' }), 'z@1')
  assert.equal(modelLabel({ modelByTier: { talk: 'small', review: 'large', analysis: 'large' } }), 'small / large')
  assert.equal(modelLabel({ model: '/models/x.onnx' }), PATH_TEXT)
  assert.equal(modelLabel({}), '—')
  assert.equal(modelLabel(null), '—')
})

test('groupByPrefix: 첫 마디로 묶고 순서 유지', () => {
  const g = groupByPrefix([{ key: 'connection.baseUrl' }, { key: 'runtime.model' }, { key: 'connection.timeoutMs' }, { key: 'logLevel' }])
  assert.deepEqual(
    g.map(([p, rows]) => [p, rows.length]),
    [
      ['connection', 2],
      ['runtime', 1],
      ['logLevel', 1],
    ],
  )
})

test('formatMs', () => {
  assert.equal(formatMs(38), '38ms')
  assert.equal(formatMs(1234), '1.2초')
  assert.equal(formatMs(12_345), '12초')
  assert.equal(formatMs(125_000), '2분 5초')
  assert.equal(formatMs(null), '—')
  assert.equal(formatMs(-1), '—')
})

test('formatAgo: 상대 시각, now=0 이면 목록 시각', () => {
  const now = Date.parse('2026-09-27T07:30:00.000Z')
  assert.equal(formatAgo('2026-09-27T07:29:30.000Z', now), '방금')
  assert.equal(formatAgo('2026-09-27T07:27:00.000Z', now), '3분 전')
  assert.equal(formatAgo('2026-09-27T05:30:00.000Z', now), '2시간 전')
  assert.equal(formatAgo('2026-09-25T07:30:00.000Z', now), '2일 전')
  assert.equal(formatAgo('2026-09-01T07:30:00.000Z', now), '9월 1일')
  assert.equal(formatAgo(null, now), '')
  assert.equal(formatAgo('bad', now), '')
  assert.notEqual(formatAgo('2026-09-27T07:27:00.000Z', 0), '')
})

test('sourceCounts: 층 번호 순, 0 제외', () => {
  assert.deepEqual(sourceCounts({ ENVIRONMENT: 2, DEFAULT: 9, DATABASE: 0, APPLICATION_CONFIG: 5 }), [
    ['DEFAULT', 9],
    ['APPLICATION_CONFIG', 5],
    ['ENVIRONMENT', 2],
  ])
  assert.deepEqual(sourceCounts(undefined), [])
})
