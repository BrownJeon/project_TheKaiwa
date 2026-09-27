'use client'

/**
 * 발음 사전 쓰기 권한 4갈래(screens.md §10-1). **숨김용**이다 — 서버가 매 요청 다시 검사한다.
 *   voices.read 만 → 보기 전용(쓰기·미리듣기 DOM 없음) · voices.manage → 쓰기·미리듣기 ·
 *   PRODUCTION + config.apply.production 없음 → 보기 + 미리듣기 · PRODUCTION + SUPER_ADMIN → 쓰기 + 확인 문구.
 */
import type { AdminEnvironment, Capability } from '@/types/admin'
import { useCan, useConsoleEnv } from '../console/ConsoleProvider'
import type { AccessNote } from './lexiconCopy'

export interface LexiconAccess {
  canManage: boolean
  canWrite: boolean
  canPreview: boolean
  needsConfirm: boolean
  env: AdminEnvironment
  note: AccessNote | null
}

export function lexiconAccess(can: (cap: Capability) => boolean, env: AdminEnvironment): LexiconAccess {
  const canManage = can('voices.manage')
  const canWrite = canManage && (env !== 'PRODUCTION' || can('config.apply.production'))
  const note: AccessNote | null = !canManage ? 'READ_ONLY' : !canWrite ? 'PROD_SUPER_ONLY' : env === 'PRODUCTION' ? 'PROD_WARN' : null
  return { canManage, canWrite, canPreview: canManage, needsConfirm: canWrite && env === 'PRODUCTION', env, note }
}

export function useLexiconAccess(): LexiconAccess {
  return lexiconAccess(useCan(), useConsoleEnv())
}
