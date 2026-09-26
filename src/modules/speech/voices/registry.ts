/**
 * 사용자에게 보이는 Voice 목록(api-contract #17) — `AVAILABLE && enabled` 만, sortOrder 순.
 * **내부 모델·speaker·connection 은 응답에 싣지 않는다**(사용자 화면 엔진명 0 원칙).
 */
import { prisma } from '@/modules/infra'

export interface SelectableVoice {
  id: string
  name: string
  description: string | null
  available: true
  defaults: { style: string; styleWeight: number; speed: number; pitch: number; intonation: number }
  styles: { name: string; label: string }[]
  previewUrl: string | null
}

export async function listSelectableVoices(): Promise<SelectableVoice[]> {
  const rows = await prisma.voiceProfile.findMany({
    where: { status: 'AVAILABLE', enabled: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, displayName: true, description: true, defaults: true, styles: { orderBy: { sortOrder: 'asc' }, select: { name: true, label: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.displayName,
    description: r.description,
    available: true as const,
    defaults: r.defaults as SelectableVoice['defaults'],
    styles: r.styles,
    previewUrl: null, // 기본 파라미터 미리듣기 캐시는 TTS 연결(task-003) 이후 채운다
  }))
}

/** 설정 저장·미리듣기 검증(#14·#18): Voice 가 선택 가능하고, style 이 'AUTO' 또는 그 Voice 의 스타일인지. */
export async function assertSelectableVoice(voiceProfileId: string, style: string): Promise<{ id: string; name: string }> {
  const v = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, status: 'AVAILABLE', enabled: true },
    select: { id: true, displayName: true, styles: { select: { name: true } } },
  })
  if (!v) throw Object.assign(new Error('VOICE_NOT_AVAILABLE'), { name: 'VoiceNotAvailableError' })
  if (style !== 'AUTO' && !v.styles.some((s) => s.name === style)) throw Object.assign(new Error('STYLE_NOT_AVAILABLE'), { name: 'VoiceStyleInvalidError' })
  return { id: v.id, name: v.displayName }
}
