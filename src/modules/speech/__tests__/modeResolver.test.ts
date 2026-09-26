import { test } from 'node:test'
import assert from 'node:assert/strict'
import { platformFrom, resolveRecognitionMode } from '../stt/modeResolver'

test('인식 모드 해석: 엔진명 없이 경로만, 웹은 gateway 로', () => {
  assert.deepEqual(resolveRecognitionMode('AUTO', 'app'), { realtime: 'ONDEVICE', analysis: true, reviewThreshold: 0.85 })
  assert.equal(resolveRecognitionMode('AUTO', 'web').realtime, 'GATEWAY')
  assert.equal(resolveRecognitionMode('FAST', 'web').realtime, 'GATEWAY')
  assert.deepEqual(resolveRecognitionMode('ACCURATE', 'app'), { realtime: 'GATEWAY', analysis: true, reviewThreshold: 0.9 })
  assert.equal(resolveRecognitionMode('OFFLINE', 'web').realtime, 'GATEWAY')
  assert.equal(resolveRecognitionMode('OFFLINE', 'app').realtime, 'ONDEVICE')
  assert.equal(platformFrom(new Headers({ 'x-client-platform': 'app' })), 'app')
  assert.equal(platformFrom(new Headers()), 'web')
})
