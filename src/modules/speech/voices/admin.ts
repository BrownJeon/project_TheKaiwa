/**
 * 관리자 Voice 조회(api-contract #82·#82a, task-005b) — 상태 무관 전체 + 모델·스타일. 읽기 전용(편집·활성화는 Phase 2).
 * VoiceProfile·VoiceModel·VoiceStyle 은 speech 소유 테이블이라 admin 은 이 함수로만 읽는다. 사용자 수 집계는 preferences 가 한다(admin 이 조합).
 */
import { prisma } from '@/modules/infra'
import type { VoiceStatus } from '@prisma/client'

const SELECT = {
  id: true,
  displayName: true,
  description: true,
  status: true,
  statusReason: true,
  enabled: true,
  sortOrder: true,
  ttsEngineId: true,
  speaker: true,
  speakerId: true,
  defaults: true,
  previewPath: true,
  updatedAt: true,
  styles: { orderBy: { sortOrder: 'asc' as const }, select: { name: true, label: true, styleWeightDefault: true } },
  model: { select: { id: true, status: true, version: true, speakers: true, styles: true } },
} as const

export async function listVoicesForAdmin(opts: { status?: VoiceStatus; includeArchived?: boolean } = {}) {
  return prisma.voiceProfile.findMany({
    where: opts.status ? { status: opts.status } : opts.includeArchived ? {} : { status: { not: 'ARCHIVED' } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: SELECT,
  })
}

export async function getVoiceForAdmin(id: string) {
  if (!id || id.length > 80) return null
  return prisma.voiceProfile.findUnique({ where: { id }, select: SELECT })
}

/** 대시보드 상태별 개수. */
export async function countVoicesByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.voiceProfile.groupBy({ by: ['status'], _count: { _all: true } })
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]))
}

export type AdminVoiceRow = NonNullable<Awaited<ReturnType<typeof getVoiceForAdmin>>>
