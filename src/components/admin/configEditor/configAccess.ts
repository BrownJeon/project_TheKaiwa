/**
 * 설정 편집 권한 갈래(task-012c, role-permission §3·§6, 데모 v2 "권한 없는 버튼은 비활성이 아니라 그리지 않아요"). **숨김용**이다 — 서버가 매 요청 다시 검사한다.
 *   읽기 전용(config.effective.read 만) · Form 쓰기(ADMIN: config.edit) · Form + Raw JSON(DEVELOPER: + config.raw.read) ·
 *   PRODUCTION 비 SUPER_ADMIN = 초안·변경 요약까지(적용 단계 🔒) · PRODUCTION SUPER_ADMIN = 확인 창(PRODUCTION 입력).
 * 비밀 참조 연결은 SUPER_ADMIN(credentials.manage)만. 순수 함수라 역할별 단위 테스트를 한다(발음 사전 `lexiconAccess` 와 같은 방식).
 */
import type { AdminEnvironment, Capability } from '@/types/admin'

export type ConfigAccessNote = 'READ_ONLY' | 'PROD_SUPER_ONLY' | 'PROD_WARN' | null

export interface ConfigAccess {
  env: AdminEnvironment
  production: boolean
  /** Form 입력칸·적용 막대(검증·요약까지). */
  canEdit: boolean
  /** Raw JSON 탭 보기. */
  canRaw: boolean
  /** Raw JSON 편집 켜기. */
  canRawEdit: boolean
  /** 기능 테스트 버튼. */
  canTest: boolean
  /** 적용 단계까지(운영은 최고관리자만). */
  canApply: boolean
  /** 운영 확인 창(PRODUCTION 입력)이 필요한가. */
  needsConfirm: boolean
  /** 연결 상세 편집·사용 여부·예비 순서 편집(engine.connections.manage). */
  canManageConn: boolean
  /** 연결·예비 순서를 이 환경에 실제로 적용할 수 있는가. */
  canApplyConn: boolean
  /** 비밀 참조 연결·해제(credentials.manage = SUPER_ADMIN). */
  canCredential: boolean
  /** [있는지 확인] — 비밀 참조 목록(감사 1행). */
  canSecretsRead: boolean
  /** 되돌리기 버튼(운영은 최고관리자만). */
  canRollback: boolean
  /** 운영이라 되돌리기는 안 되지만 config.rollback 은 있는 사람 — 버튼 대신 안내 한 줄. */
  rollbackProdOnly: boolean
  canTrace: boolean
  canAudit: boolean
  /** 다른 환경 기록 보기(감사 환경 필터). */
  canOtherEnv: boolean
  note: ConfigAccessNote
}

export function configAccess(can: (cap: Capability) => boolean, env: AdminEnvironment): ConfigAccess {
  const production = env === 'PRODUCTION'
  const superApply = can('config.apply.production')
  const prodOk = !production || superApply
  const canEdit = can('config.edit')
  const canApply = canEdit && prodOk
  const canManageConn = can('engine.connections.manage')
  const note: ConfigAccessNote = !canEdit ? 'READ_ONLY' : !canApply ? 'PROD_SUPER_ONLY' : production ? 'PROD_WARN' : null
  return {
    env,
    production,
    canEdit,
    canRaw: can('config.raw.read'),
    canRawEdit: can('config.raw.read') && canEdit,
    canTest: can('functional_test.run'),
    canApply,
    needsConfirm: canApply && production,
    canManageConn,
    canApplyConn: canManageConn && prodOk,
    canCredential: can('credentials.manage'),
    canSecretsRead: can('secrets.read_ref'),
    canRollback: can('config.rollback') && prodOk,
    rollbackProdOnly: can('config.rollback') && !prodOk,
    canTrace: can('trace.read'),
    canAudit: can('audit.read'),
    canOtherEnv: can('environment.policy'),
    note,
  }
}

export type ConfigTab = 'effective' | 'form' | 'raw' | 'diff'

/** 설정 화면 탭(데모 v2): Effective · Form(config.edit) · Raw JSON(config.raw.read) · Diff(config.edit). ADMIN 에게 Raw JSON 탭은 없다. */
export function configTabs(a: Pick<ConfigAccess, 'canEdit' | 'canRaw'>): ConfigTab[] {
  const t: ConfigTab[] = ['effective']
  if (a.canEdit) t.push('form')
  if (a.canRaw) t.push('raw')
  if (a.canEdit) t.push('diff')
  return t
}

export function pickTab(requested: string | null | undefined, allowed: readonly ConfigTab[]): ConfigTab {
  const r = (requested ?? '') as ConfigTab
  if (allowed.includes(r)) return r
  return allowed.includes('form') ? 'form' : 'effective'
}
