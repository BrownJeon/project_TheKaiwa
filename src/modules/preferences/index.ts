/**
 * L1 User Preference — Profile(학습 설정)·UserVoiceSetting·UserSpeechSetting·AppSetting. 공개 API(module-dependency L1).
 * 행은 **지연 생성**한다(첫 조회 때 기본값으로 upsert — speech-platform/13). 엔진·Voice 모델은 모른다:
 * Voice 가용성 검사는 speech 층이, 조합은 라우트가 한다.
 */
import { prisma } from '@/modules/infra'
import { Prisma, type Environment } from '@prisma/client'
import type { ProfilePatch, VoiceDraft } from './validate'

export * from './validate'

const PROFILE_SELECT = {
  displayName: true, teacherName: true, level: true, politeness: true, goalLevel: true, goalTopics: true, goalDeadline: true,
  dailyWordCount: true, dailyMinutes: true, strictness: true, explainLang: true, explainDepth: true, updatedAt: true,
} as const

function serializeProfile<T extends { goalDeadline: Date | null }>(p: T): Omit<T, 'goalDeadline'> & { goalDeadline: string | null } {
  return { ...p, goalDeadline: p.goalDeadline ? p.goalDeadline.toISOString().slice(0, 10) : null }
}

export async function getProfile(userId: string) {
  const p = await prisma.profile.upsert({ where: { userId }, update: {}, create: { userId }, select: PROFILE_SELECT })
  return serializeProfile(p)
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  // Json? 컬럼에 null 을 쓰려면 Prisma.DbNull 이어야 한다(undefined 는 '갱신 안 함' 이라 목표 주제를 지울 수 없었다 — REV-006 M1).
  const { goalTopics, ...rest } = patch
  const data = { ...rest, ...(goalTopics === undefined ? {} : { goalTopics: goalTopics === null ? Prisma.DbNull : goalTopics }) }
  const p = await prisma.profile.upsert({ where: { userId }, update: data, create: { userId, ...data }, select: PROFILE_SELECT })
  return serializeProfile(p)
}

/** 레벨만 바꾼다 — SET_LEVEL 제안 채택(#38, task-011)이 채택 트랜잭션 `tx` 안에서 부른다. */
export async function setProfileLevel(userId: string, level: ProfilePatch['level'] & string, tx: Prisma.TransactionClient) {
  const p = await tx.profile.upsert({ where: { userId }, update: { level }, create: { userId, level }, select: PROFILE_SELECT })
  return serializeProfile(p)
}

const VOICE_SELECT = { voiceProfileId: true, style: true, styleWeight: true, speed: true, pitch: true, intonation: true, speechProfile: true, updatedAt: true } as const

export async function getVoiceSetting(userId: string, defaultVoiceProfileId: string | null) {
  return prisma.userVoiceSetting.upsert({
    where: { userId },
    update: {},
    create: { userId, voiceProfileId: defaultVoiceProfileId },
    select: VOICE_SELECT,
  })
}

/** TTS 합성용 읽기(행을 만들지 않는다) — LEARNING_SLOW 배속(learningSpeed)까지. 없으면 null(호출자가 기본값). */
export async function getVoiceSettingForTts(userId: string) {
  return prisma.userVoiceSetting.findUnique({ where: { userId }, select: { ...VOICE_SELECT, learningSpeed: true } })
}

/** 저장된 목소리가 비활성·보관됐을 때 기본 목소리로 바꾸고 스타일을 AUTO 로 초기화(speech-platform/03 재배정 규칙). */
export async function reassignVoice(userId: string, toVoiceProfileId: string) {
  return prisma.userVoiceSetting.update({ where: { userId }, data: { voiceProfileId: toVoiceProfileId, style: 'AUTO' }, select: VOICE_SELECT })
}

export async function updateVoiceSetting(userId: string, draft: VoiceDraft) {
  return prisma.userVoiceSetting.upsert({ where: { userId }, update: draft, create: { userId, ...draft }, select: VOICE_SELECT })
}

export async function getSpeechSetting(userId: string) {
  return prisma.userSpeechSetting.upsert({ where: { userId }, update: {}, create: { userId }, select: { recognitionMode: true, updatedAt: true } })
}

export async function updateSpeechSetting(userId: string, patch: { recognitionMode?: 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE' }) {
  return prisma.userSpeechSetting.upsert({ where: { userId }, update: patch, create: { userId, ...patch }, select: { recognitionMode: true, updatedAt: true } })
}

/** AppSetting(현재 APP_ENV 행) 조회 — 없으면 fallback. */
export async function getAppSetting<T>(key: string, fallback: T): Promise<T> {
  const env = (process.env.APP_ENV ?? 'LOCAL').toUpperCase() as Environment
  const row = await prisma.appSetting.findUnique({ where: { environment_key: { environment: env, key } } })
  return row ? (row.value as T) : fallback
}

/** Voice 별 사용자 수(관리자 #82 `usage.users`) — UserVoiceSetting 은 preferences 소유라 여기서 센다. */
export async function countUsersByVoice(voiceProfileIds: string[]): Promise<Map<string, number>> {
  if (voiceProfileIds.length === 0) return new Map()
  const rows = await prisma.userVoiceSetting.groupBy({ by: ['voiceProfileId'], where: { voiceProfileId: { in: voiceProfileIds } }, _count: { _all: true } })
  return new Map(rows.filter((r) => r.voiceProfileId).map((r) => [r.voiceProfileId as string, r._count._all]))
}
