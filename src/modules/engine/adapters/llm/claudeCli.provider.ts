/**
 * claude-cli Engine Provider(descriptor·schema·health) — 실제 호출은 `claudeCli.ts`·`engine/llm`.
 * 스키마 키는 **실제 저장 모양**(prisma/seed-data/engines.json `claude-cli-local`)을 따른다: `connection.binPath`·`runtime.modelByTier.*`.
 * 정본 예시(configuration-resolution §5-2 `connection.bin`·`runtime.tiers.*`)와 이름이 다른 것은 seed·런타임(`engine/llm` 의 modelByTier)이
 * 이미 이 이름을 쓰기 때문이다(task-005b 정본 차이 기록).
 */
import type { EngineProvider } from '../../registry/types'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'
import { probeClaudeCliVersion } from './claudeCli'

const SRC = `${REPO_ADAPTERS}/llm/claudeCli.ts`

export const claudeCliProvider: EngineProvider = {
  descriptor: {
    id: 'claude-cli',
    displayName: 'Claude CLI (구독)',
    type: 'LLM',
    roles: ['LLM'],
    connectionTypes: ['CLI'],
    capabilities: ['JSON_SCHEMA', 'STREAMING', 'PERSONA_AGENTS', 'MODEL_TIERS'],
    schemaVersion: 1,
    pluginVersion: '0.1.0',
    providerClass: 'ClaudeCliProvider',
    sourcePath: SRC,
  },
  configurationSchema: () => ({
    engineId: 'claude-cli',
    schemaVersion: 1,
    groups: SCHEMA_GROUPS,
    keys: [
      key('connection.binPath', 'PATH', 'claude', {
        editability: 'RESTART_REQUIRED',
        restartTarget: 'app',
        strict: true,
        envAlias: ['CLAUDE_CLI_PATH'],
        description: 'CLI 실행 파일(argv[0]). 런타임은 서버 env CLAUDE_CLI_PATH 만 spawn 한다',
      }),
      key('connection.timeoutMs', 'INTEGER', 60000, {
        min: 10000,
        max: 300000,
        envAlias: ['LLM_TIMEOUT_MS'],
        description: '기본 상한. AI 지점별 상한(A1 12s 등)은 코드 상수(engine/router/tasks)가 정한다',
      }),
      key('connection.authMode', 'ENUM', 'SUBSCRIPTION', { enum: ['SUBSCRIPTION'], editability: 'REDEPLOY_REQUIRED', description: '서버 구독 로그인 — API 키·credentialRef 없음' }),
      key('runtime.modelByTier.fast', 'STRING', 'haiku', { strict: true, consumer: 'APP', verify: 'LLM_PROBE_FAST', pattern: '^[A-Za-z0-9._:-]{1,60}$', description: 'tier fast(회화·채팅·단어 보강) → --model 값', impact: '회화 턴 지연·구독 사용량' }),
      key('runtime.modelByTier.balanced', 'STRING', 'sonnet', { strict: true, consumer: 'APP', verify: 'LLM_PROBE_BALANCED', pattern: '^[A-Za-z0-9._:-]{1,60}$', description: 'tier balanced(점검·레슨·평가) → --model 값' }),
      key('runtime.modelByTier.deep', 'STRING', 'opus', { strict: true, consumer: 'APP', verify: 'LLM_PROBE_DEEP', pattern: '^[A-Za-z0-9._:-]{1,60}$', description: 'tier deep(분석) → --model 값' }),
      key('runtime.concurrency', 'INTEGER', 1, {
        min: 1,
        max: 4,
        editability: 'RESTART_REQUIRED',
        restartTarget: 'app',
        envAlias: ['CLAUDE_CLI_CONCURRENCY'],
        description: '동시 실행 수(구독 rate limit 을 6개 프로젝트가 공유)',
      }),
      key('runtime.interactiveLane', 'BOOLEAN', true, { editability: 'RESTART_REQUIRED', restartTarget: 'app', description: '대화형 요청을 배치보다 먼저 처리하는 레인' }),
      key('runtime.permissionMode', 'ENUM', 'dontAsk', { enum: ['dontAsk'], editability: 'READ_ONLY', description: '권한 모드 — 코드 고정(cwd 밖 읽기 거부)' }),
      key('runtime.tools', 'STRING', '', { editability: 'READ_ONLY', description: '허용 도구 — 코드 고정(빈 목록: 텍스트 생성만)' }),
      key('runtime.agentsFile', 'PATH', '.claude/agents/tutor.md', { editability: 'READ_ONLY', description: '강사 페르소나 파일(내용 버전은 Prompt Registry, Phase 2)' }),
      key('runtime.jsonSchemaFlag', 'BOOLEAN', false, {
        envAlias: ['KAIWA_LLM_JSON_SCHEMA_FLAG'],
        consumer: 'APP',
        verify: 'LLM_PROBE_FAST',
        // engine/llm claudeShape 는 env 가 있으면 행 값보다 env 를 먼저 쓴다.
        runtimeEnvWins: ['KAIWA_LLM_JSON_SCHEMA_FLAG'],
        description: '--json-schema 사용(실측 +~1s). 기본은 프롬프트 스키마 + ajv' }),
      key('runtime.thinkingForDeep', 'BOOLEAN', false, { consumer: 'APP', verify: 'LLM_PROBE_DEEP', description: 'tier deep 에서만 extended thinking 허용' }),
      key('runtime.earlySentenceTts', 'BOOLEAN', true, {
        consumer: 'APP',
        verify: 'LLM_PROBE_STREAM',
        description: '회화 턴 첫 문장 조기 합성 — 생성 중인 응답에서 첫 문장을 먼저 꺼내 음성으로 만든다(안전 필터 통과 문장만). 끄면 응답 검증 뒤 합성',
        impact: '회화 첫 음성까지의 시간(TTFA)',
      }),
      key('runtime.prewarm', 'BOOLEAN', true, { consumer: 'APP', verify: 'NONE', description: '회화 방 진입·말하기 시작 때 CLI 프로세스를 미리 띄워 둔다(대기 중 토큰 사용 0, 프로세스당 1요청)', impact: '회화 턴 지연·서버 메모리' }),
      key('runtime.prewarmMaxIdle', 'INTEGER', 2, { min: 0, max: 4, consumer: 'APP', verify: 'NONE', description: '대기 프로세스 전체 상한(0 = 예열 끔). 1개 ≈ 서버 메모리 100~200MB' }),
      key('runtime.prewarmIdleTtlSec', 'INTEGER', 600, { min: 60, max: 3600, consumer: 'APP', verify: 'NONE', description: '대기 프로세스 유휴 수명(초). 지나면 내린다' }),
      LOG_LEVEL_KEY,
    ],
  }),
  async healthCheck() {
    const p = await probeClaudeCliVersion(5_000)
    if (p.ok) return { ok: true, status: 'HEALTHY', latencyMs: p.latencyMs, detail: p.version ? { version: p.version } : {} }
    const message =
      p.errorCode === 'NOT_FOUND' ? 'CLI 실행 파일을 찾을 수 없습니다' : p.errorCode === 'ETIMEDOUT' ? 'CLI 가 5초 안에 응답하지 않았습니다' : 'CLI 실행에 실패했습니다'
    return { ok: false, status: 'UNAVAILABLE', latencyMs: p.latencyMs, detail: { errorCode: p.errorCode ?? 'SPAWN_FAILED', message } }
  },
  modelSummary(values) {
    const tiers = ['fast', 'balanced', 'deep'].map((t) => [t, values[`runtime.modelByTier.${t}`]] as const).filter(([, v]) => typeof v === 'string')
    return tiers.length ? tiers.map(([t, v]) => `${t}=${v}`).join(' · ') : null
  },
  sourceCodeLayer: () => ({
    'runtime.permissionMode': { value: 'dontAsk', sourceRef: `code:${SRC}#buildClaudeArgs` },
    'runtime.tools': { value: '', sourceRef: `code:${SRC}#ALLOWED_TOOLS` },
    'runtime.concurrency': { value: 1, sourceRef: `code:${SRC}#pump` },
  }),
}
