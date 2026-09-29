/**
 * Rollback 재검증(configuration-resolution §6-3, task-012c D-C6 — 발음 사전 Codex C2 교훈): 되돌릴 스냅샷을 **지금의 쓰기 규칙으로** 다시 본다.
 *
 * - 모양이 깨졌으면 MALFORMED · 값이 지금 규칙(타입·범위·enum·편집성·SECRET 평문·ref 허용 목록·주소 허용 목록)을 어기면 INVALID_ENTRIES →
 *   호출자는 `422 E_SNAPSHOT_INTEGRITY`(쓰기 0). 조용히 버리지 않는다.
 * - 버리는 것은 지금 스키마에 없는 키뿐(`droppedKeys` 경고).
 * - 스냅샷에 없는 키: 스냅샷이 **지금과 같은 스키마 버전**이면 "그때는 기본값이었다" → 지금 행에 값이 있으면 스키마 기본값으로 되돌린다
 *   (`absentAsDefault`). 스키마 버전이 다르면(그 뒤에 생긴 키일 수 있다) 지금 저장값을 그대로 둔다.
 * - 목록 화면용 `snapshotIntegrity` 는 동기 검사(주소는 IP 리터럴·신뢰 origin 만 — 이름 해석은 되돌리기 시점의 비동기 검사에서).
 */
import { checkOutboundUrl } from '@/modules/infra'
import { trustedServiceOrigins } from '../adapters/common/targetPolicy'
import type { EditKeyDef } from './keys'
import { checkEditValue, checkSecretRefValue, sameValue, validatePatch, type ValidateHooks, type ValidationIssue } from './validate'

export type Integrity = 'OK' | 'MALFORMED' | 'INVALID_ENTRIES'

export interface IntegrityResult {
  integrity: Integrity
  issues: ValidationIssue[]
}

const MAX_ISSUES = 50

/** 스냅샷 값 자체가 지금 스키마의 값 규칙을 지키는가(편집성·저장값과의 차이는 보지 않는다). */
export function snapshotValueIssues(defs: readonly EditKeyDef[], snapshotFlat: Readonly<Record<string, unknown>>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const trusted = trustedServiceOrigins()
  for (const def of defs) {
    if (!Object.prototype.hasOwnProperty.call(snapshotFlat, def.key)) continue
    const v = snapshotFlat[def.key]
    if (def.type === 'SECRET_REF') issues.push(...checkSecretRefValue(def, v, false))
    else {
      const t = checkEditValue(def, v)
      issues.push(...t)
      if (t.length === 0 && def.type === 'URL' && typeof v === 'string') {
        const c = checkOutboundUrl(v, trusted)
        if (!c.ok) issues.push({ key: def.key, rule: 'hostNotAllowed', message: '허용되지 않은 연결 주소입니다.', related: [c.reason] })
      }
    }
    if (issues.length >= MAX_ISSUES) break
  }
  return issues.slice(0, MAX_ISSUES)
}

export function snapshotIntegrity(parsed: { ok: boolean }, defs: readonly EditKeyDef[], snapshotFlat: Readonly<Record<string, unknown>> | null): IntegrityResult {
  if (!parsed.ok || !snapshotFlat) return { integrity: 'MALFORMED', issues: [] }
  const issues = snapshotValueIssues(defs, snapshotFlat)
  return { integrity: issues.length ? 'INVALID_ENTRIES' : 'OK', issues }
}

/** 스냅샷에 없고 지금 행에는 있는 키를 스키마 기본값으로 채운 평면(같은 스키마 버전 스냅샷 전용). */
export function fillAbsentDefaults(defs: readonly EditKeyDef[], current: Readonly<Record<string, unknown>>, snapshotFlat: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...snapshotFlat }
  for (const d of defs) {
    if (!Object.prototype.hasOwnProperty.call(snapshotFlat, d.key) && Object.prototype.hasOwnProperty.call(current, d.key)) out[d.key] = d.default
  }
  return out
}

export interface RestorePlan extends IntegrityResult {
  droppedKeys: string[]
  /** 되돌린 뒤의 저장값(평면). */
  candidate: Record<string, unknown>
  /** 지금 저장값과 달라지는 키. */
  changedKeys: string[]
}

/** 되돌리기 계획: 스냅샷의 스키마 키 값을 지금 저장값에 겹치고, 바뀌는 키를 지금 쓰기 규칙으로 재검증한다. */
export async function planRestore(
  defs: readonly EditKeyDef[],
  current: Readonly<Record<string, unknown>>,
  rawSnapshotFlat: Readonly<Record<string, unknown>>,
  hooks: ValidateHooks = {},
  opts: { absentAsDefault?: boolean } = {},
): Promise<RestorePlan> {
  const snapshotFlat = opts.absentAsDefault ? fillAbsentDefaults(defs, current, rawSnapshotFlat) : rawSnapshotFlat
  const defKeys = new Set(defs.map((d) => d.key))
  const droppedKeys = Object.keys(snapshotFlat).filter((k) => !defKeys.has(k) && !sameValue(snapshotFlat[k], current[k]))
  const patch: Record<string, unknown> = {}
  for (const k of defKeys) if (Object.prototype.hasOwnProperty.call(snapshotFlat, k) && !sameValue(snapshotFlat[k], current[k])) patch[k] = snapshotFlat[k]
  const valueIssues = snapshotValueIssues(defs, snapshotFlat)
  const v = await validatePatch(defs, current, patch, hooks)
  const issues = [...valueIssues, ...v.errors.filter((e) => !valueIssues.some((x) => x.key === e.key && x.rule === e.rule))].slice(0, MAX_ISSUES)
  return {
    integrity: issues.length ? 'INVALID_ENTRIES' : 'OK',
    issues,
    droppedKeys,
    candidate: { ...current, ...patch },
    changedKeys: Object.keys(patch),
  }
}
