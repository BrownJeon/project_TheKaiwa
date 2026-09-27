/**
 * sherpa-onnx + ReazonSpeech Engine Provider — 실시간 STT(온디바이스 플러그인 / 우분투 gateway 폴백).
 * 실제 인식 어댑터(`reazonOnDevice`·`reazonGateway`)는 task-003. 여기서는 descriptor·schema·health 만.
 * ONDEVICE 연결은 서버에서 확인할 대상이 없다 — Health 는 "생략(UNKNOWN)" 으로 기록하고 connection 상태를 바꾸지 않는다.
 * HTTP(gateway) 연결은 gateway 공개 `/health`(시크릿 없음)로 판정한다(task-003e): `status` LOADING·FAILED 또는 `ok:false` 면
 * 인식할 수 없으므로 UNAVAILABLE(티켓 발급 중단), MISCONFIGURED 는 그대로, `ok:true`(OK) 면 HEALTHY.
 */
import type { EngineProvider } from '../../registry/types'
import { probeHttpHealth, type HealthInterpreter } from '../common/httpHealth'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'

const GATEWAY_STATUS: Record<string, { status: 'UNAVAILABLE' | 'MISCONFIGURED'; message: string }> = {
  LOADING: { status: 'UNAVAILABLE', message: '인식 모델을 불러오는 중입니다(기동 중)' },
  FAILED: { status: 'UNAVAILABLE', message: '인식 모델을 불러오지 못했습니다' },
  MISCONFIGURED: { status: 'MISCONFIGURED', message: '서비스 쪽 설정(티켓 검증 키 등)이 비어 있습니다' },
}

/** 공개 `/health` = `{ok, status: LOADING|OK|FAILED|MISCONFIGURED}`(A 계약). 시크릿을 붙인 상세(#143)는 보지 않는다. */
export const interpretGatewayHealth: HealthInterpreter = (json) => {
  const s = typeof json.status === 'string' ? GATEWAY_STATUS[json.status] : undefined
  if (s) return { ok: false, status: s.status, detail: { errorCode: `SERVICE_${String(json.status)}`, message: s.message } }
  if (json.ok === false) return { ok: false, status: 'UNAVAILABLE', detail: { errorCode: 'SERVICE_NOT_READY', message: '서비스는 떠 있지만 인식 준비가 되지 않았습니다' } }
  return {}
}

export const sherpaReazonProvider: EngineProvider = {
  descriptor: {
    id: 'sherpa-onnx-reazon',
    displayName: 'ReazonSpeech (sherpa-onnx)',
    type: 'STT',
    roles: ['REALTIME_STT'],
    connectionTypes: ['ONDEVICE', 'HTTP'],
    capabilities: ['TRANSCRIPTION', 'VAD', 'SEGMENT_PARTIAL', 'LANGUAGE_JA', 'ONDEVICE', 'STREAMING_WS'],
    schemaVersion: 1,
    pluginVersion: '0.1.0',
    providerClass: 'SherpaReazonProvider',
    sourcePath: `${REPO_ADAPTERS}/stt/sherpaReazon.provider.ts`,
  },
  configurationSchema: () => ({
    engineId: 'sherpa-onnx-reazon',
    schemaVersion: 1,
    groups: SCHEMA_GROUPS,
    keys: [
      key('connection.baseUrl', 'URL', 'http://127.0.0.1:8100', { appliesTo: ['HTTP'], strict: true, envAlias: ['SPEECH_GATEWAY_URL'], description: 'speech gateway 주소(폴백 실시간 STT)' }),
      key('connection.wsPath', 'STRING', '/ws/speech', { appliesTo: ['HTTP'], strict: true, description: 'gateway WebSocket 경로' }),
      key('connection.timeoutMs', 'INTEGER', 15000, { appliesTo: ['HTTP'], min: 5000, max: 60000, description: '세그먼트 인식 상한' }),
      key('connection.manifestUrl', 'STRING', '/models/reazonspeech-int8/manifest.json', {
        appliesTo: ['ONDEVICE'],
        editability: 'REDEPLOY_REQUIRED',
        strict: true,
        description: '앱이 모델을 받는 manifest 경로(배포 경로와 묶임)',
      }),
      key('connection.modelBytes', 'INTEGER', 160000000, { appliesTo: ['ONDEVICE'], editability: 'REDEPLOY_REQUIRED', description: '모델 다운로드 크기(진행률 표시용)' }),
      key('runtime.provider', 'ENUM', 'cpu', { enum: ['cpu'], editability: 'READ_ONLY', description: 'GPU 없음·모바일 CPU 고정' }),
      key('runtime.numThreads', 'INTEGER', 2, { min: 1, max: 8, editability: 'RESTART_REQUIRED', restartTarget: 'thekaiwa-speech-gateway', description: '디코더 스레드', impact: 'ONDEVICE 는 발열·배터리, HTTP 는 gateway CPU 경합' }),
      key('runtime.decodingMethod', 'ENUM', 'greedy_search', { enum: ['greedy_search', 'modified_beam_search'], description: '디코딩 방식' }),
      key('runtime.modelVersion', 'STRING', 'zipformer-ja-reazonspeech-2024-08-01-int8', {
        editability: 'RESTART_REQUIRED',
        restartTarget: 'thekaiwa-speech-gateway',
        strict: true,
        description: 'ONDEVICE 는 다음 앱 기동 시 재다운로드, HTTP 는 gateway 재시작',
      }),
      key('runtime.vad.model', 'ENUM', 'silero', { enum: ['silero'], editability: 'READ_ONLY', description: 'VAD 모델 — 고정' }),
      key('runtime.vad.endpointSilenceMs', 'INTEGER', 500, { min: 200, max: 2000, description: '발화 종료로 판정하는 무음 길이', impact: 'endpoint 체감 지연(5초 예산의 첫 구간)' }),
      key('runtime.vad.threshold', 'NUMBER', 0.5, { min: 0.1, max: 0.9, description: 'VAD 확률 임계' }),
      key('runtime.partial', 'BOOLEAN', true, { description: '세그먼트 partial 이벤트 송출' }),
      LOG_LEVEL_KEY,
    ],
  }),
  async healthCheck(profile) {
    if (profile.connectionType === 'ONDEVICE') {
      return { ok: false, status: 'UNKNOWN', latencyMs: null, detail: { skipped: true, reason: 'NOT_APPLICABLE', message: '온디바이스 연결은 기기에서만 확인할 수 있습니다' } }
    }
    return probeHttpHealth(profile.values['connection.baseUrl'], { interpret: interpretGatewayHealth })
  },
  modelSummary: (values) => (typeof values['runtime.modelVersion'] === 'string' ? (values['runtime.modelVersion'] as string) : null),
}
