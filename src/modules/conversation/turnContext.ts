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

export async function buildLearnerHeader(userId: string, chatLevel: JlptLevel | null): Promise<LearnerHeader> {
  const [profile, stats] = await Promise.all([getProfile(userId), getErrorStats(userId, 20)])
  return {
    displayName: profile.displayName,
    teacherName: profile.teacherName,
    level: chatLevel ?? profile.level,
    politeness: profile.politeness,
    strictness: profile.strictness,
    explainDepth: profile.explainDepth,
    explainLang: profile.explainLang,
    goal: profile.goalLevel ? `JLPT ${profile.goalLevel}` : null,
    weaknesses: topWeaknesses(stats),
  }
}

/**
 * 이번 사용자 메시지 **이전**의 대화(오래된 것 → 최근). DONE 메시지만(실패·대기 중 강사 행은 맥락이 아니다).
 * 창 자르기(개수·문자 상한)는 프롬프트 모듈의 `buildWindow` 가 한다 — 여기서는 넉넉히 최근 30건만 가져온다.
 */
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
