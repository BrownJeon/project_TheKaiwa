/**
 * 대시보드(#80)·환경(#81) 조합 — engine(연결·정책·Health·Trace)·speech(Voice 개수)·preferences(AppSetting 정책 키)를 admin 이 모은다.
 * 역할별 "활성 connection" = Router 와 같은 규칙의 첫 후보(없으면 정책 primary). 모델 요약은 Effective 값으로 어댑터가 만든다.
 */
import { getAppSetting } from '@/modules/preferences'
import { countVoicesByStatus } from '@/modules/speech'
import { configActivity, effectiveValues, getProvider, listFallbackPolicies, recentHealth, resolveEffective, turnStats24h, type EngineConnectionRow } from '@/modules/engine'
import type { Environment } from '@prisma/client'
import type { AdminEnvironment, EngineRoleName, EnvironmentDto, OverviewDto, OverviewRoleDto } from '@/types/admin'
import pkg from '../../../../package.json'
import { healthDto } from '../present'

const ROLE_ORDER: EngineRoleName[] = ['REALTIME_STT', 'ANALYSIS_STT', 'TTS', 'LLM']

async function effectiveOf(c: EngineConnectionRow): Promise<Record<string, unknown>> {
  try {
    return effectiveValues(await resolveEffective({ environment: c.environment, scope: 'ENGINE_CONNECTION', targetId: c.id }))
  } catch {
    return {}
  }
}

export async function getOverview(environment: Environment): Promise<OverviewDto> {
  const [policies, voices, activity, traces, health] = await Promise.all([
    listFallbackPolicies(environment),
    countVoicesByStatus(),
    configActivity(environment),
    turnStats24h(environment),
    recentHealth(environment, 10),
  ])
  let llm: OverviewDto['llm'] = null
  const roles: OverviewRoleDto[] = []
  for (const role of ROLE_ORDER) {
    const v = policies.find((p) => p.policy.role === role)
    const active = v ? (v.effectiveOrder[0] ?? v.primary) : null
    const provider = active ? getProvider(active.engineId) : null
    const values = active ? await effectiveOf(active) : {}
    roles.push({
      role,
      engine: provider ? { id: provider.descriptor.id, displayName: provider.descriptor.displayName } : active ? { id: active.engineId, displayName: active.engineId } : null,
      connection: active ? { id: active.id, key: active.key, name: active.name } : null,
      status: active?.status ?? null,
      statusReason: active?.statusReason ?? null,
      lastHealthAt: active?.lastHealthAt?.toISOString() ?? null,
      fallbacks: v?.fallbacks.length ?? 0,
      configVersion: null,
      model: provider ? provider.modelSummary(values) : null,
    })
    if (role === 'LLM' && active) {
      const tiers: Record<string, string> = {}
      for (const [k, val] of Object.entries(values)) {
        const m = /^runtime\.modelByTier\.(\w+)$/.exec(k)
        if (m && typeof val === 'string') tiers[m[1]] = val
      }
      llm = { connection: { id: active.id, key: active.key, name: active.name }, tiers, status: active.status }
    }
  }
  const n = (s: string) => voices[s] ?? 0
  return {
    environment: environment as AdminEnvironment,
    roles,
    voices: { total: Object.values(voices).reduce((a, b) => a + b, 0), available: n('AVAILABLE'), disabled: n('DISABLED'), importing: n('IMPORTING') + n('VALIDATING'), error: n('ERROR') },
    llm,
    config: { latestVersionAt: activity.latestVersionAt?.toISOString() ?? null, activeOverrides: activity.activeOverrides, pendingProductionApprovals: 0 },
    traces24h: traces,
    recentHealth: health.map((h) => healthDto(h, h.connection.key)),
    generatedAt: new Date().toISOString(),
  }
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

export async function getEnvironmentInfo(environment: Environment): Promise<EnvironmentDto> {
  const [overrideEnabled, debugMax, logMax, audioDays, traceDays, activity] = await Promise.all([
    getAppSetting<unknown>('override.production.enabled', false),
    getAppSetting<unknown>('debug.production.maxTtlMinutes', 60),
    getAppSetting<unknown>('loglevel.production.maxLevel', 'INFO'),
    getAppSetting<unknown>('speech.audio.retentionDays', 30),
    getAppSetting<unknown>('trace.retentionDays', 90),
    configActivity(environment),
  ])
  return {
    environment: environment as AdminEnvironment,
    isProduction: environment === 'PRODUCTION',
    appVersion: typeof pkg.version === 'string' ? pkg.version : '0.0.0',
    nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    protection: {
      strictKeys: ['Engine', 'Model', 'Connection', 'Credential', 'Fallback'],
      overrideEnabled: overrideEnabled === true,
      debugMaxTtlMinutes: num(debugMax, 60),
      loglevelMaxLevel: typeof logMax === 'string' && /^[A-Z]{3,5}$/.test(logMax) ? logMax : 'INFO',
      audioRetentionDays: num(audioDays, 30),
      traceRetentionDays: num(traceDays, 90),
    },
    activeOverrides: activity.activeOverrides,
    services: null,
  }
}
