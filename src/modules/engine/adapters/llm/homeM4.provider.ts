/**
 * home-m4-api Engine Provider — 보조 LLM(단어 보강·보기 생성·점검 폴백 후보). 회화·채팅 턴은 `runtime.allowedTasks` 로 막힌다.
 * Health = ① 주소 점검(설정 baseUrl 의 origin 이 서버 env `AI_API_BASE` 와 같아야 한다 — 다르면 호출하지 않고 MISCONFIGURED(TARGET_NOT_ALLOWED),
 *   실호출의 API 키 전송 대상 고정과 같은 규칙, task-012c D-C3(a)) → ② `GET <baseUrl>/health`(공개 엔드포인트, 키 없이)
 *   → ③ credentialRef 허용 목록·존재 확인(값은 읽지 않는다).
 */
import { envOrigin } from '@/modules/infra'
// credentials/index 가 아니라 policy 를 직접 쓴다 — index → registry → providers → 이 파일 순환을 피하려고(REV-035 Low 2).
import { checkCredentialRef } from '../../credentials/policy'
import type { EngineProvider } from '../../registry/types'
import { healthUrl, probeHttpHealth } from '../common/httpHealth'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'

const SRC = `${REPO_ADAPTERS}/llm/homeM4.ts`

/** API 키를 보낼 수 있는 유일한 origin 을 담은 서버 env(= 스키마 `connection.baseUrl` 의 envAlias). */
export const HOME_M4_TARGET_ENV = 'AI_API_BASE'
/** 이 연결이 걸 수 있는 ref — 자기 API 키뿐(Codex C1 CX-1). `env:AI_API_KEY` 는 §2-1 시크릿 별칭이 만드는 ref. */
export const HOME_M4_ALLOWED_REFS = ['env:HOME_M4_API_KEY', 'env:AI_API_KEY', 'file:home-m4-api-key'] as const

export type HomeM4TargetProblem = 'BAD_BASE_URL' | 'TARGET_UNSET' | 'TARGET_NOT_ALLOWED'

/** 연결 주소가 API 키를 보낼 수 있는 대상인가(서버 env origin 과 정확히 같은가). 실호출·Health 공용. */
export function homeM4TargetProblem(baseUrl: unknown): HomeM4TargetProblem | null {
  const target = healthUrl(baseUrl, '/v1/chat')
  if (!target) return 'BAD_BASE_URL'
  const allowed = envOrigin(HOME_M4_TARGET_ENV)
  if (!allowed) return 'TARGET_UNSET'
  return target.origin === allowed ? null : 'TARGET_NOT_ALLOWED'
}

const TARGET_MESSAGE: Record<HomeM4TargetProblem, string> = {
  BAD_BASE_URL: '연결 주소 설정이 올바르지 않습니다',
  TARGET_UNSET: '서버의 AI 서비스 주소 설정(env)이 비어 있어 API 키를 보낼 수 없습니다',
  TARGET_NOT_ALLOWED: '허용되지 않은 AI 서비스 주소입니다(서버 env 의 주소와 다름) — API 키를 보내지 않았습니다',
}

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
      key('connection.baseUrl', 'URL', 'http://192.168.219.100:8000', { strict: true, envAlias: [HOME_M4_TARGET_ENV], consumer: 'APP', envPinned: true, description: 'home-m4-api 주소(/v1/chat 의 앞부분). API 키는 이 값의 origin 이 서버 env AI_API_BASE 와 같을 때만 보낸다' }),
      key('connection.timeoutMs', 'INTEGER', 20000, { min: 5000, max: 600000, description: '요청 상한(nginx proxy_read_timeout 600s 이내)' }),
      key('connection.retry', 'INTEGER', 0, { min: 0, max: 3, description: '429 재시도 횟수' }),
      key('connection.credentialRef', 'SECRET_REF', 'file:home-m4-api-key', {
        strict: true,
        envAlias: ['AI_API_KEY_REF'],
        envSecretAlias: ['AI_API_KEY'],
        allowedRefs: HOME_M4_ALLOWED_REFS,
        consumer: 'APP',
        verify: 'LLM_PROBE_FAST',
        description: 'X-API-Key 값의 ref 이름(env:NAME | file:name). 값은 어댑터 호출 직전에만 해석',
      }),
      key('runtime.model', 'STRING', 'qwen2.5:14b', { strict: true, envAlias: ['AI_API_MODEL'], consumer: 'APP', verify: 'LLM_PROBE_FAST', pattern: '^[A-Za-z0-9._:/-]{1,80}$', description: '모델 이름' }),
      key('runtime.temperature', 'NUMBER', 0.3, { min: 0, max: 1.5, description: '샘플링 온도' }),
      key('runtime.maxOutputTokens', 'INTEGER', 1024, { min: 128, max: 4096, description: '출력 토큰 상한' }),
      key('runtime.systemFirst', 'BOOLEAN', true, { editability: 'READ_ONLY', description: '첫 메시지 system 강제(프롬프트 주입 방지) — 코드 고정' }),
      key('runtime.allowedTasks', 'JSON', ['wordEnrich', 'distractorGen', 'chatReviewFallback'], {
        consumer: 'APP',
        consoleEdit: false,
        description: '이 연결이 맡을 수 있는 AI 지점. 회화·채팅 턴은 어떤 설정으로도 불가 — 콘솔 편집 보류(금지 작업을 막는 검증 규칙 전, task-012c R3)',
      }),
      LOG_LEVEL_KEY,
    ],
  }),
  async healthCheck(profile) {
    const problem = homeM4TargetProblem(profile.values['connection.baseUrl'])
    if (problem) return { ok: false, status: 'MISCONFIGURED', latencyMs: null, detail: { errorCode: problem, message: TARGET_MESSAGE[problem] } }
    const out = await probeHttpHealth(profile.values['connection.baseUrl'])
    if (!out.ok) return out
    const ref = profile.values['connection.credentialRef']
    const cred = checkCredentialRef(HOME_M4_ALLOWED_REFS, typeof ref === 'string' ? ref : null, { checkExists: true })
    if (!cred.ok && cred.problem !== 'MISSING') {
      return { ok: false, status: 'MISCONFIGURED', latencyMs: out.latencyMs, detail: { ...out.detail, errorCode: 'REF_NOT_ALLOWED', message: '이 연결에 허용되지 않은 자격증명 참조(credentialRef)입니다' } }
    }
    if (!cred.ok || typeof ref !== 'string') {
      return { ok: false, status: 'MISCONFIGURED', latencyMs: out.latencyMs, detail: { ...out.detail, errorCode: 'CREDENTIAL_MISSING', message: '자격증명(credentialRef)이 가리키는 값이 설정돼 있지 않습니다' } }
    }
    return out
  },
  modelSummary: (values) => (typeof values['runtime.model'] === 'string' ? (values['runtime.model'] as string) : null),
  sourceCodeLayer: () => ({
    'runtime.systemFirst': { value: true, sourceRef: `code:${SRC}#assertSystemFirst` },
  }),
}
