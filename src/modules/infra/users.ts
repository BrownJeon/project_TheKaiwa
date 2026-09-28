/**
 * `User`(infra 소유 테이블) 읽기 도우미 — 다른 층이 사용자 id 를 참조로 받을 때(발음 사전 USER 범위·버전 작업자 표시, task-003g).
 * 이메일·OAuth 정보는 돌려주지 않는다(이름·역할만).
 */
import type { Role } from '@prisma/client'
import { prisma } from './db'

export async function userExists(userId: string): Promise<boolean> {
  if (!userId || userId.length > 40) return false
  return (await prisma.user.count({ where: { id: userId } })) > 0
}

/** 작업자 표시용 이름·역할(없는 id 는 빠진다). */
export async function userBriefs(userIds: readonly string[]): Promise<Map<string, { name: string | null; role: Role }>> {
  const ids = [...new Set(userIds.filter((id) => id && id.length <= 40))]
  if (ids.length === 0) return new Map()
  const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } })
  return new Map(rows.map((r) => [r.id, { name: r.name, role: r.role }]))
}

/** QA 계정 판정(qa-session.ts 와 같은 규칙) — provider `test` + `@thekaiwa.test`. 실사용자는 Google 이라 여기 걸리지 않는다. */
export const QA_USER_WHERE = { provider: 'test', email: { endsWith: '@thekaiwa.test' } } as const

const QA_CACHE_MS = 60_000
let qaCache: { at: number; ids: string[] } | null = null

/**
 * QA 계정 id 목록(60초 캐시) — 개발·운영이 같은 DB 를 쓰므로 비운영 프로세스가 **QA 데이터만** 건드리게 거를 때 쓴다(task-012b D-B11).
 * 이메일은 돌려주지 않는다.
 */
export async function listQaUserIds(now = Date.now()): Promise<string[]> {
  if (qaCache && now - qaCache.at < QA_CACHE_MS) return qaCache.ids
  const rows = await prisma.user.findMany({ where: QA_USER_WHERE, select: { id: true }, take: 50 })
  qaCache = { at: now, ids: rows.map((r) => r.id) }
  return qaCache.ids
}
