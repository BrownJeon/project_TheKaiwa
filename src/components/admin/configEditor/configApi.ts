/**
 * 설정 편집 요청 함수(task-012c, api-contract §2-21·§2-23·#123b·#137) — 경로·본문 모양을 이 파일 한 곳에 둔다. DTO 는 서버와 공유하는 `@/types/admin`.
 * 경로의 id 는 `encodeURIComponent`. 이유·확인 문구·해시는 늘 본문으로(URL = 접근 로그). 비밀 값은 어떤 본문에도 없다(credentialRef 는 이름만).
 */
import { apiPost, apiPut } from '@/components/common/api'
import type {
  ConfigApplyResultDto,
  ConfigDiffDto,
  ConfigEditScopeName,
  ConfigRollbackResultDto,
  ConfigTestDto,
  ConfigValidateDto,
} from '@/types/admin'

const BASE = '/api/admin/v1'
const enc = encodeURIComponent

/** 쓰기 공통 꼬리 — 운영이면 confirm·summaryHash·testResultId 를 함께. */
export interface WriteMeta {
  baseVersion: number
  reason: string
  confirm?: string
  summaryHash?: string
  testResultId?: string
}

/** 후보: 평면 patch 또는 되돌릴 버전(#105·#106 의 versionId). */
export type Candidate = { patch: Record<string, unknown> } | { versionId: string }

export interface TargetRef {
  scope: ConfigEditScopeName
  targetId: string
}

export const effectivePath = (scope: 'ENGINE_CONNECTION' | 'FALLBACK_POLICY', targetId: string) => `${BASE}/config/effective?scope=${scope}&targetId=${enc(targetId)}`
export const rawPath = (t: TargetRef) => `${BASE}/config/raw/${t.scope}/${enc(t.targetId)}`
export const appSettingPath = (key: string) => `${BASE}/app-settings/${enc(key)}`

export const validate = (t: TargetRef, patch: Record<string, unknown>) => apiPost<ConfigValidateDto>(`${BASE}/config/validate`, { ...t, patch })
export const test = (t: TargetRef, c: Candidate, opts?: { signal?: AbortSignal }) => apiPost<ConfigTestDto>(`${BASE}/config/test`, { ...t, ...c }, opts)
export const diff = (t: TargetRef, c: Candidate) => apiPost<ConfigDiffDto>(`${BASE}/config/diff`, { ...t, ...c })

/** #107 Form 적용(config.edit). */
export const apply = (t: TargetRef, patch: Record<string, unknown>, meta: WriteMeta) => apiPost<ConfigApplyResultDto>(`${BASE}/config/apply`, { ...t, patch, ...meta })

/** #111 Raw JSON 적용(config.edit + config.raw.read) — 문서 글 그대로(서버가 같은 규칙으로 읽는다). */
export const applyRaw = (t: TargetRef, jsonText: string, meta: WriteMeta) => apiPut<ConfigApplyResultDto>(rawPath(t), { json: jsonText, dryRun: false, ...meta })

/** #93 연결 Form 편집(engine.connections.manage). */
export const updateConnection = (id: string, body: { connection?: Record<string, unknown>; runtime?: Record<string, unknown>; enabled?: unknown }, meta: WriteMeta) =>
  apiPut<ConfigApplyResultDto>(`${BASE}/engine-connections/${enc(id)}`, { ...body, ...meta })

/** #93a 켜기·끄기. */
export const setEnabled = (id: string, enabled: boolean, meta: WriteMeta) => apiPut<ConfigApplyResultDto>(`${BASE}/engine-connections/${enc(id)}/enabled`, { enabled, ...meta })

/** #93b 비밀 참조 연결·해제(SUPER_ADMIN). `credentialRef` 는 참조 이름 또는 null — 값은 없다. */
export const setCredential = (id: string, credentialRef: string | null, meta: WriteMeta) =>
  apiPut<ConfigApplyResultDto>(`${BASE}/engine-connections/${enc(id)}/credential`, { credentialRef, ...meta })

/** #100 예비 순서. */
export const updateFallback = (role: string, body: { primaryConnectionId?: string; fallbackConnectionIds?: string[]; enabled?: boolean }, meta: WriteMeta) =>
  apiPut<ConfigApplyResultDto>(`${BASE}/fallback-policies/${enc(role)}`, { ...body, ...meta })

/** #123b 운영 설정. */
export const putAppSetting = (key: string, value: unknown, meta: WriteMeta) => apiPut<ConfigApplyResultDto>(appSettingPath(key), { value, ...meta })

// ── 이력(#108·#108a·#109·#137) ──────────────────────────────────────────────

export const versionsPath = (q: { scope?: ConfigEditScopeName | null; targetId?: string | null; status?: 'ACTIVE' | null; cursor?: string | null; limit?: number }) => {
  const u = new URLSearchParams()
  if (q.scope) u.set('scope', q.scope)
  if (q.targetId) u.set('targetId', q.targetId)
  if (q.status) u.set('status', q.status)
  if (q.cursor) u.set('cursor', q.cursor)
  u.set('limit', String(q.limit ?? 20))
  return `${BASE}/config/versions?${u.toString()}`
}

export const versionPath = (id: string, compare: 'previous' | 'active') => `${BASE}/config/versions/${enc(id)}?compare=${compare}`

export const rollback = (versionId: string, meta: WriteMeta) => apiPost<ConfigRollbackResultDto>(`${BASE}/config/versions/${enc(versionId)}/rollback`, meta)

/** 쓰기 꼬리 만들기 — 운영이면 확인 문구·요약 해시·(필요할 때) 테스트 결과 id. */
export function writeMeta(o: { baseVersion: number; reason: string; production: boolean; confirm: string; summaryHash?: string | null; testResultId?: string | null }): WriteMeta {
  const m: WriteMeta = { baseVersion: o.baseVersion, reason: o.reason }
  if (o.production) {
    m.confirm = o.confirm.trim()
    if (o.summaryHash) m.summaryHash = o.summaryHash
  }
  if (o.testResultId) m.testResultId = o.testResultId
  return m
}
