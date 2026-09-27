import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AdminMenuItem } from '@/types/admin'
import { activeMenu, editabilityText, envMessage, envTone, groupMenu, panelHelp, sourceLayer, voiceBadge, voiceFilterOf } from '../console/labels'

const MENU: AdminMenuItem[] = [
  { id: 'dashboard', path: '/admin/dashboard', label: '대시보드', capability: 'engine.read', phase: 1, group: 'overview' },
  { id: 'speech-realtime', path: '/admin/speech/realtime', label: '실시간 음성 인식', capability: 'engine.read', phase: 1, group: 'speech' },
  { id: 'llm', path: '/admin/llm', label: 'LLM', capability: 'engine.read', phase: 1, group: 'llm' },
  { id: 'voices', path: '/admin/voices', label: '목소리', capability: 'voices.read', phase: 1, group: 'voices' },
  { id: 'connections', path: '/admin/connections', label: '연결', capability: 'engine.read', phase: 1, group: 'engines' },
  { id: 'diagnostics', path: '/admin/diagnostics', label: '진단', capability: 'engine.read', phase: 1, group: 'diagnostics' },
]

test('activeMenu: 가장 긴 접두사, 경계는 / 단위', () => {
  assert.equal(activeMenu(MENU, '/admin/connections/abc')?.id, 'connections')
  assert.equal(activeMenu(MENU, '/admin/diagnostics/traces/t_1')?.id, 'diagnostics')
  assert.equal(activeMenu(MENU, '/admin/dashboard')?.id, 'dashboard')
  assert.equal(activeMenu(MENU, '/admin/llmx'), null)
  assert.equal(activeMenu(MENU, '/admin/plugins'), null)
})

test('groupMenu: 이어지는 같은 묶음을 합친다', () => {
  assert.deepEqual(
    groupMenu(MENU).map((g) => [g.label, g.items.map((i) => i.id)]),
    [
      ['개요', ['dashboard']],
      ['엔진', ['speech-realtime', 'llm']],
      ['자원', ['voices', 'connections']],
      ['설정·진단', ['diagnostics']],
    ],
  )
})

test('환경 띠: PRODUCTION 은 빨간 띠', () => {
  assert.equal(envTone('PRODUCTION').strip, 'bg-bad text-surface')
  assert.equal(envMessage('PRODUCTION'), '운영 환경 — 변경은 확인 절차를 거칩니다')
  assert.equal(envMessage('LOCAL'), '개발 환경 — 운영과 분리된 설정 행을 봐요')
  assert.equal(envMessage('STAGING'), 'STAGING 환경')
  assert.notEqual(envTone('LOCAL').strip, envTone('PRODUCTION').strip)
})

test('sourceLayer: 8층 번호', () => {
  assert.equal(sourceLayer('DEFAULT'), 1)
  assert.equal(sourceLayer('ENVIRONMENT'), 4)
  assert.equal(sourceLayer('RUNTIME_OVERRIDE'), 8)
})

test('editabilityText: restartRequired 면 재시작 필요', () => {
  assert.equal(editabilityText('RUNTIME_EDITABLE'), '즉시 반영')
  assert.equal(editabilityText('READ_ONLY', true), '재시작 필요')
  assert.equal(editabilityText('SECRET', true), '시크릿(참조만)')
})

test('voiceBadge·voiceFilterOf', () => {
  assert.deepEqual(voiceBadge('AVAILABLE', true), { label: '사용 가능', tone: 'good' })
  assert.deepEqual(voiceBadge('AVAILABLE', false), { label: '꺼짐', tone: 'neutral' })
  assert.equal(voiceBadge('IMPORTING', false).tone, 'dashed')
  assert.equal(voiceFilterOf('AVAILABLE', true), 'AVAILABLE')
  assert.equal(voiceFilterOf('AVAILABLE', false), 'OFF')
  assert.equal(voiceFilterOf('ERROR', false), 'ERROR')
  assert.equal(voiceFilterOf('IMPORTING', false), null)
})

test('panelHelp: 연결 방식별 도움말', () => {
  assert.match(panelHelp('ONDEVICE', 'REALTIME_STT'), /휴대폰 안에서만/)
  assert.match(panelHelp('CLI', 'LLM'), /30초에 한 번/)
  assert.match(panelHelp('HTTP', 'TTS'), /최대 5초/)
})
