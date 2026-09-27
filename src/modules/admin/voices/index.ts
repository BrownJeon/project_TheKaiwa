/**
 * #82·#82a Voice 목록·상세(읽기) — speech(VoiceProfile·Model·Style) + preferences(사용자 수)를 admin 이 조합한다.
 * 콘솔이라 모델·speaker 가 보인다(G6). defaults 는 마스킹을 거친다.
 */
import { ApiError } from '@/modules/infra'
import { countUsersByVoice } from '@/modules/preferences'
import { getVoiceForAdmin, listVoicesForAdmin, type AdminVoiceRow } from '@/modules/speech'
import type { VoiceStatus } from '@prisma/client'
import type { AdminVoiceDto } from '@/types/admin'
import { hiddenNotFound } from '../permissions/guard'
import { displayAny, displayJson } from '../present'

const STATUSES: readonly VoiceStatus[] = ['IMPORTING', 'VALIDATING', 'AVAILABLE', 'DISABLED', 'ERROR', 'DELETING', 'ARCHIVED']

function dto(v: AdminVoiceRow, users: number): AdminVoiceDto {
  return {
    id: v.id,
    displayName: v.displayName,
    description: v.description,
    status: v.status,
    statusReason: v.statusReason,
    enabled: v.enabled,
    sortOrder: v.sortOrder,
    ttsEngineId: v.ttsEngineId,
    speaker: v.speaker,
    speakerId: v.speakerId,
    defaults: displayJson(v.defaults),
    styles: v.styles,
    model: v.model ? { id: v.model.id, status: v.model.status, version: v.model.version, speakers: displayAny(v.model.speakers), styles: displayAny(v.model.styles) } : null,
    usage: { users },
    previewAvailable: Boolean(v.previewPath),
    updatedAt: v.updatedAt.toISOString(),
  }
}

export async function listVoiceDtos(q: { status?: string | null; includeArchived?: string | null }): Promise<AdminVoiceDto[]> {
  if (q.status && !STATUSES.includes(q.status as VoiceStatus)) throw new ApiError('VALIDATION', 'status 값이 올바르지 않습니다.', { field: 'status' })
  const rows = await listVoicesForAdmin({ status: (q.status as VoiceStatus) || undefined, includeArchived: q.includeArchived === '1' })
  const usage = await countUsersByVoice(rows.map((r) => r.id))
  return rows.map((r) => dto(r, usage.get(r.id) ?? 0))
}

export async function getVoiceDto(id: string): Promise<AdminVoiceDto> {
  const v = await getVoiceForAdmin(id)
  if (!v) throw hiddenNotFound()
  const usage = await countUsersByVoice([v.id])
  return dto(v, usage.get(v.id) ?? 0)
}
