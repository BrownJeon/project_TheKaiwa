/**
 * Style-Bert-VITS2 Engine Provider — 맥 M4 tts-service(자체 FastAPI 래퍼, :8200). 합성 어댑터(`styleBertHttp`)·TTS 플랫폼 층은 task-003.
 * 스키마 키는 실제 저장 모양(seed `style-bert-m4`: `runtime.defaultModel`)을 따른다. SBV2 파라미터명은 이 어댑터 밖으로 나가지 않는다.
 */
import type { EngineProvider } from '../../registry/types'
import { probeHttpHealth } from '../common/httpHealth'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'

export const styleBertVits2Provider: EngineProvider = {
  descriptor: {
    id: 'style-bert-vits2',
    displayName: 'Style-Bert-VITS2',
    type: 'TTS',
    roles: ['TTS'],
    connectionTypes: ['HTTP'],
    capabilities: ['MULTI_VOICE', 'STYLE', 'SPEED', 'PITCH', 'INTONATION', 'MODEL_REFRESH', 'VOICE_IMPORT', 'SUPPORTS_STYLE'],
    schemaVersion: 1,
    pluginVersion: '0.1.0',
    providerClass: 'StyleBertVits2Provider',
    sourcePath: `${REPO_ADAPTERS}/tts/styleBertVits2.provider.ts`,
  },
  configurationSchema: () => ({
    engineId: 'style-bert-vits2',
    schemaVersion: 1,
    groups: SCHEMA_GROUPS,
    keys: [
      key('connection.baseUrl', 'URL', 'http://192.168.219.100:8200', { strict: true, envAlias: ['TTS_SERVICE_URL', 'TTS_BASE_URL'], description: 'M4 tts-service 주소' }),
      key('connection.timeoutMs', 'INTEGER', 20000, { min: 5000, max: 60000, description: '요청 상한(문장 1건은 8s fail-fast)' }),
      key('connection.retry', 'INTEGER', 1, { min: 0, max: 3, description: '재시도 횟수' }),
      key('connection.credentialRef', 'SECRET_REF', 'file:tts-service-token', { strict: true, description: 'tts-service 인증 ref(값은 서버 파일)' }),
      key('runtime.defaultModel', 'STRING', 'jvnv-F1-jp', { strict: true, description: '기본 음성 모델(AppSetting voice.default 의 VoiceProfile 과 일치해야 함)' }),
      key('runtime.language', 'ENUM', 'JP', { enum: ['JP'], editability: 'READ_ONLY', description: '언어 고정' }),
      key('runtime.maxChars', 'INTEGER', 100, { min: 50, max: 200, description: '문장 분할 상한' }),
      key('runtime.sdpRatio', 'NUMBER', 0.2, { min: 0, max: 1, description: 'SDP 비율' }),
      key('runtime.noise', 'NUMBER', 0.6, { min: 0, max: 2, description: '노이즈' }),
      key('runtime.noiseW', 'NUMBER', 0.8, { min: 0, max: 2, description: '노이즈 W' }),
      key('runtime.device', 'ENUM', 'mps', { enum: ['cpu', 'mps'], editability: 'RESTART_REQUIRED', restartTarget: 'tts-service', description: '합성 장치', impact: 'M4 MPS vs CPU 합성 시간' }),
      LOG_LEVEL_KEY,
    ],
  }),
  healthCheck: (profile) => probeHttpHealth(profile.values['connection.baseUrl']),
  modelSummary: (values) => (typeof values['runtime.defaultModel'] === 'string' ? (values['runtime.defaultModel'] as string) : null),
}
