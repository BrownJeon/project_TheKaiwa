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
