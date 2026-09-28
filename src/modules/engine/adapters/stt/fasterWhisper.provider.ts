/**
 * faster-whisper Engine Provider — 분석(검증) STT. HTTP = VoiceVault whisper-service 재사용(127.0.0.1:8090), LOCAL = worker 내장(Phase 2).
 * HTTP 연결의 모델·장치 키는 서비스 쪽 설정이라 `editabilityBy.HTTP=READ_ONLY`(configuration-resolution §12-3).
 */
import type { EngineProvider } from '../../registry/types'
import { probeHttpHealth } from '../common/httpHealth'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'

export const fasterWhisperProvider: EngineProvider = {
  descriptor: {
    id: 'faster-whisper',
    displayName: 'faster-whisper',
    type: 'STT',
    roles: ['ANALYSIS_STT'],
    connectionTypes: ['HTTP', 'LOCAL'],
    capabilities: ['TRANSCRIPTION', 'WORD_TIMESTAMP', 'LANGUAGE_JA', 'LANGUAGE_DETECT'],
    schemaVersion: 1,
    pluginVersion: '0.1.0',
    providerClass: 'FasterWhisperProvider',
    sourcePath: `${REPO_ADAPTERS}/stt/fasterWhisper.provider.ts`,
  },
  configurationSchema: () => ({
    engineId: 'faster-whisper',
    schemaVersion: 1,
    groups: SCHEMA_GROUPS,
    keys: [
      key('connection.baseUrl', 'URL', 'http://127.0.0.1:8090', { appliesTo: ['HTTP'], strict: true, envAlias: ['WHISPER_SERVICE_URL'], description: 'whisper-service 주소(VoiceVault 재사용)' }),
      key('connection.timeoutMs', 'INTEGER', 60000, { min: 5000, max: 180000, description: '한 발화(≤60s) 전사 상한' }),
      key('connection.retry', 'INTEGER', 1, { min: 0, max: 3, description: '재시도 횟수' }),
      key('connection.credentialRef', 'SECRET_REF', null, { appliesTo: ['HTTP'], strict: true, allowedRefs: [], description: '서비스 인증 ref(없으면 null) — whisper-service 는 인증이 없어 걸 수 있는 ref 가 없다' }),
      key('runtime.model', 'ENUM', 'medium', {
        enum: ['tiny', 'base', 'small', 'medium', 'large-v3', 'large-v3-turbo'],
        editability: 'RESTART_REQUIRED',
        restartTarget: 'thekaiwa-speech-worker',
        editabilityBy: { HTTP: 'READ_ONLY' },
        strict: true,
        description: 'Whisper 모델 크기',
        impact: '메모리 1.7GB(medium)~6GB(large-v3), CPU 지연',
      }),
      key('runtime.computeType', 'ENUM', 'int8', { enum: ['int8', 'int8_float16', 'float16', 'float32', 'default'], editability: 'RESTART_REQUIRED', editabilityBy: { HTTP: 'READ_ONLY' }, description: '연산 정밀도' }),
      key('runtime.device', 'ENUM', 'cpu', { enum: ['cpu', 'cuda', 'auto'], editability: 'RESTART_REQUIRED', editabilityBy: { HTTP: 'READ_ONLY' }, description: '추론 장치' }),
      key('runtime.cpuThreads', 'INTEGER', 4, {
        min: 1,
        max: 16,
        editability: 'RESTART_REQUIRED',
        restartTarget: 'thekaiwa-speech-worker',
        editabilityBy: { HTTP: 'READ_ONLY' },
        envAlias: ['SPEECH_THREADS'],
        description: '추론 CPU 스레드 수',
      }),
      key('runtime.language', 'STRING', 'ja', { description: '언어 고정(자동 감지 끔)' }),
      key('runtime.beamSize', 'INTEGER', 5, { min: 1, max: 10, description: '빔 크기', impact: '지연 ∝ beamSize' }),
      key('runtime.vadFilter', 'BOOLEAN', true, { description: 'VAD 필터' }),
      LOG_LEVEL_KEY,
    ],
  }),
  async healthCheck(profile) {
    if (profile.connectionType !== 'HTTP') {
      return { ok: false, status: 'UNKNOWN', latencyMs: null, detail: { skipped: true, reason: 'NOT_APPLICABLE', message: 'worker 내장 연결은 worker Health(Phase 2)에서 확인합니다' } }
    }
    return probeHttpHealth(profile.values['connection.baseUrl'], {
      interpret: (json) =>
        json.whisperLoaded === false ? { ok: false, status: 'DEGRADED', detail: { errorCode: 'MODEL_NOT_LOADED', message: '서비스는 떠 있지만 모델이 로드되지 않았습니다' } } : {},
    })
  },
  modelSummary: (values) => (typeof values['runtime.model'] === 'string' ? (values['runtime.model'] as string) : null),
}
