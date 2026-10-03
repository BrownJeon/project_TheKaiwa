/**
 * TurnContext(§66 · module-dependency §4-1) — 턴·점검 프롬프트에 넣을 학습자 헤더와 대화 창 재료를 모은다.
 * preferences(학습 설정)·learning(오류 통계 **읽기**)만 부른다. 값은 코드가 만든다(LLM 이 지어내지 않게).
 */
import type { JlptLevel } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { getErrorStats, type ErrorStat } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'
import { isAwaitingSelfCheck, readCorrectionMeta, type TalkCorrectionMeta } from './corrections/talkDelivery'
import type { LearnerHeader } from './prompts/header'
import type { CorrectionMode } from './prompts/talk'
import type { WindowMessage } from './window'

/** 최근 약점 top3 — 유형별 합계 내림차순(`CONJUGATION(3)`). */
export function topWeaknesses(stats: ErrorStat[], n = 3): string[] {
  const byType = new Map<string, number>()
  for (const s of stats) byType.set(s.type, (byType.get(s.type) ?? 0) + s.count)
  return [...byType.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t, c]) => `${t}(${c})`)
}

/**
 * `talkCorrectionMode`(task-010c)는 헤더에 넣지 않는다 — A1 은 `[교정]` 줄로만 받는다(talk@v5 부터 TALK 헤더에는 `교정 모드` 칸 자체가 없다 —
 * `renderHeader` 의 `omitCorrectionMode`, REV-055 M-1). 같은 60초 캐시를 함께 써서 턴마다 DB 왕복을 늘리지 않는다.
 */
type LearnerBase = Omit<LearnerHeader, 'level'> & { profileLevel: string; talkCorrectionMode: CorrectionMode }

/**
 * 학습자 헤더 재료(학습 설정 + 약점 top3) 60초 메모리 캐시(task-007 K2-3). 설정을 바꾼 직후 최대 60초는 이전 값으로
 * 프롬프트가 만들어질 수 있다(Leader 계획 수용). 턴마다 두 번의 DB 왕복을 TTFA 경로에서 뺀다. 프로세스당 최대 500명.
 */
export const LEARNER_BASE_TTL_MS = 60_000
declare global {
  var __kaiwaLearnerBase: Map<string, { at: number; value: Promise<LearnerBase> }> | undefined
}
/** 진행 중인 읽기도 공유한다(수락과 병렬로 미리 읽은 것을 본 요청이 기다려 쓴다). */
const learnerBaseCache: Map<string, { at: number; value: Promise<LearnerBase> }> = (globalThis.__kaiwaLearnerBase ??= new Map())

async function readLearnerBase(userId: string): Promise<LearnerBase> {
  const [profile, stats] = await Promise.all([getProfile(userId), getErrorStats(userId, 20)])
  return {
    displayName: profile.displayName,
    teacherName: profile.teacherName,
    profileLevel: profile.level,
    politeness: profile.politeness,
    strictness: profile.strictness,
    explainDepth: profile.explainDepth,
    explainLang: profile.explainLang,
    goal: profile.goalLevel ? `JLPT ${profile.goalLevel}` : null,
    weaknesses: topWeaknesses(stats),
    talkCorrectionMode: profile.correctionMode === 'COACH' ? 'COACH' : 'FLUENCY',
  }
}

function loadLearnerBase(userId: string): Promise<LearnerBase> {
  const hit = learnerBaseCache.get(userId)
  if (hit && Date.now() - hit.at < LEARNER_BASE_TTL_MS) {
    // Map 삽입 순서를 최근 사용 순으로 — 상한에서 가장 오래 안 쓴 사용자부터 내린다(REV-014 Low-7).
    learnerBaseCache.delete(userId)
    learnerBaseCache.set(userId, hit)
    return hit.value
  }
  const value = readLearnerBase(userId)
  if (learnerBaseCache.size >= 500) learnerBaseCache.delete(learnerBaseCache.keys().next().value as string)
  const entry = { at: Date.now(), value }
  learnerBaseCache.set(userId, entry)
  value.catch(() => {
    if (learnerBaseCache.get(userId) === entry) learnerBaseCache.delete(userId)
  })
  return value
}

