/**
 * home-m4-api Engine Provider — 보조 LLM(단어 보강·보기 생성·점검 폴백 후보). 회화·채팅 턴은 `runtime.allowedTasks` 로 막힌다.
 * Health = `GET <baseUrl>/health`(공개 엔드포인트, 키 없이) + credentialRef 존재 확인(값은 읽지 않는다).
 */
import { describeCredentialRef } from '@/modules/infra'
import type { EngineProvider } from '../../registry/types'
import { probeHttpHealth } from '../common/httpHealth'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'

const SRC = `${REPO_ADAPTERS}/llm/homeM4.ts`

export const homeM4Provider: EngineProvider = {
  descriptor: {
    id: 'home-m4-api',
    displayName: 'home-m4-api (Ollama)',
    type: 'LLM',
    roles: ['LLM'],
    connectionTypes: ['HTTP'],
    capabilities: ['JSON_SCHEMA'],
    schemaVersion: 1,
    pluginVersion: '0.1.0',
    providerClass: 'HomeM4ApiProvider',
    sourcePath: SRC,
  },
  configurationSchema: () => ({
    engineId: 'home-m4-api',
    schemaVersion: 1,
    groups: SCHEMA_GROUPS,
    keys: [
      key('connection.baseUrl', 'URL', 'http://192.168.219.100:8000', { strict: true, envAlias: ['AI_API_BASE'], description: 'home-m4-api 주소(/v1/chat 의 앞부분)' }),
      key('connection.timeoutMs', 'INTEGER', 20000, { min: 5000, max: 600000, description: '요청 상한(nginx proxy_read_timeout 600s 이내)' }),
      key('connection.retry', 'INTEGER', 0, { min: 0, max: 3, description: '429 재시도 횟수' }),
      key('connection.credentialRef', 'SECRET_REF', 'file:home-m4-api-key', {
        strict: true,
        envAlias: ['AI_API_KEY_REF'],
        envSecretAlias: ['AI_API_KEY'],
        description: 'X-API-Key 값의 ref 이름(env:NAME | file:name). 값은 어댑터 호출 직전에만 해석',
      }),
      key('runtime.model', 'STRING', 'qwen2.5:14b', { strict: true, envAlias: ['AI_API_MODEL'], description: '모델 이름' }),
      key('runtime.temperature', 'NUMBER', 0.3, { min: 0, max: 1.5, description: '샘플링 온도' }),
      key('runtime.maxOutputTokens', 'INTEGER', 1024, { min: 128, max: 4096, description: '출력 토큰 상한' }),
      key('runtime.systemFirst', 'BOOLEAN', true, { editability: 'READ_ONLY', description: '첫 메시지 system 강제(프롬프트 주입 방지) — 코드 고정' }),
      key('runtime.allowedTasks', 'JSON', ['wordEnrich', 'distractorGen', 'chatReviewFallback'], { description: '이 연결이 맡을 수 있는 AI 지점. 회화·채팅 턴은 어떤 설정으로도 불가' }),
      LOG_LEVEL_KEY,
    ],
  }),
  async healthCheck(profile) {
    const out = await probeHttpHealth(profile.values['connection.baseUrl'])
    if (!out.ok) return out
    const ref = profile.values['connection.credentialRef']
    const cred = typeof ref === 'string' ? describeCredentialRef(ref) : null
    if (!cred?.exists) {
      return { ok: false, status: 'MISCONFIGURED', latencyMs: out.latencyMs, detail: { ...out.detail, errorCode: 'CREDENTIAL_MISSING', message: '자격증명(credentialRef)이 가리키는 값이 설정돼 있지 않습니다' } }
    }
    return out
  },
  modelSummary: (values) => (typeof values['runtime.model'] === 'string' ? (values['runtime.model'] as string) : null),
  sourceCodeLayer: () => ({
    'runtime.systemFirst': { value: true, sourceRef: `code:${SRC}#assertSystemFirst` },
  }),
}
