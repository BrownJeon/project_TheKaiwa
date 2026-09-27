/**
 * TurnContext(§66 · module-dependency §4-1) — 턴·점검 프롬프트에 넣을 학습자 헤더와 대화 창 재료를 모은다.
 * preferences(학습 설정)·learning(오류 통계 **읽기**)만 부른다. 값은 코드가 만든다(LLM 이 지어내지 않게).
 */
import type { JlptLevel } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { getErrorStats, type ErrorStat } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'
import type { LearnerHeader } from './prompts/header'
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

type LearnerBase = Omit<LearnerHeader, 'level'> & { profileLevel: string }

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
  }
}

function loadLearnerBase(userId: string): Promise<LearnerBase> {
  const hit = learnerBaseCache.get(userId)
  if (hit && Date.now() - hit.at < LEARNER_BASE_TTL_MS) return hit.value
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
  const { profileLevel, ...base } = await loadLearnerBase(userId)
  return { ...base, level: chatLevel ?? profileLevel }
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