/** 테스트·설정 저장 직후용. */
export function forgetLearnerBase(userId?: string): void {
  if (userId) learnerBaseCache.delete(userId)
  else learnerBaseCache.clear()
}

export async function buildLearnerHeader(userId: string, chatLevel: JlptLevel | null): Promise<LearnerHeader> {
  const { profileLevel, talkCorrectionMode: _mode, ...base } = await loadLearnerBase(userId)
  void _mode
  return { ...base, level: chatLevel ?? profileLevel }
}

/** 설정의 교정 방식(task-010c) — 헤더와 같은 캐시. 설정 저장(#12)이 `forgetLearnerBase` 로 비우므로 다음 말부터 바로 적용된다. */
export async function loadTalkCorrectionMode(userId: string): Promise<CorrectionMode> {
  return (await loadLearnerBase(userId)).talkCorrectionMode
}

/**
 * 이번 사용자 메시지 **이전**의 대화(오래된 것 → 최근). DONE 메시지만(실패·대기 중 강사 행은 맥락이 아니다).
 * 창 자르기(개수·문자 상한)는 프롬프트 모듈의 `buildWindow` 가 한다 — 여기서는 넉넉히 최근 30건만 가져온다.
 */
/**
 * 새 턴의 이력 미리 읽기(task-007 K2-3) — 수락 트랜잭션과 **병렬로** 돈다. 새 사용자 행이 생기기 전이므로 "지금 있는 DONE 메시지" 가
 * 곧 이번 입력 이전의 대화다(사용자당 턴 1 락이 그 사이 다른 쓰기를 막는다). 수락(소유자 검사) 전에 읽으므로 **userId 조건을 함께 건다**
 * — 남의 채팅이면 빈 목록이고, 결과는 수락이 성공한 뒤에만 쓴다.
 */
export async function loadRecentHistory(userId: string, chatId: string): Promise<WindowMessage[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { chatId, userId, status: 'DONE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30,
    select: { role: true, content: true },
  })
  return rows
    .reverse()
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content }))
}

export async function loadHistoryBefore(chatId: string, before: { id: string; createdAt: Date }): Promise<WindowMessage[]> {
  const rows = await prisma.chatMessage.findMany({
    where: {
      chatId,
      status: 'DONE',
      OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30,
    select: { role: true, content: true },
  })
  return rows
    .reverse()
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content }))
}

/** 코치 자기수정 판정 재료(task-010c L3) — 직전 사용자 말에 달린, 힌트를 받고 아직 판정 전인 PROPOSED 교정. */
export interface CoachPending {
  userMessageId: string
  toolLog: unknown
  meta: TalkCorrectionMeta & { hintKo: string }
  correction: { id: string; original: string; corrected: string }
}

/**
 * 이번 사용자 말 **바로 앞** 사용자 말(같은 채팅)의 교정 메타를 본다 — 직전 턴만 판정한다(더 오래된 힌트는 지나간 것). 수락 뒤 LLM 과
 * 병렬로 부른다(첫 음성 경로 밖). 판정 대상이 아니면 null.
 */
export async function loadCoachPending(userId: string, chatId: string, before: { id: string; createdAt: Date }): Promise<CoachPending | null> {
  const prev = await prisma.chatMessage.findFirst({
    where: { chatId, userId, role: 'USER', OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, toolLog: true, corrections: { where: { userId, status: 'PROPOSED' }, select: { id: true, original: true, corrected: true } } },
  })
  if (!prev) return null
  const meta = readCorrectionMeta(prev.toolLog)
  if (!isAwaitingSelfCheck(meta)) return null
  const correction = prev.corrections.find((c) => c.id === meta.id)
  if (!correction) return null
  return { userMessageId: prev.id, toolLog: prev.toolLog, meta, correction }
}
