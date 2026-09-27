import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNAVAILABLE_HINT, SKIP_TEXT } from '../console/labels'
import { resultView } from '../console/resultView'

test('HEALTH 정상·저하', () => {
  const v = resultView('HEALTH', { ok: true, status: 'HEALTHY', latencyMs: 42, detail: { version: '0.3.1', models: 5, junk: 'x' } })
  assert.equal(v.badge, 'HEALTHY')
  assert.equal(v.reason, null)
  assert.equal(v.hint, null)
  assert.deepEqual(v.chips, [
    ['version', '0.3.1'],
    ['models', '5'],
  ])
  assert.equal(resultView('HEALTH', { ok: true, status: 'DEGRADED', detail: {} }).badge, 'DEGRADED')
})

test('HEALTH 꺼진 서비스 = UNAVAILABLE + 안내(오류 아님)', () => {
  const v = resultView('HEALTH', { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'ECONNREFUSED', message: '서비스가 실행 중이 아닙니다(연결 거부)' } })
  assert.equal(v.badge, 'UNAVAILABLE')
  assert.equal(v.reason, '서비스에 연결할 수 없어요(연결 거부)')
  assert.equal(v.hint, UNAVAILABLE_HINT)
  assert.equal(v.message, '서비스가 실행 중이 아닙니다(연결 거부)')
})

test('HEALTH 설정 오류·HTTP 코드·EXIT 코드', () => {
  assert.equal(resultView('HEALTH', { ok: false, status: 'MISCONFIGURED', detail: { errorCode: 'CREDENTIAL_MISSING' } }).reason, '시크릿 참조를 찾을 수 없어요')
  assert.equal(resultView('HEALTH', { ok: false, status: 'DEGRADED', detail: { errorCode: 'HTTP_503' } }).reason, '서비스가 오류로 응답했어요(HTTP 503)')
  assert.equal(resultView('HEALTH', { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'EXIT_2' } }).reason, '실행 파일이 오류로 끝났어요(종료 코드 2)')
  assert.equal(resultView('HEALTH', { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'WEIRD', message: '고정 문구' } }).reason, '고정 문구')
  assert.equal(resultView('HEALTH', { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'WEIRD' } }).reason, '실패했어요 (WEIRD)')
})

test('SKIPPED: 서버 단일 표현(skipped+reason) 세 갈래', () => {
  const na = resultView('HEALTH', { ok: false, status: 'UNKNOWN', detail: { skipped: true, reason: 'NOT_APPLICABLE', message: '온디바이스 연결은 기기에서만 확인할 수 있습니다' } })
  assert.equal(na.badge, 'SKIPPED')
  assert.equal(na.hint, '온디바이스 연결은 기기에서만 확인할 수 있습니다')
  assert.equal(na.message, null)

  const down = resultView('FUNCTIONAL', { ok: false, status: 'UNAVAILABLE', detail: { skipped: true, reason: 'SERVICE_DOWN', errorCode: 'ECONNREFUSED' } })
  assert.equal(down.badge, 'SKIPPED')
  assert.equal(down.hint, SKIP_TEXT.SERVICE_DOWN)
  assert.equal(down.reason, '서비스에 연결할 수 없어요(연결 거부)')

  const ni = resultView('FUNCTIONAL', { ok: false, status: 'UNKNOWN', detail: { skipped: true, reason: 'NOT_IMPLEMENTED' } })
  assert.equal(ni.badge, 'SKIPPED')
  assert.equal(ni.hint, SKIP_TEXT.NOT_IMPLEMENTED)
  assert.equal(ni.reason, null)
})

test('SKIPPED: 가이드 초안 대체 표현도 읽는다', () => {
  assert.equal(resultView('FUNCTIONAL', { ok: null, status: 'UNKNOWN', detail: null }).badge, 'SKIPPED')
  assert.equal(resultView('FUNCTIONAL', { ok: false, status: 'NOT_APPLICABLE', detail: {} }).badge, 'SKIPPED')
  const asset = resultView('FUNCTIONAL', { ok: false, status: 'UNKNOWN', detail: { errorCode: 'E_TEST_INPUT_MISSING' } })
  assert.equal(asset.badge, 'SKIPPED')
  assert.equal(asset.hint, SKIP_TEXT.TEST_ASSET_PENDING)
})

test('FUNCTIONAL 통과·실패·시간 초과', () => {
  const pass = resultView('FUNCTIONAL', { ok: true, status: 'HEALTHY', detail: { schemaValid: true, model: 'llm-small', outputChars: 212 } })
  assert.equal(pass.badge, 'PASSED')
  assert.deepEqual(pass.chips, [
    ['model', 'llm-small'],
    ['schemaValid', '예'],
    ['outputChars', '212'],
  ])
  assert.equal(resultView('FUNCTIONAL', { ok: false, status: 'DEGRADED', detail: { errorCode: 'SCHEMA_INVALID' } }).badge, 'FAILED')
  assert.equal(resultView('FUNCTIONAL', { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'ETIMEDOUT' } }).badge, 'TIMEOUT')
  assert.equal(resultView('FUNCTIONAL', { ok: false, status: 'UNKNOWN', detail: { errorCode: 'E_TEST_TIMEOUT', timeoutMs: 30000 } }).reason, '응답이 없어요(시간 초과 30초)')
  assert.equal(resultView('FUNCTIONAL', { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'ECONNREFUSED' } }).badge, 'UNAVAILABLE')
  assert.equal(resultView('FUNCTIONAL', { ok: false, status: 'DEGRADED', detail: null }).reason, '실패했어요 (코드 없음)')
})

test('chips: 화이트리스트만, 경로처럼 보이는 문자열은 그리지 않는다', () => {
  const v = resultView('HEALTH', { ok: true, status: 'HEALTHY', detail: { version: '/home/x', device: 'mps', stderr: 'boom', transcript: 'x' } })
  assert.deepEqual(v.chips, [['device', 'mps']])
})
