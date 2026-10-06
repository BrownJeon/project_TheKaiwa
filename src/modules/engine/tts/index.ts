/**
 * TTS 역할 파사드(module-dependency L5 `tts.synthesize`) — L4 `speech/tts` 는 이것만 부른다. 어댑터·엔진명은 이 아래에만.
 *
 *   targets()             : TTS 폴백 정책 순서의 connection 목록(**UNAVAILABLE 포함**) — 캐시 키의 connection 요소와
 *                           상태등 판정(§12)이 "지금 쓸 수 없는 연결" 도 알아야 해서 Router(가용만)와 따로 둔다. DISABLED·enabled=false 제외.
 *   synthesize(target, …) : 그 connection 의 Effective 설정으로 어댑터 호출(30초 메모리 캐시).
 *   maxChars(target)      : 세그먼트 글자 수 상한.
 *   g2p(target, …)        : 엔진이 실제로 읽을 읽기·악센트(발음 사전 미리듣기, task-003g). 어댑터에 없으면 MISCONFIGURED(NO_G2P).
 */
import type { EngineConnection, EngineStatus } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { profileOf } from '../health'
import { getProvider } from '../registry'
import type { ConnectionProfile, TtsG2pOutput, TtsLexiconHint, TtsSegmentInput, TtsSynthOutput, TtsVoiceRef } from '../registry/types'
import { currentEnvironment } from '../router'
import { TtsEngineError } from './errors'

export { TtsEngineError, isTtsEngineError } from './errors'
export type { TtsFailureKind } from './errors'
export type { TtsSegmentInput, TtsSynthOutput, TtsVoiceRef, TtsLexiconHint, TtsSynthMetrics, TtsG2pOutput, TtsTimingOutput, TtsTimingWord } from '../registry/types'
// 단어 timing 공용 규칙(task-012b-4) — 어댑터와 L4 가 같은 검사·좌표 되돌리기를 쓴다.
export { checkTimingWords, projectTimingWords, identityUnitMap, codePointOffsets, TIMING_MAX_WORDS } from './timing'
export type { TextUnitMap } from './timing'

export interface TtsTarget {
  id: string
  key: string
  engineId: string
  status: EngineStatus
  lastHealthAt: Date | null
}

const TARGET_CACHE_MS = 5_000
const PROFILE_CACHE_MS = 30_000
let targetCache: { at: number; env: string; list: TtsTarget[] } | null = null
const profileCache = new Map<string, { at: number; updatedAt: number; profile: ConnectionProfile }>()

export async function targets(): Promise<TtsTarget[]> {
  const env = currentEnvironment()
  if (targetCache && targetCache.env === env && Date.now() - targetCache.at < TARGET_CACHE_MS) return targetCache.list
  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment: env, role: 'TTS' } } })
  let list: TtsTarget[] = []
  if (policy?.enabled) {
    const ids = [policy.primaryConnectionId, ...((policy.fallbackConnectionIds as string[] | null) ?? [])]
    const rows = await prisma.engineConnection.findMany({ where: { environment: env, role: 'TTS', enabled: true, id: { in: ids } } })
    const byId = new Map(rows.map((r) => [r.id, r]))
    list = ids
      .map((id) => byId.get(id))
      .filter((r): r is EngineConnection => !!r && r.status !== 'DISABLED')
      .map((r) => ({ id: r.id, key: r.key, engineId: r.engineId, status: r.status, lastHealthAt: r.lastHealthAt }))
  }
  targetCache = { at: Date.now(), env, list }
  return list
}

/** Health 결과가 connection 상태를 바꾼 직후 부른다(다음 판정이 5초를 기다리지 않게). */
export function clearTargetCache(): void {
  targetCache = null
}

async function profileFor(target: TtsTarget): Promise<ConnectionProfile> {
  const row = await prisma.engineConnection.findUnique({ where: { id: target.id } })
  if (!row) throw new TtsEngineError('MISCONFIGURED', 'CONNECTION_GONE')
  const hit = profileCache.get(row.id)
  const updatedAt = row.updatedAt.getTime()
  if (hit && hit.updatedAt === updatedAt && Date.now() - hit.at < PROFILE_CACHE_MS) return hit.profile
  const profile = await profileOf(row)
  profileCache.set(row.id, { at: Date.now(), updatedAt, profile })
  return profile
}

function adapterOf(target: TtsTarget) {
  const adapter = getProvider(target.engineId)?.tts
  if (!adapter) throw new TtsEngineError('MISCONFIGURED', 'NO_TTS_ADAPTER')
  return adapter
}

export async function maxChars(target: TtsTarget): Promise<number> {
  return adapterOf(target).maxChars((await profileFor(target)).values)
}

export async function synthesize(target: TtsTarget, voice: TtsVoiceRef, segment: TtsSegmentInput, opts: { traceId: string; timeoutMs: number }): Promise<TtsSynthOutput> {
  const adapter = adapterOf(target)
  return adapter.synthesize(await profileFor(target), voice, segment, opts)
}

export async function g2p(target: TtsTarget, text: string, hints: readonly TtsLexiconHint[], opts: { timeoutMs: number }): Promise<TtsG2pOutput> {
  const adapter = adapterOf(target)
  if (!adapter.g2p) throw new TtsEngineError('MISCONFIGURED', 'NO_G2P')
  return adapter.g2p(await profileFor(target), text, hints, opts)
}
